import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const listExpenses = async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const where: any = {};
    if (user.role !== 'SUPER_ADMIN' && user.branchId) {
      where.branchId = user.branchId;
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { user: { select: { username: true, fullname: true } } },
      orderBy: { expenseDate: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: expenses.map((e: any) => ({
        id: e.id,
        category: e.category,
        amount: Number(e.amount),
        description: e.description,
        paymentMethod: e.paymentMethod,
        date: e.expenseDate,
        username: e.user?.username || '',
        branchId: e.branchId,
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveExpense = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { category, amount, description, paymentMethod, expenseDate } = req.body;

  try {
    const expense = await prisma.expense.create({
      data: {
        category,
        amount,
        description,
        paymentMethod: paymentMethod || 'Cash',
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        userId: user.id,
        branchId: user.branchId || null,
      }
    });
    return res.status(201).json({ success: true, data: expense });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.expense.delete({ where: { id: parseInt(id as string) } });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
