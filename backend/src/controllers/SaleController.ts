import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuditService } from '../services/AuditService';

export const updateSale = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, refundReason, paymentMode, customerId } = req.body;
  const user = (req as any).user;

  try {
    const sale = await prisma.sale.findUnique({
      where: { id: id as string },
      include: { items: true }
    });

    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });

    let finalCustomerId = sale.customerId;
    if (customerId !== undefined) {
      if (customerId === null || customerId === '') {
        finalCustomerId = null;
      } else {
        const parsed = parseInt(customerId, 10);
        finalCustomerId = !isNaN(parsed) ? parsed : sale.customerId;
      }
    }

    // Process refund stock return if transitioning from COMPLETED to REFUNDED or DELETED
    if ((status === 'REFUNDED' || status === 'DELETED') && sale.status !== 'REFUNDED' && sale.status !== 'DELETED') {
      const allProductIds: number[] = Array.from(new Set((sale as any).items.map((i: any) => i.productId)));
      const productMeta = await prisma.product.findMany({
        where: { id: { in: allProductIds } },
        select: { id: true, isService: true }
      });
      const serviceStatusMap = new Map(productMeta.map(p => [p.id, p.isService]));

      await prisma.$transaction(async (tx) => {
        for (const item of (sale as any).items) {
          if (!serviceStatusMap.get(item.productId)) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { increment: item.quantity } }
            });
          }
        }
      });
    }

    const updatedSale = await prisma.sale.update({
      where: { id: id as string },
      data: {
        status: status || sale.status,
        refundReason: refundReason !== undefined ? refundReason : sale.refundReason,
        paymentMode: paymentMode || sale.paymentMode,
        customerId: finalCustomerId,
        updatedAt: new Date()
      }
    });

    await AuditService.log({
      userId: user.id,
      action: 'UPDATE_SALE',
      entityType: 'SALE',
      entityId: id as string,
      details: `Status: ${status}, RefundReason: ${refundReason}`
    });

    return res.status(200).json({ success: true, data: updatedSale });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to update sale', error: error.message });
  }
};

export const deleteSale = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const sale = await prisma.sale.findUnique({
      where: { id: id as string },
      include: { items: true }
    });

    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });

    // Restock items if the sale was not already deleted or refunded
    if (sale.status !== 'DELETED' && sale.status !== 'REFUNDED') {
      const allProductIds: number[] = Array.from(new Set((sale as any).items.map((i: any) => i.productId)));
      const productMeta = await prisma.product.findMany({
        where: { id: { in: allProductIds } },
        select: { id: true, isService: true }
      });
      const serviceStatusMap = new Map(productMeta.map(p => [p.id, p.isService]));

      await prisma.$transaction(async (tx) => {
        for (const item of (sale as any).items) {
          if (!serviceStatusMap.get(item.productId)) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { increment: item.quantity } }
            });
          }
        }
      });
    }

    await prisma.sale.update({
      where: { id: id as string },
      data: { status: 'DELETED', updatedAt: new Date() }
    });

    await AuditService.log({
      userId: user.id,
      action: 'DELETE_SALE',
      entityType: 'SALE',
      entityId: id as string,
      details: 'Sale soft-deleted'
    });

    return res.status(200).json({ success: true, message: 'Sale deleted' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete sale', error: error.message });
  }
};
