import { prisma } from '../lib/prisma';
import { AuditService } from './AuditService';

export class SyncService {
  /**
   * Main sync logic to process batch updates from offline clients.
   * Design principles:
   *  - Idempotent: safe to call multiple times with the same data
   *  - Offline-first: local UUIDs are resolved to server integer IDs and returned
   *  - Fail-safe: individual record errors never abort the whole sync
   */
  static async syncData(params: {
    sales?: any[];
    expenses?: any[];
    customers?: any[];
    debtPayments?: any[];
    deviceId: string;
    lastSyncTimestamp?: string;
    user: any;
    ipInfo?: { ip: string; source: string };
  }) {
    const { sales, expenses, customers, debtPayments, deviceId, lastSyncTimestamp, user, ipInfo } = params;
    const userId = user.id;

    // â”€â”€â”€ 1. Process Incoming Customers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Must run BEFORE sales and debtPayments so we can resolve UUID â†’ Int IDs.
    const customerIdMap = new Map<string, number>(); // offlineId (UUID) â†’ serverId (Int)

    if (customers && customers.length > 0) {
      for (const cust of customers) {
        try {
          const offlineId = String(cust.id);

          // Prefer offlineId lookup first, fall back to phone match
          let existing = await prisma.customer.findUnique({ where: { offlineId } });
          if (!existing && cust.phone) {
            existing = await prisma.customer.findFirst({ where: { phone: cust.phone } });
          }

          if (existing) {
            // Update fields that may have changed, but don't overwrite server-side debt/balance blindly
            await prisma.customer.update({
              where: { id: existing.id },
              data: {
                fullname: cust.name || existing.fullname,
                phone: cust.phone || existing.phone,
                idNumber: cust.idNumber ?? existing.idNumber,
                village: cust.village ?? existing.village,
                livePhoto: cust.livePhoto ?? existing.livePhoto,
                offlineId: existing.offlineId ?? offlineId,
              }
            });
            customerIdMap.set(offlineId, existing.id);
          } else {
            const created = await prisma.customer.create({
              data: {
                fullname: cust.name,
                phone: cust.phone,
                idNumber: cust.idNumber,
                village: cust.village,
                livePhoto: cust.livePhoto,
                balance: Number(cust.balance || 0),
                totalDebt: Number(cust.totalCreditAmount || 0),
                offlineId,
                createdAt: new Date(cust.createdAt || Date.now()),
              }
            });
            customerIdMap.set(offlineId, created.id);
          }
        } catch (err: any) {
          console.error(`[Sync] Failed to process customer ${cust.id}:`, err.message);
        }
      }
    }

    // â”€â”€â”€ 2. Process Incoming Sales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const syncedSaleIds: string[] = [];

    if (sales && sales.length > 0) {
      const allProductIds = Array.from(new Set(
        sales.flatMap((s: any) => (s.items || []).map((i: any) => i.productId))
      ));

      const productMeta = await prisma.product.findMany({
        where: { id: { in: allProductIds as number[] } },
        select: { id: true, isService: true }
      });

      const serviceStatusMap = new Map(productMeta.map(p => [p.id, p.isService]));
      const validProductIds = new Set(productMeta.map(p => p.id));

      for (const saleData of sales) {
        try {
          const existingSale = await prisma.sale.findUnique({
            where: { invoiceNo: saleData.invoiceNo },
            select: { id: true, status: true, items: true }
          });

          if (!existingSale) {
            const validItems = (saleData.items || []).filter((item: any) => validProductIds.has(item.productId));

            await prisma.$transaction(async (tx) => {
              // Resolve customerId: Int parse â†’ in-memory map â†’ DB offlineId lookup â†’ placeholder
              let finalCustomerId: number | null = null;
              if (saleData.customerId) {
                const parsed = parseInt(saleData.customerId, 10);
                if (!isNaN(parsed) && String(parsed) === String(saleData.customerId)) {
                  finalCustomerId = parsed;
                } else {
                  const mappedId = customerIdMap.get(String(saleData.customerId));
                  if (mappedId) {
                    finalCustomerId = mappedId;
                  } else {
                    let cust = await tx.customer.findUnique({ where: { offlineId: saleData.customerId } });
                    if (!cust) {
                      cust = await tx.customer.create({
                        data: {
                          fullname: saleData.customerName || 'Offline Customer',
                          phone: '000000000',
                          offlineId: saleData.customerId
                        }
                      });
                    }
                    finalCustomerId = cust.id;
                  }
                }
              }

              await tx.sale.create({
                data: {
                  id: saleData.id,
                  invoiceNo: saleData.invoiceNo,
                  receiptNo: saleData.receiptNo,
                  userId: userId,
                  customerId: finalCustomerId,
                  subtotal: saleData.subtotal,
                  discount: saleData.discount,
                  total: saleData.total,
                  paid: saleData.paid,
                  changeDue: saleData.changeDue,
                  profit: saleData.profit || validItems.reduce((acc: number, item: any) => acc + (item.profit || 0), 0),
                  paymentMode: saleData.paymentMode === 'Momo' ? 'MOBILE_MONEY' :
                               saleData.paymentMode === 'Card' ? 'CARD' :
                               saleData.paymentMode === 'Credit' ? 'CREDIT' : 'CASH',
                  status: saleData.status || 'COMPLETED',
                  taxAmount: saleData.tax || 0,
                  taxRate: saleData.taxRate || 0,
                  isCredit: saleData.paymentMode === 'Credit',
                  dueDate: saleData.dueDate ? new Date(saleData.dueDate) : null,
                  itemsCount: saleData.itemsCount,
                  synced: true,
                  deviceId: deviceId,
                  createdAt: new Date(saleData.createdAt),
                  items: {
                    create: validItems.map((item: any) => ({
                      productId: item.productId,
                      productName: item.productName,
                      unitPrice: item.unitPrice,
                      quantity: item.quantity,
                      discount: item.discount,
                      lineTotal: item.lineTotal,
                      profit: item.profit,
                    })),
                  },
                },
              });

              // Decrement inventory for physical (non-service) products
              for (const item of validItems) {
                if (!serviceStatusMap.get(item.productId)) {
                  await tx.product.update({
                    where: { id: item.productId },
                    data: { quantity: { decrement: item.quantity } },
                  });
                }
              }
            });

            syncedSaleIds.push(saleData.id);

            await AuditService.log({
              userId,
              action: 'SYNC_SALE',
              entityType: 'SALE',
              entityId: saleData.invoiceNo,
              ip: ipInfo?.ip,
              ipSource: ipInfo?.source
            });
          } else {
            // Already exists â€” mark as synced on client
            syncedSaleIds.push(saleData.id);

            // Propagate status changes (REFUNDED / DELETED) from client to server
            if (saleData.status && existingSale.status !== saleData.status &&
                (saleData.status === 'REFUNDED' || saleData.status === 'DELETED')) {

              await prisma.$transaction(async (tx) => {
                await tx.sale.update({
                  where: { id: existingSale.id },
                  data: { status: saleData.status, refundReason: saleData.refundReason }
                });

                // Restock items
                for (const item of existingSale.items) {
                  if (!serviceStatusMap.get(item.productId) && validProductIds.has(item.productId)) {
                    await tx.product.update({
                      where: { id: item.productId },
                      data: { quantity: { increment: item.quantity } }
                    });
                  }
                }
              });

              await AuditService.log({
                userId,
                action: 'SYNC_SALE_UPDATE',
                entityType: 'SALE',
                entityId: saleData.invoiceNo,
                details: `Status updated to ${saleData.status} via sync`,
                ip: ipInfo?.ip,
                ipSource: ipInfo?.source
              });
            }
          }
        } catch (saleErr: any) {
          console.error(`[Sync] Failed to process sale ${saleData.invoiceNo}:`, saleErr.message);
        }
      }
    }

    // â”€â”€â”€ 3. Process Incoming Expenses (upsert â€” edits are captured) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (expenses && expenses.length > 0) {
      for (const exp of expenses) {
        try {
          await prisma.expense.upsert({
            where: { id: exp.id },
            create: {
              id: exp.id,
              category: exp.category,
              amount: exp.amount,
              description: exp.description,
              paymentMethod: exp.paymentMethod || 'Cash',
              expenseDate: new Date(exp.date),
              userId: userId,
            },
            update: {
              category: exp.category,
              amount: exp.amount,
              description: exp.description,
              paymentMethod: exp.paymentMethod || 'Cash',
              expenseDate: new Date(exp.date),
            }
          });
        } catch (err: any) {
          console.error(`[Sync] Failed to process expense ${exp.id}:`, err.message);
        }
      }
    }

