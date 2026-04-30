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
    const config = await prisma.featureConfig.upsert({
      where: {
        featureKey_roleName_branchId: {
          featureKey,
          roleName,
          branchId: branchId ? parseInt(branchId as any) : null
        }
      },
      update: { accessLevel },
      create: {
        featureKey,
        roleName,
        accessLevel,
        branchId: branchId ? parseInt(branchId as any) : null
      }
    });

    return res.status(200).json({ success: true, data: config });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to update config', error: error.message });
  }
};
