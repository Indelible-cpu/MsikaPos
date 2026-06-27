import { prisma } from '../lib/prisma';
import { AuditService } from './AuditService';

export class SyncService {
  /**
   * Main sync logic to process batch updates from offline clients
   */
  static async syncData(params: {
    sales?: any[];
    expenses?: any[];
    customers?: any[];
    debtPayments?: any[];
    deviceId: string;
    lastSyncTimestamp?: string;
    user: any;
  }) {
    const { sales, expenses, customers, debtPayments, deviceId, lastSyncTimestamp, user } = params;
    const userId = user.id;

    // 1. Process Incoming Sales (Reconciliation Logic)
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
          // Reconciliation: Check if sale already exists by invoiceNo (Strong Match)
          const existingSale = await prisma.sale.findUnique({
            where: { invoiceNo: saleData.invoiceNo },
            select: { id: true, status: true, items: true }
          });

          if (!existingSale) {
            // Filter out items with invalid/deleted productIds so the sale doesn't fail
            const validItems = (saleData.items || []).filter((item: any) => validProductIds.has(item.productId));

            await prisma.$transaction(async (tx) => {
              let finalCustomerId: number | null = null;
              if (saleData.customerId) {
                const parsed = parseInt(saleData.customerId, 10);
                if (!isNaN(parsed) && parsed.toString() === saleData.customerId.toString()) {
                  finalCustomerId = parsed;
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

              // Create Sale
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

              // Update Inventory only for valid non-service products
              for (const item of validItems) {
                const isService = serviceStatusMap.get(item.productId);
                if (!isService) {
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
              entityId: saleData.invoiceNo
            });
          } else {
            // Already exists — mark as synced on client
            syncedSaleIds.push(saleData.id);

            // Check if status changed to REFUNDED or DELETED locally
            if (saleData.status && existingSale.status !== saleData.status && 
                (saleData.status === 'REFUNDED' || saleData.status === 'DELETED')) {
              
              await prisma.$transaction(async (tx) => {
                await tx.sale.update({
                  where: { id: existingSale.id },
                  data: { 
                    status: saleData.status,
                    refundReason: saleData.refundReason
                  }
                });

                // Restock items
                for (const item of existingSale.items) {
                  const isService = serviceStatusMap.get(item.productId);
                  if (!isService && validProductIds.has(item.productId)) {
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
                details: `Status updated to ${saleData.status} via sync`
              });
            }
          }
        } catch (saleErr: any) {
          // Log and skip this sale — do NOT fail the entire sync
          console.error(`[Sync] Failed to process sale ${saleData.invoiceNo}:`, saleErr.message);
        }
      }
    }

    // 2. Process Incoming Expenses
    if (expenses && expenses.length > 0) {
      for (const exp of expenses) {
        try {
          const existing = await prisma.expense.findUnique({ where: { id: exp.id } });
          if (!existing) {
            await prisma.expense.create({
              data: {
                id: exp.id,
                category: exp.category,
                amount: exp.amount,
                description: exp.description,
                paymentMethod: exp.paymentMethod,
                expenseDate: new Date(exp.date),
                userId: userId
              }
            });
          }
        } catch (err: any) {
          console.error(`[Sync] Failed to process expense ${exp.id}:`, err.message);
        }
      }
    }

    // 3. Process Incoming Customers
    if (customers && customers.length > 0) {
      for (const cust of customers) {
        try {
          const existing = await prisma.customer.findUnique({ where: { id: cust.id } });
          if (!existing) {
            await prisma.customer.create({
              data: {
                id: cust.id,
                fullname: cust.name,
                phone: cust.phone,
                idNumber: cust.idNumber,
                village: cust.village,
                livePhoto: cust.livePhoto,
                balance: cust.balance || 0,
                totalDebt: cust.totalCreditAmount || 0,
                createdAt: new Date(cust.createdAt)
              }
            });
          }
        } catch (err: any) {
          console.error(`[Sync] Failed to process customer ${cust.id}:`, err.message);
        }
      }
    }

    // 4. Process Incoming Debt Payments
    if (debtPayments && debtPayments.length > 0 && prisma.debtPayment) {
      for (const pay of debtPayments) {
        try {
          const existing = await (prisma as any).debtPayment.findUnique({ where: { id: pay.id } });
          if (!existing) {
            await prisma.$transaction(async (tx) => {
              await (tx as any).debtPayment.create({
                data: {
                  id: pay.id,
                  customerId: pay.customerId,
                  amount: pay.amount,
                  paymentMethod: pay.paymentMethod,
                  reference: pay.reference,
                  createdAt: new Date(pay.createdAt)
                }
              });
            });
          }
        } catch (err: any) {
          console.error(`[Sync] Failed to process debt payment ${pay.id}:`, err.message);
        }
      }
    }

    // 5. Fetch Remote Updates
    const updatedProducts = await prisma.product.findMany({
      where: {
        updatedAt: {
          gt: lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0),
        }
      },
      include: { category: true },
    });

    const mappedProducts = updatedProducts.map((p: any) => ({
      ...p,
      costPrice: Number(p.costPrice),
      sellPrice: Number(p.sellPrice),
      discountValue: p.discountValue ? Number(p.discountValue) : 0,
    }));

    const updatedCategories = await prisma.category.findMany({});

    // Fetch Other Updates since last sync
    const syncCutoff = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0);
    
    const updatedCustomers = await prisma.customer.findMany({
      where: { updatedAt: { gt: syncCutoff } }
    });

    const mappedCustomers = updatedCustomers.map((c: any) => ({
      ...c,
      balance: Number(c.balance),
      totalCreditAmount: Number(c.totalDebt)
    }));

    const updatedExpenses = await prisma.expense.findMany({
      where: { createdAt: { gt: syncCutoff } }
    });

    const updatedDebtPayments = await (prisma as any).debtPayment.findMany({
      where: { createdAt: { gt: syncCutoff } }
    });

    const updatedSales = await prisma.sale.findMany({
      where: { updatedAt: { gt: syncCutoff } },
      include: { items: true }
    });

    // Log Sync
    await prisma.syncLog.create({
      data: {
        deviceId: deviceId || 'unknown',
        userId: userId,
        action: 'BATCH_SYNC',
        status: 'SUCCESS',
        details: `Processed ${sales?.length || 0} sales. Downloaded ${updatedProducts.length} product updates.`,
      },
    });

    return {
      serverTime: new Date().toISOString(),
      syncedSaleIds,
      updates: {
        products: mappedProducts,
        categories: updatedCategories,
        customers: mappedCustomers,
        expenses: updatedExpenses,
        debtPayments: updatedDebtPayments,
        sales: updatedSales
      },
    };
  }
}
