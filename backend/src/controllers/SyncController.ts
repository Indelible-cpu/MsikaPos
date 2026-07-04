import type { Request, Response } from 'express';
import { SyncService } from '../services/SyncService';
import { getClientIp } from '../lib/ipHelper';

export const syncData = async (req: Request, res: Response) => {
  const { sales, expenses, customers, debtPayments, deviceId, lastSyncTimestamp } = req.body;
  const user = (req as any).user;
  const ipInfo = getClientIp(req);

  try {
    const result = await SyncService.syncData({
      sales,
      expenses,
      customers,
      debtPayments,
      deviceId,
      lastSyncTimestamp,
      user,
      ipInfo
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Sync Error Deep Trace:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Sync failed', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
};
