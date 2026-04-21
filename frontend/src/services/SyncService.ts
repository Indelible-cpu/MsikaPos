import axios from 'axios';
import { db } from '../db/posDB';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const SyncService = {
  async pushSales() {
    const unsyncedSales = await db.salesQueue
      .where('synced')
      .equals(0)
      .toArray();

    if (unsyncedSales.length === 0) return;

    const token = localStorage.getItem('token');
    const deviceId = localStorage.getItem('deviceId') || 'unknown';

    try {
      const lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp');
      
      const response = await axios.post(`${API_BASE_URL}/sync`, {
        sales: unsyncedSales,
        deviceId,
        lastSyncTimestamp
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Mark as synced locally
        const saleIds = unsyncedSales.map(s => s.id);
        await db.salesQueue.where('id').anyOf(saleIds).modify({ synced: 1 });
        
        // Process delta updates from server (Products/Categories)
        const { products, categories } = response.data.updates;
        
        if (products.length > 0) {
          await db.products.bulkPut(products);
        }
        
        if (categories.length > 0) {
          await db.categories.bulkPut(categories);
        }

        localStorage.setItem('lastSyncTimestamp', response.data.serverTime);
        return true;
      }
    } catch (error) {
      console.error('Failed to sync sales:', error);
      return false;
    }
  },

  async checkConnection() {
    return navigator.onLine;
  }
};
