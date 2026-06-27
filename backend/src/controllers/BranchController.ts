import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const BranchController = {
  // Get all branches (Businesses)
  async getBranches(req: Request, res: Response) {
    try {
      const { minimal } = req.query;
      const businesses = await prisma.business.findMany({
        orderBy: { createdAt: 'asc' }
      });

      const branches = businesses.map(b => {
        const settings = b.settings ? (b.settings as any) : {};
        return {
          id: b.id,
          name: b.name,
          address: settings.address || '',
          phone: settings.phone || '',
          email: settings.email || '',
          facebook: settings.facebook || '',
          instagram: settings.instagram || '',
          whatsapp: settings.whatsapp || '',
          slogan: settings.slogan || '',
          logo: settings.logo || '',
          managerName: settings.managerName || '',
          tinNumber: settings.tinNumber || '',
          openingTime: settings.openingTime || '08:00',
          closingTime: settings.closingTime || '17:00',
          status: settings.status || 'Active'
        };
      });

      if (minimal) {
        return res.json({ success: true, data: branches.map(b => ({ id: b.id, name: b.name })) });
      }

      res.json({ success: true, data: branches });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create a new branch (Business)
  async createBranch(req: Request, res: Response) {
    try {
      const { name, ...settings } = req.body;
      
      const newBusiness = await prisma.business.create({
        data: {
          name: name || 'New Branch',
          type: 'BRANCH',
          settings: settings
        }
      });

      res.json({ success: true, data: newBusiness });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update a branch
  async updateBranch(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, ...settings } = req.body;

      const business = await prisma.business.findUnique({ where: { id: Number(id) } });
      if (!business) return res.status(404).json({ success: false, message: 'Branch not found' });

      // Merge settings
      const existingSettings = business.settings ? (business.settings as any) : {};
      const newSettings = { ...existingSettings, ...settings };

      const updated = await prisma.business.update({
        where: { id: Number(id) },
        data: {
          name: name || business.name,
          settings: newSettings
        }
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Delete a branch
  async deleteBranch(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // Check if trying to delete the only branch
      const count = await prisma.business.count();
      if (count <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot delete the last branch' });
      }

      await prisma.business.delete({ where: { id: Number(id) } });
      res.json({ success: true, message: 'Branch deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