    // â”€â”€â”€ 4. Process Incoming Debt Payments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (debtPayments && debtPayments.length > 0) {
      for (const pay of debtPayments) {
        try {
          // Resolve customerId (UUID â†’ Int via map or DB lookup)
          let resolvedCustomerId: number | null = null;
          if (pay.customerId) {
            const parsed = parseInt(pay.customerId, 10);
            if (!isNaN(parsed) && String(parsed) === String(pay.customerId)) {
              resolvedCustomerId = parsed;
            } else {
              const mappedId = customerIdMap.get(String(pay.customerId));
              if (mappedId) {
                resolvedCustomerId = mappedId;
              } else {
                const cust = await prisma.customer.findUnique({ where: { offlineId: pay.customerId } });
                if (cust) resolvedCustomerId = cust.id;
              }
            }
          }

          if (!resolvedCustomerId) {
            console.warn(`[Sync] Skipping debt payment ${pay.id}: cannot resolve customerId ${pay.customerId}`);
            continue;
          }

          const existing = await prisma.debtPayment.findUnique({ where: { id: pay.id } });
          if (!existing) {
            await prisma.debtPayment.create({
              data: {
                id: pay.id,
                customerId: resolvedCustomerId,
                amount: pay.amount,
                paymentMethod: pay.paymentMethod,
                reference: pay.reference,
                createdAt: new Date(pay.createdAt)
              }
            });
          }
        } catch (err: any) {
          console.error(`[Sync] Failed to process debt payment ${pay.id}:`, err.message);
        }
      }
    }

    // â”€â”€â”€ 5. Fetch Remote Updates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const syncCutoff = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0);

    const [updatedProducts, updatedCategories, updatedCustomers, updatedExpenses, updatedDebtPayments, updatedSales] =
      await Promise.all([
        prisma.product.findMany({
          where: { updatedAt: { gt: syncCutoff } },
          include: { category: true },
        }),
        prisma.category.findMany({}), // categories have no updatedAt; sync all (small table)
        prisma.customer.findMany({ where: { updatedAt: { gt: syncCutoff } } }),
        prisma.expense.findMany({ where: { createdAt: { gt: syncCutoff } } }), // Expense has no updatedAt; use createdAt
        prisma.debtPayment.findMany({ where: { createdAt: { gt: syncCutoff } } }),
        prisma.sale.findMany({ where: { updatedAt: { gt: syncCutoff } }, include: { items: true } }),
      ]);

    const mappedProducts = updatedProducts.map((p: any) => ({
      ...p,
      costPrice: Number(p.costPrice),
      sellPrice: Number(p.sellPrice),
      discountValue: p.discountValue ? Number(p.discountValue) : 0,
    }));

    const mappedCustomers = updatedCustomers.map((c: any) => ({
      ...c,
      balance: Number(c.balance),
      totalCreditAmount: Number(c.totalDebt),
    }));

    // â”€â”€â”€ 6. Log Sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await prisma.syncLog.create({
      data: {
        deviceId: deviceId || 'unknown',
        userId: userId,
        action: 'BATCH_SYNC',
        status: 'SUCCESS',
        details: `Processed ${sales?.length || 0} sales, ${customers?.length || 0} customers. Downloaded ${updatedProducts.length} product updates.`,
      },
    });

    return {
      serverTime: new Date().toISOString(),
      syncedSaleIds,
      // Frontend uses this to remap local UUID customer IDs â†’ server Int IDs
      customerIdMap: Object.fromEntries(customerIdMap),
      updates: {
        products: mappedProducts,
        categories: updatedCategories,
        customers: mappedCustomers,
        expenses: updatedExpenses,
        debtPayments: updatedDebtPayments,
        sales: updatedSales,
      },
    };
  }
}
