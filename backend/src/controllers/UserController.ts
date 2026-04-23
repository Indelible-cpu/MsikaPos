import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const loginUser = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!user || user.deleted) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Handle PHP bcrypt hashes ($2y$) by converting to Node-compatible ($2a$)
    const normalizedHash = user.password.replace(/^\$2y\$/, '$2a$');
    const validPassword = await bcrypt.compare(password, normalizedHash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role.name, branchId: user.branchId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role.name,
        branch_id: user.branchId,
      },
    });
  } catch (error: any) {
    console.error('Login Error Details:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Login failed', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
};


export const fetchUsers = async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const where: any = { deleted: false };
    if (user.role !== 'SUPERADMIN' && user.branchId) {
      where.branchId = user.branchId;
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        role: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: users.map((u: any) => ({
        id: u.id,
        username: u.username,
        role: u.role.name,
        branch_id: u.branchId,
        branch_name: u.branch?.name || 'N/A',
        createdAt: u.createdAt,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
};

export const saveUser = async (req: Request, res: Response) => {
  const { id, username, password, roleId, branchId } = req.body;

  try {
    if (id) {
      // Update
      const data: any = {
        username,
        roleId: parseInt(roleId),
        branchId: branchId ? parseInt(branchId) : null,
      };

      if (password) {
        data.password = await bcrypt.hash(password, 10);
      }

      await prisma.user.update({
        where: { id: parseInt(id) },
        data,
      });

      return res.status(200).json({ success: true, message: "User updated" });
    } else {
      // Create
      if (!password) return res.status(400).json({ message: "Password required" });

      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          roleId: parseInt(roleId),
          branchId: branchId ? parseInt(branchId) : null,
        },
      });

      return res.status(201).json({ success: true, message: "User created" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to save user', error: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.user.update({
      where: { id: parseInt(id as string) },
      data: { deleted: true },
    });

    return res.status(200).json({ success: true, message: "User deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
};
