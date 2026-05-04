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
    const branchId = user.branchId;

    // 1. Process Incoming Sales (Reconciliation Logic)
    if (sales && sales.length > 0) {
      const allProductIds = Array.from(new Set(
        sales.flatMap((s: any) => s.items.map((i: any) => i.productId))
      ));
      
      const productMeta = await prisma.product.findMany({
        where: { id: { in: allProductIds as number[] } },
        select: { id: true, isService: true }
      });
      
      const serviceStatusMap = new Map(productMeta.map(p => [p.id, p.isService]));

      for (const saleData of sales) {
        // Reconciliation: Check if sale already exists by invoiceNo (Strong Match)
        const existingSale = await prisma.sale.findUnique({
          where: { invoiceNo: saleData.invoiceNo },
          select: { id: true }
        });

        if (!existingSale) {
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
                      offlineId: saleData.customerId,
                      branchId: user.role === 'SUPER_ADMIN' ? (saleData.branchId || branchId) : branchId
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
                branchId: user.role === 'SUPER_ADMIN' 
                  ? (saleData.branchId ? parseInt(saleData.branchId) : branchId) 
                  : branchId,
                customerId: finalCustomerId,
                subtotal: saleData.subtotal,
                discount: saleData.discount,
                total: saleData.total,
                paid: saleData.paid,
                changeDue: saleData.changeDue,
                profit: saleData.profit || 0,
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
                  create: saleData.items.map((item: any) => ({
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

            // Update Inventory (only for non-services)
            for (const item of saleData.items) {
              const isService = serviceStatusMap.get(item.productId);
              if (!isService) {
                await tx.product.update({
                  where: { id: item.productId },
                  data: { quantity: { decrement: item.quantity } },
                });
              }
            }
          });

          await AuditService.log({
            userId,
            action: 'SYNC_SALE',
            entityType: 'SALE',
            entityId: saleData.invoiceNo,
            branchId
          });
        }
      }
    }

    // 2. Process Incoming Expenses
    if (expenses && expenses.length > 0) {
      for (const exp of expenses) {
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
              userId: userId,
              branchId: branchId
            }
          });
        }
      }
    }

    // 3. Process Incoming Customers
    if (customers && customers.length > 0) {
      for (const cust of customers) {
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
              // fingerprintData: cust.fingerprintData, // Not in schema
              // balance: cust.balance || 0, // Not in schema
              branchId: branchId,
              createdAt: new Date(cust.createdAt)
            }
          });
        }
      }
    }

    // 4. Process Incoming Debt Payments
    if (debtPayments && debtPayments.length > 0 && prisma.debtPayment) {
      for (const pay of debtPayments) {
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
            /*
            await tx.customer.update({
              where: { id: pay.customerId },
              data: { balance: { decrement: pay.amount } }
            });
            */
          });
        }
      }
    }

    // 5. Fetch Remote Updates
    const updatedProducts = await prisma.product.findMany({
      where: {
        updatedAt: {
          gt: lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0),
        },
        OR: [
          { branchId: branchId || undefined },
          { branchId: null }
        ]
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

    // Log Sync
    await prisma.syncLog.create({
      data: {
        deviceId: deviceId || 'unknown',
        userId: userId,
        branchId: branchId,
        action: 'BATCH_SYNC',
        status: 'SUCCESS',
        details: `Processed ${sales?.length || 0} sales. Downloaded ${updatedProducts.length} product updates.`,
      },
    });

    return {
      serverTime: new Date().toISOString(),
      updates: {
        products: mappedProducts,
        categories: updatedCategories,
      },
    };
  }
}
