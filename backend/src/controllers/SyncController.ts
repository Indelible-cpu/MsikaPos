import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const syncData = async (req: Request, res: Response) => {
  const { sales, deviceId, lastSyncTimestamp } = req.body;
  const userId = (req as any).user.id;

  try {
    // 1. Process Incoming Sales from Offline Queue
    if (sales && sales.length > 0) {
      // Pre-fetch all products involved in the sync to check service status
      const allProductIds = Array.from(new Set(
        sales.flatMap((s: any) => s.items.map((i: any) => i.productId))
      ));
      
      const productMeta = await prisma.product.findMany({
        where: { id: { in: allProductIds as number[] } },
        select: { id: true, isService: true }
      });
      
      const serviceStatusMap = new Map(productMeta.map(p => [p.id, p.isService]));

      for (const saleData of sales) {
        // Check if sale already exists (prevent duplicates)
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
                      branchId: (req as any).user.role === 'SUPER_ADMIN' ? saleData.branchId : (req as any).user.branchId
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
                branchId: (req as any).user.role === 'SUPER_ADMIN' ? saleData.branchId : (req as any).user.branchId,
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

            // Update Inventory for each item (only for non-services)
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
        }
      }
    }

    // 2. Process Incoming Expenses
    const expenses = req.body.expenses;
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
              branchId: (req as any).user.branchId
            }
          });
        }
      }
    }

    // 3. Process Incoming Customers
    const customers = req.body.customers;
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
              fingerprintData: cust.fingerprintData,
              balance: cust.balance || 0,
              branchId: (req as any).user.branchId,
              createdAt: new Date(cust.createdAt)
            }
          });
        }
      }
    }

    // 4. Process Incoming Debt Payments
    const debtPayments = req.body.debtPayments;
    if (debtPayments && debtPayments.length > 0) {
      for (const pay of debtPayments) {
        const existing = await prisma.debtPayment?.findUnique({ where: { id: pay.id } });
        if (!existing && prisma.debtPayment) {
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
            // Update customer balance
            await tx.customer.update({
              where: { id: pay.customerId },
              data: { balance: { decrement: pay.amount } }
            });
          });
        }
      }
    }
    const user = (req as any).user;
    const updatedProducts = await prisma.product.findMany({
      where: {
        updatedAt: {
          gt: lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0),
        },
        // Strict Branch Isolation
        branchId: user.branchId || undefined,
      },
      include: { category: true },
    });

    const mappedProducts = updatedProducts.map((p: any) => ({
      ...p,
      costPrice: Number(p.costPrice),
      sellPrice: Number(p.sellPrice),
      discountValue: p.discountValue ? Number(p.discountValue) : 0,
    }));

    const updatedCategories = await prisma.category.findMany({
       where: {
        // Categories rarely change but we could track update timestamps if needed
      }
    });

    // Log Sync
    await prisma.syncLog.create({
      data: {
        deviceId: deviceId || 'unknown',
        userId: userId,
        branchId: (req as any).user.branchId,
        action: 'BATCH_SYNC',
        status: 'SUCCESS',
        details: `Processed ${sales?.length || 0} sales. Downloaded ${updatedProducts.length} product updates.`,
      },
    });

    return res.status(200).json({
      success: true,
      serverTime: new Date().toISOString(),
      updates: {
        products: mappedProducts,
        categories: updatedCategories,
      },
    });
  } catch (error: any) {
    console.error('Sync Error Deep Trace:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Sync failed', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
};
