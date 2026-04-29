import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { securityAlert } from '../middleware/security';

interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    branchId?: number | null;
  };
}

export const registerCustomer = async (req: Request, res: Response) => {
  const { username, password, fullname, phone } = req.body;

  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      await securityAlert(req.ip || 'unknown', 'RECONNAISSANCE', `Registration attempt with existing username: ${username}`);
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }

    // Ensure Customer Role exists
    const customerRole = await prisma.role.upsert({
      where: { name: 'CUSTOMER' },
      update: {},
      create: { 
        name: 'CUSTOMER',
        description: 'Standard customer access for storefront inquiries'
      }
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create User and Customer in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          password: hashedPassword,
          roleId: customerRole.id,
          fullname,
          phone,
          isVerified: true,
          mustChangePassword: false,
        }
      });

      const customer = await tx.customer.create({
        data: {
          fullname: fullname || username,
          phone: phone || '',
          userId: user.id
        }
      });

      return { user, customer };
    });

    const token = jwt.sign(
      { id: result.user.id, username: result.user.username, role: 'CUSTOMER' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      role: 'CUSTOMER',
      customer: {
        id: result.customer.id,
        username: result.user.username,
        fullname: result.customer.fullname,
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
    const user = await prisma.user.findUnique({ 
      where: { username },
      include: { role: true, customer: true }
    });

    if (!user || user.deleted) {
      await securityAlert(req.ip || 'unknown', 'BRUTE_FORCE', `Unified login failed: ${username}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const normalizedHash = user.password.replace(/^\$2y\$/, '$2a$');
    const validPassword = await bcrypt.compare(password, normalizedHash);
    
    if (!validPassword) {
      await securityAlert(req.ip || 'unknown', 'BRUTE_FORCE', `Unified incorrect password: ${username}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: `Account is ${user.status.toLowerCase()}` });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role.name, branchId: user.branchId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      token,
      role: user.role.name,
      customer: {
        id: user.customer?.id || user.id,
        username: user.username,
        fullname: user.fullname,
        role: user.role.name
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createInquiry = async (req: AuthRequest, res: Response) => {
  const { items } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const customer = await prisma.customer.findUnique({ where: { userId } });
    if (!customer) return res.status(404).json({ message: 'Customer profile not found' });

    const inquiry = await prisma.inquiry.create({
      data: {
        customerId: customer.id,
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
  const userId = req.user?.id;
  const role = req.user?.role;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    try {
      let inquiries;
      let total;

      if (role === 'CUSTOMER') {
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
        
        const customer = await prisma.customer.findUnique({ 
          where: { userId: userId as number } 
        });
        if (!customer) return res.status(200).json({ success: true, data: [], total: 0 });

        const whereInquiry: any = { 
          customerId: customer.id
        };
        if (userId !== customer.userId && req.user?.branchId) {
          whereInquiry.branchId = req.user.branchId;
        }

        total = await prisma.inquiry.count({ where: whereInquiry });
        inquiries = await prisma.inquiry.findMany({
          where: whereInquiry,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        });
      } else {
        // Staff view - Strict Branch Isolation
        const where: any = {};
        if (req.user?.role === 'SUPER_ADMIN') {
          if (req.user.branchId) where.branchId = req.user.branchId;
        } else {
          where.branchId = req.user?.branchId;
        }

        total = await prisma.inquiry.count({ where });
        inquiries = await prisma.inquiry.findMany({
          where,
          include: { 
            customer: {
              include: { user: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        });
      }

      res.status(200).json({ 
        success: true, 
        data: inquiries,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
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
