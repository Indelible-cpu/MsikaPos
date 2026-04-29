import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export const getDashboardStats = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const today = new Date();
  const threeDaysLater = new Date();
  threeDaysLater.setDate(today.getDate() + 3);

  try {
    const where: any = { status: { not: 'DELETED' } };
    // Strict Branch Isolation
    if (user.role === 'SUPER_ADMIN') {
      if (user.branchId) where.branchId = user.branchId;
    } else {
      where.branchId = user.branchId;
    }

    // 1. Today's Sales
    const todaySales = await prisma.sale.aggregate({
      where: {
        ...where,
        createdAt: {
          gte: startOfDay(today),
          lte: endOfDay(today),
        },
      },
      _sum: { total: true },
    });

    // 2. Total Transactions
    const totalTransactions = await prisma.sale.count({ where });

    // 3. Active Products
    const activeProducts = await prisma.product.count({ 
      where: { 
        deleted: false,
        branchId: where.branchId 
      } 
    });

    // 4. Low Stock Alerts
    const lowStock = await prisma.product.count({
      where: {
        deleted: false,
        isService: false,
        quantity: { lte: 5 },
        branchId: where.branchId
      }
    });

    // 5. Credit Reminders (Unpaid credit sales due within 3 days)
    const unpaidCredits = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM "Sale" 
      WHERE "isCredit" = true 
      AND "paid" < "total" 
      AND "status" != 'DELETED'
      AND "dueDate" <= ${endOfDay(threeDaysLater)}
      AND (${where.branchId}::int IS NULL OR "branchId" = ${where.branchId}::int)
    ` as any;
    const creditCount = unpaidCredits[0]?.count || 0;

    // 6. Recent Activity
    const recentActivity = await prisma.sale.findMany({
      where,
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // 7. Optimized Chart Data (Last 7 Days) in 1 query
    const lastWeek = subDays(startOfDay(today), 6);
    const salesLastWeek = await prisma.sale.findMany({
      where: {
        ...where,
        createdAt: { gte: lastWeek }
      },
      select: {
        total: true,
        createdAt: true
      }
    });

    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const dayStart = startOfDay(d);
      const dayEnd = endOfDay(d);
      
      const total = salesLastWeek
        .filter(s => s.createdAt >= dayStart && s.createdAt <= dayEnd)
        .reduce((sum, s) => sum + Number(s.total), 0);

      chartData.push({
        date: format(d, 'EEE'),
        total: total
      });
    }

    // Calculate total profit for the period (simplified to today's profit)
    const todayProfit = await prisma.sale.aggregate({
      where: {
        ...where,
        createdAt: {
          gte: startOfDay(today),
          lte: endOfDay(today),
        },
      },
      _sum: { profit: true },
    });

    return res.status(200).json({
      success: true,
      message: "Stats fetched",
      data: {
        today_sales: Number(todaySales._sum.total || 0),
        total_profit: Number(todayProfit._sum.profit || 0),
        total_transactions: totalTransactions,
        active_products: activeProducts,
        low_stock: lowStock,
        credit_reminders: creditCount,
        recent_activity: recentActivity.map((r: any) => ({
          invoice_no: r.invoiceNo,
          total: Number(r.total),
          username: r.user.username
        })),
        chart_data: chartData
      }
    });
  } catch (error: any) {
    console.error('Dashboard Stats Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats', error: error.message });
  }
};
