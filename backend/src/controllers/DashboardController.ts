import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export const getDashboardStats = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const today = new Date();
  const threeDaysLater = new Date();
  threeDaysLater.setDate(today.getDate() + 3);

  console.log('📊 Fetching Dashboard Stats for user:', { id: user.id, role: user.role, branchId: user.branchId });

  try {
    const where: any = { status: { not: 'DELETED' } };
    const productWhere: any = { deleted: false };

    // Strict Branch Isolation
    if (user.role === 'SUPER_ADMIN') {
      if (user.branchId) {
        where.branchId = user.branchId;
        productWhere.branchId = user.branchId;
      }
    } else {
      where.branchId = user.branchId;
      productWhere.branchId = user.branchId;
    }

    const bId = where.branchId || null;

    // 1. Today's Sales & Profit
    const todayStats = await prisma.sale.aggregate({
      where: {
        ...where,
        createdAt: {
          gte: startOfDay(today),
          lte: endOfDay(today),
        },
      },
      _sum: { total: true, profit: true },
    });

    // 2. Today's Expenses
    const todayExpenses = await prisma.expense.aggregate({
      where: {
        ...where,
        expenseDate: {
          gte: startOfDay(today),
          lte: endOfDay(today),
        },
      },
      _sum: { amount: true },
    });

    // 3. Overall Totals (For performance, we usually show this month or all-time)
    const overallStats = await prisma.sale.aggregate({
      where,
      _sum: { total: true, profit: true },
    });

    // 4. Total Cost Calculation
    const totalSales = Number(overallStats._sum.total || 0);
    const totalProfit = Number(overallStats._sum.profit || 0);
    const totalCost = totalSales - totalProfit;

    // 5. Total Transactions
    const totalTransactions = await prisma.sale.count({ where });

    // 6. Active Products
    const activeProducts = await prisma.product.count({ where: productWhere });

    // 7. Low Stock Alerts
    const lowStock = await prisma.product.count({
      where: {
        ...productWhere,
        isService: false,
        quantity: { lte: 5 },
      }
    });

    let creditCount = 0;
    try {
      const unpaidCredits = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM "Sale" 
        WHERE "isCredit" = true 
        AND "paid" < "total" 
        AND "status" != 'DELETED'
        AND "dueDate" <= ${endOfDay(threeDaysLater)}
        AND (${bId}::int IS NULL OR "branchId" = ${bId}::int)
      ` as { count: number }[];
      creditCount = unpaidCredits[0]?.count || 0;
    } catch (e) {
      console.warn('⚠️ Credit count query failed (schema mismatch?), defaulting to 0:', e);
    }

    // 9. Recent Activity
    const recentActivity = await prisma.sale.findMany({
      where,
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // 10. Chart Data (Last 7 Days)
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

      const count = salesLastWeek
        .filter(s => s.createdAt >= dayStart && s.createdAt <= dayEnd)
        .length;

      chartData.push({
        name: format(d, 'EEE'),
        revenue: total,
        customers: count
      });
    }

    const stats = {
      today_sales: Number(todayStats._sum.total || 0),
      today_profit: Number(todayStats._sum.profit || 0),
      today_expenses: Number(todayExpenses._sum.amount || 0),
      total_sales: totalSales,
      total_cost: totalCost,
      total_profit: totalProfit,
      total_transactions: totalTransactions,
      active_products: activeProducts,
      low_stock: lowStock,
      credit_reminders: creditCount,
      recent_activity: recentActivity.map((r: any) => ({
        invoice_no: r.invoiceNo,
        total: Number(r.total),
        username: r.user?.username ?? 'Unknown'
      })),
      chart_data: chartData
    };

    console.log('✅ Dashboard Stats success:', { transactions: totalTransactions, products: activeProducts });
    return res.status(200).json({ success: true, data: stats });
  } catch (error: any) {
    console.error('❌ Dashboard Stats Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats', error: error.message });
  }
};
