import api from '../api/client';
import { db } from '../db/posDB';

export const SyncService = {
  async pushSales() {
    const unsyncedSales = await db.salesQueue
      .where('synced')
      .equals(0)
      .toArray();

    const deviceId = localStorage.getItem('deviceId') || 'unknown';
    const lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp');

    try {
      const response = await api.post('/sync', {
        sales: unsyncedSales,
        deviceId,
        lastSyncTimestamp
      });

      if (response.data.success) {
        // Mark as synced locally
        const saleIds = unsyncedSales.map(s => s.id);
        if (saleIds.length > 0) {
          await db.salesQueue.where('id').anyOf(saleIds).modify({ synced: 1 });
        }
        
        // Process delta updates from server (Products/Categories)
        const { products, categories } = response.data.updates;
        
        if (products && products.length > 0) {
          await db.products.bulkPut(products);
        }
        
        if (categories && categories.length > 0) {
          await db.categories.bulkPut(categories);
        }

        localStorage.setItem('lastSyncTimestamp', response.data.serverTime);
        return true;
      }
      throw new Error(response.data.message || 'Sync failed');
    } catch (error: any) {
      console.error('Sync Error:', error);
      throw error;
    }
  },

  async checkConnection() {
    return navigator.onLine;
  }
};
