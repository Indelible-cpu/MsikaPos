import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

export const registerCustomer = async (req: Request, res: Response) => {
  const { username, password, fullname, phone } = req.body;

  try {
    const existing = await prisma.customer.findUnique({ where: { username: username } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const customer = await prisma.customer.create({
      data: {
        username,
        password: hashedPassword,
        fullname: fullname || username,
        phone: phone || '',
      }
    });

    const token = jwt.sign(
      { id: customer.id, username: customer.username, role: 'CUSTOMER' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      customer: {
        id: customer.id,
        username: customer.username,
        fullname: customer.fullname,
        role: 'CUSTOMER'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const loginCustomer = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const customer = await prisma.customer.findUnique({ where: { username } });
    if (!customer || !customer.password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, customer.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: customer.id, username: customer.username, role: 'CUSTOMER' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      token,
      customer: {
        id: customer.id,
        username: customer.username,
        fullname: customer.fullname,
        role: 'CUSTOMER'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createInquiry = async (req: AuthRequest, res: Response) => {
  const { items } = req.body;
  const customerId = req.user?.id;

  if (!customerId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const inquiry = await prisma.inquiry.create({
      data: {
        customerId,
        items: JSON.stringify(items),
        status: 'PENDING'
      },
      include: { customer: true }
    });

    res.status(201).json({ success: true, data: inquiry });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listInquiries = async (req: AuthRequest, res: Response) => {
  const customerId = req.user?.id;
  const role = req.user?.role;

  try {
    let inquiries;
    if (role === 'CUSTOMER') {
      inquiries = await prisma.inquiry.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // Staff view
      inquiries = await prisma.inquiry.findMany({
        include: { customer: true },
        orderBy: { createdAt: 'desc' }
      });
    }

    res.status(200).json({ success: true, data: inquiries });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateInquiryStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const inquiry = await prisma.inquiry.update({
      where: { id: Number(id) },
      data: { status }
    });
    res.status(200).json({ success: true, data: inquiry });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
