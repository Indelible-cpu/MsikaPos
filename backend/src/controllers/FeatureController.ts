import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getFeatureConfigs = async (req: Request, res: Response) => {
  const { branchId, role } = req.query;

  try {
    const configs = await prisma.featureConfig.findMany({
      where: {
        roleName: role as any,
        branchId: branchId ? parseInt(branchId as any) : null
      }
    });

    return res.status(200).json({ success: true, data: configs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch configs', error: error.message });
  }
};

export const updateFeatureConfig = async (req: Request, res: Response) => {
  const { featureKey, roleName, accessLevel, branchId } = req.body;

  try {
    const existing = await prisma.featureConfig.findFirst({
      where: {
        featureKey,
        roleName,
        branchId: branchId ? parseInt(branchId as any) : null
      }
    });

    let config;
    if (existing) {
      config = await prisma.featureConfig.update({
        where: { id: existing.id },
        data: { accessLevel }
      });
    } else {
      config = await prisma.featureConfig.create({
        data: {
          featureKey,
          roleName,
          accessLevel,
          branchId: branchId ? parseInt(branchId as any) : null
        }
      });
    }

    return res.status(200).json({ success: true, data: config });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to update config', error: error.message });
  }
};
