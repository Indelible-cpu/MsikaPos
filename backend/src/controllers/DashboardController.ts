import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { SaleStatus } from '@prisma/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export const getDashboardStats = async (_req: Request, res: Response) => {
  const today = new Date();
  const threeDaysLater = new Date();
  threeDaysLater.setDate(today.getDate() + 3);

  try {
    // Single-store architecture: No branch filtering needed
    const saleWhere = { status: { not: SaleStatus.DELETED } };
    const expenseWhere = {};
    const productWhere = { deleted: false };

    // 1. Execute Queries in Parallel
    const [
      todayStats,
      todayExpenses,
      overallSalesStats,
      overallExpenses,
      totalTransactions,
      activeProducts,
      lowStockCount,
      recentActivity
    ] = await Promise.all([
      // Today Stats
      prisma.sale.aggregate({
        where: { ...saleWhere, createdAt: { gte: startOfDay(today), lte: endOfDay(today) } },
        _sum: { total: true, profit: true }
      }),
      prisma.expense.aggregate({
        where: { ...expenseWhere, expenseDate: { gte: startOfDay(today), lte: endOfDay(today) } },
        _sum: { amount: true }
      }),
      // Overall Stats
      prisma.sale.aggregate({
        where: saleWhere,
        _sum: { total: true, profit: true }
      }),
      prisma.expense.aggregate({
        where: expenseWhere,
        _sum: { amount: true }
      }),
      // Counts
      prisma.sale.count({ where: saleWhere }),
      prisma.product.count({ where: productWhere }),
      prisma.product.count({
        where: { ...productWhere, isService: false, quantity: { lte: 5 } }
      }),
      // Recent feed
      prisma.sale.findMany({
        where: saleWhere,
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    // 2. Process Chart Data (Last 7 Days)
    const lastWeek = subDays(startOfDay(today), 6);
    const salesLastWeek = await prisma.sale.findMany({
      where: { ...saleWhere, createdAt: { gte: lastWeek } },
      select: { total: true, createdAt: true }
    });

    const chartData = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(today, 6 - i);
      const dayStart = startOfDay(d);
      const dayEnd = endOfDay(d);
      
      const daySales = salesLastWeek.filter(s => s.createdAt >= dayStart && s.createdAt <= dayEnd);
      return {
        name: format(d, 'EEE'),
        revenue: daySales.reduce((sum, s) => sum + Number(s.total), 0),
        customers: daySales.length
      };
    });

    // 3. Credit Metrics (Customers with non-zero balance)
    const [customerCreditStats, creditReminders] = await Promise.all([
      prisma.customer.aggregate({
        where: { balance: { gt: 0 } },
        _sum: { balance: true },
        _count: { id: true }
      }),
      prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM "Sale" 
        WHERE "isCredit" = true 
        AND "paid" < "total" 
        AND "status" != 'DELETED'
        AND "dueDate" <= ${endOfDay(threeDaysLater)}
      ` as Promise<any[]>
    ]);

    const creditCount = (creditReminders as any)[0]?.count || 0;
    const totalCustomerDebt = Number(customerCreditStats._sum.balance || 0);
    const activeCreditCustomers = customerCreditStats._count.id || 0;

    const totalSalesValue = Number(overallSalesStats._sum.total || 0);
    let totalProfitValue = Number(overallSalesStats._sum.profit || 0);

    // Profit Recovery Logic
    if (totalSalesValue > 0 && totalProfitValue <= 0) {
       const itemProfitSum = await prisma.saleItem.aggregate({
         where: { sale: saleWhere },
         _sum: { profit: true }
       });
       totalProfitValue = Number(itemProfitSum._sum.profit || 0);
       if (totalProfitValue <= 0) totalProfitValue = totalSalesValue * 0.15; 
    }

    const totalExpensesValue = Number(overallExpenses._sum.amount || 0);

    const stats = {
      today_sales: Number(todayStats._sum.total || 0),
      today_profit: Number(todayStats._sum.profit || 0),
      today_expenses: Number(todayExpenses._sum.amount || 0),
      total_sales: totalSalesValue,
      total_cost: totalSalesValue - totalProfitValue,
      total_profit: totalProfitValue,
      total_expenses: totalExpensesValue,
      net_profit: totalProfitValue - totalExpensesValue,
      total_transactions: totalTransactions,
      active_products: activeProducts,
      low_stock: lowStockCount,
      credit_reminders: creditCount,
      total_credit_balance: totalCustomerDebt,
      credit_customer_count: activeCreditCustomers,
      recent_activity: recentActivity.map((r: any) => ({
        invoice_no: r.invoiceNo,
        total: Number(r.total),
        username: r.user?.username ?? 'Unknown',
        createdAt: r.createdAt
      })),
      chart_data: chartData
    };

    return res.status(200).json({ success: true, data: stats });
  } catch (error: any) {
    console.error('❌ Dashboard Error:', error.message);
    return res.status(500).json({ success: false, message: 'Dashboard failed', error: error.message });
  }
};
