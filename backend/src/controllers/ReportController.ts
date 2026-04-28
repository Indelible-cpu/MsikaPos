import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { endOfDay, startOfDay } from 'date-fns';

export const fetchTransactions = async (req: Request, res: Response) => {
  const { q, from, to, deleted, branch_id } = req.query;
  const user = (req as any).user;

  try {
    const where: any = {
      status: deleted === '1' ? 'DELETED' : { not: 'DELETED' },
    };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = startOfDay(new Date(from as string));
      if (to) where.createdAt.lte = endOfDay(new Date(to as string));
    }

    if (q) {
      where.OR = [
        { invoiceNo: { contains: q as string, mode: 'insensitive' } },
        { receiptNo: { contains: q as string, mode: 'insensitive' } },
        { user: { username: { contains: q as string, mode: 'insensitive' } } },
      ];
    }

    // Branch filtering logic
    if (user.role !== 'SUPER_ADMIN') {
      if (user.branchId) {
        where.branchId = user.branchId;
      }
    } else if (branch_id) {
      where.branchId = parseInt(branch_id as string);
    }

    const transactions = await prisma.sale.findMany({
      where,
      include: {
        user: { select: { username: true } },
        customer: { select: { fullname: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.status(200).json({
      success: true,
      message: "Transactions fetched",
      data: transactions.map((t: any) => ({
        ...t,
        cashier: t.user.username,
      })),
    });
  } catch (error: any) {
    console.error('Fetch Transactions Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch transactions', error: error.message });
  }
};

export const getSummary = async (req: Request, res: Response) => {
  const { from, to, branch_id } = req.query;
  const user = (req as any).user;

  try {
    const startDate = from ? startOfDay(new Date(from as string)) : startOfDay(new Date());
    const endDate = to ? endOfDay(new Date(to as string)) : endOfDay(new Date());

    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: 'COMPLETED',
    };

    if (user.role !== 'SUPER_ADMIN') {
      if (user.branchId) where.branchId = user.branchId;
    } else if (branch_id) {
      where.branchId = parseInt(branch_id as string);
    }

    const sales = await prisma.sale.aggregate({
      where,
      _count: { id: true },
      _sum: {
        total: true,
        profit: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Summary fetched",
      data: {
        total_sales: sales._count.id || 0,
        revenue: Number(sales._sum.total || 0),
        profit: Number(sales._sum.profit || 0),
      },
    });
  } catch (error: any) {
    console.error('Get Summary Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch summary', error: error.message });
  }
};
