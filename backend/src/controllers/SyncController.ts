import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const syncData = async (req: Request, res: Response) => {
  const { sales, deviceId, lastSyncTimestamp } = req.body;
  const userId = (req as any).user.id;

  try {
    // 1. Process Incoming Sales from Offline Queue
    if (sales && sales.length > 0) {
      for (const saleData of sales) {
        // Check if sale already exists (prevent duplicates)
        const existingSale = await prisma.sale.findUnique({
          where: { invoiceNo: saleData.invoiceNo },
        });

        if (!existingSale) {
          await prisma.$transaction(async (tx) => {
            // Create Sale
            await tx.sale.create({
              data: {
                id: saleData.id,
                invoiceNo: saleData.invoiceNo,
                receiptNo: saleData.receiptNo,
                userId: userId,
                branchId: saleData.branchId,
                customerId: saleData.customerId,
                subtotal: saleData.subtotal,
                discount: saleData.discount,
                total: saleData.total,
                paid: saleData.paid,
                changeDue: saleData.changeDue,
                profit: saleData.profit,
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

            // Update Inventory for each item
            for (const item of saleData.items) {
              const product = await tx.product.findUnique({ where: { id: item.productId } });
              if (product && !product.isService) {
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

    // 2. Fetch Updates for Client (Since last sync)
    const updatedProducts = await prisma.product.findMany({
      where: {
        updatedAt: {
          gt: lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0),
        },
      },
      include: { category: true },
    });

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
        action: 'BATCH_SYNC',
        status: 'SUCCESS',
        details: `Processed ${sales?.length || 0} sales. Downloaded ${updatedProducts.length} product updates.`,
      },
    });

    return res.status(200).json({
      success: true,
      serverTime: new Date().toISOString(),
      updates: {
        products: updatedProducts,
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
