import { db } from '../db/posDB';

export class AuditService {
  static async log(action: string, details: string = '', type: 'Info' | 'Warning' | 'Error' = 'Info') {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      await db.auditLogs.add({
        id: crypto.randomUUID(),
        userId: user?.id || 'anonymous',
        username: user?.username || 'anonymous',
        action,
        details,
        type,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  }

  static async getLogs() {
    return await db.auditLogs.orderBy('createdAt').reverse().toArray();
  }
}
