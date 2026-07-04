import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// ─── GET ALL EMPLOYEES WITH SALARY CONFIGS ───────────────────────────────────
export const getEmployees = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { deleted: false, role: { name: { in: ['SUPER_ADMIN', 'ADMIN', 'CASHIER'] } } },
      select: {
        id: true, username: true, fullname: true, phone: true, role: { select: { name: true } },
        salaryConfig: true
      },
      orderBy: { fullname: 'asc' }
    });
    return res.json({ success: true, data: users });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// ─── UPSERT SALARY CONFIG ────────────────────────────────────────────────────
export const setSalaryConfig = async (req: Request, res: Response) => {
  const { userId, basicSalary, allowances, deductions, currency, notes } = req.body;
  if (!userId || basicSalary === undefined) {
    return res.status(400).json({ success: false, message: 'userId and basicSalary are required' });
  }
  try {
    const config = await prisma.employeeSalaryConfig.upsert({
      where: { userId: Number(userId) },
      create: { userId: Number(userId), basicSalary, allowances: allowances || 0, deductions: deductions || 0, currency: currency || 'MWK', notes },
      update: { basicSalary, allowances: allowances || 0, deductions: deductions || 0, currency: currency || 'MWK', notes }
    });
    return res.json({ success: true, data: config });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// ─── LIST ADVANCES ────────────────────────────────────────────────────────────
export const getAdvances = async (_req: Request, res: Response) => {
  try {
    const advances = await prisma.salaryAdvance.findMany({
      include: {
        user: { select: { id: true, username: true, fullname: true } },
        approver: { select: { id: true, fullname: true } }
      },
      orderBy: { requestedAt: 'desc' }
    });
    return res.json({ success: true, data: advances });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// ─── CREATE ADVANCE REQUEST ───────────────────────────────────────────────────
export const createAdvance = async (req: Request, res: Response) => {
  const { userId, amount, reason } = req.body;
  if (!userId || !amount) return res.status(400).json({ success: false, message: 'userId and amount required' });
  try {
    const advance = await prisma.salaryAdvance.create({
      data: { userId: Number(userId), amount, reason }
    });
    return res.json({ success: true, data: advance });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// ─── UPDATE ADVANCE STATUS ────────────────────────────────────────────────────
export const updateAdvance = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const user = (req as any).user;
  try {
    const data: any = { status };
    if (status === 'APPROVED') { data.approvedAt = new Date(); data.approvedBy = user.id; }
    if (status === 'REPAID')   { data.repaidAt = new Date(); }
    const advance = await prisma.salaryAdvance.update({ where: { id: Number(id) }, data });
    return res.json({ success: true, data: advance });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// ─── GENERATE PAYSLIP ─────────────────────────────────────────────────────────
export const generatePayslip = async (req: Request, res: Response) => {
  const { userId, month, year } = req.body;
  if (!userId || !month || !year) return res.status(400).json({ success: false, message: 'userId, month, year required' });
  try {
    const config = await prisma.employeeSalaryConfig.findUnique({ where: { userId: Number(userId) } });
    if (!config) return res.status(404).json({ success: false, message: 'No salary config for this employee. Please configure salary first.' });

    // Sum all APPROVED advances in this month/year that haven't been deducted yet
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const advances = await prisma.salaryAdvance.findMany({
      where: { userId: Number(userId), status: 'APPROVED', approvedAt: { gte: startOfMonth, lte: endOfMonth } }
    });
    const advanceDeduct = advances.reduce((s: number, a: any) => s + Number(a.amount), 0);
    const netPay = Number(config.basicSalary) + Number(config.allowances) - Number(config.deductions) - advanceDeduct;

    const payslip = await prisma.payslip.upsert({
      where: { userId_month_year: { userId: Number(userId), month: Number(month), year: Number(year) } },
      create: {
        userId: Number(userId), month: Number(month), year: Number(year),
        basicSalary: config.basicSalary, allowances: config.allowances, deductions: config.deductions,
        advanceDeduct, netPay, status: 'DRAFT'
      },
      update: { basicSalary: config.basicSalary, allowances: config.allowances, deductions: config.deductions, advanceDeduct, netPay, generatedAt: new Date() },
      include: { user: { select: { id: true, username: true, fullname: true, phone: true, role: { select: { name: true } } } } }
    });

    // Mark the deducted advances as REPAID
    if (advances.length > 0) {
      await prisma.salaryAdvance.updateMany({
        where: { id: { in: advances.map((a: any) => a.id) } },
        data: { status: 'REPAID', repaidAt: new Date() }
      });
    }

    return res.json({ success: true, data: payslip });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// ─── LIST PAYSLIPS ────────────────────────────────────────────────────────────
export const getPayslips = async (req: Request, res: Response) => {
  const { month, year } = req.query;
  try {
    const where: any = {};
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);
    const payslips = await prisma.payslip.findMany({
      where,
      include: { user: { select: { id: true, username: true, fullname: true, role: { select: { name: true } } } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
    return res.json({ success: true, data: payslips });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
