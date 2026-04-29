import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const fetchBranches = async (req: Request, res: Response) => {
  const { q, minimal } = req.query;
  const user = (req as any).user;

  try {
    if (minimal === '1') {
      const branches = await prisma.branch.findMany({
        where: { 
          status: 'ACTIVE',
          id: user.role === 'SUPER_ADMIN' ? undefined : user.branchId 
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      return res.status(200).json({ success: true, message: "Minimal branches fetched", data: branches });
    }

    const where: any = {};
    if (user.role === 'SUPER_ADMIN') {
      if (q) {
        where.OR = [
          { name: { contains: q as string, mode: 'insensitive' } },
          { location: { contains: q as string, mode: 'insensitive' } },
        ];
      }
    } else {
      where.id = user.branchId;
    }

    const branches = await prisma.branch.findMany({
      where,
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: branches.map((b) => ({
        ...b,
        staff_count: b._count.users,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch branches', error: error.message });
  }
};

export const saveBranch = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, message: "Forbidden: Super Admin access required" });
  }

  const { id, name, location, address, phone, email, facebook, slogan, logo, is_active, status } = req.body;

  const branchName = name;
  const branchLocation = location || address;

  if (!branchName || !branchLocation) {
    console.error('❌ Branch Save Validation Failed:', { branchName, branchLocation });
    return res.status(400).json({ success: false, message: "Name and location are required" });
  }

  try {
    // Map frontend status to backend enum
    let finalStatus = 'ACTIVE';
    if (status) {
      finalStatus = (status === 'ACTIVE') ? 'ACTIVE' : 'INACTIVE';
    } else if (is_active !== undefined) {
      finalStatus = is_active ? 'ACTIVE' : 'INACTIVE';
    }

    const data = {
      name: branchName,
      location: branchLocation,
      phone,
      email,
      facebook,
      slogan,
      logo,
      status: finalStatus as any,
    };

    if (id && !isNaN(parseInt(id))) {
      await prisma.branch.update({
        where: { id: parseInt(id) },
        data,
      });
      return res.status(200).json({ success: true, message: "Branch updated" });
    } else {
      await prisma.branch.create({
        data,
      });
      return res.status(201).json({ success: true, message: "Branch created" });
    }
  } catch (error: any) {
    console.error('❌ Branch Save Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to save branch', 
      error: error.message 
    });
  }
};

export const deleteBranch = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, message: "Forbidden: Super Admin access required" });
  }

  const { id } = req.params;

  try {
    const branchId = parseInt(id as string);
    const staffCount = await prisma.user.count({ where: { branchId } });

    if (staffCount > 0) {
      return res.status(400).json({ success: false, message: "Cannot delete branch with active staff. Reassign staff first." });
    }

    await prisma.branch.delete({ where: { id: branchId } });
    return res.status(200).json({ success: true, message: "Branch deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete branch', error: error.message });
  }
};
