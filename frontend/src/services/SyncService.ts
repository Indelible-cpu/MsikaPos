import api from '../api/client';
import { db } from '../db/posDB';

export const SyncService = {
  isSyncing: false,

  async init() {
    window.addEventListener('online', () => {
      console.log('🌐 System Online: Triggering Power Sync...');
      this.pushSales().catch(console.error);
    });

    window.addEventListener('offline', () => {
      console.log('📡 System Offline: Entering local-only mode.');
    });

    // Initial sync
    if (navigator.onLine) {
      this.pushSales().catch(console.error);
    }
  },

  async pushSales() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const unsyncedSales = await db.salesQueue
        .where('synced')
        .equals(0)
        .toArray();

      if (unsyncedSales.length === 0) {
        this.isSyncing = false;
        return true;
      }

      console.log(`🔄 Syncing ${unsyncedSales.length} sales...`);

      const deviceId = localStorage.getItem('deviceId') || 'unknown';
      const lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp');

      const response = await api.post('/sync', {
        sales: unsyncedSales,
        deviceId,
        lastSyncTimestamp
      }, { timeout: 30000 });

      if (response.data.success) {
        const saleIds = unsyncedSales.map(s => s.id);
        await db.salesQueue.where('id').anyOf(saleIds).modify({ synced: 1 });
        
        const { products, categories } = response.data.updates;
        if (products && products.length > 0) await db.products.bulkPut(products);
        if (categories && categories.length > 0) await db.categories.bulkPut(categories);

        localStorage.setItem('lastSyncTimestamp', response.data.serverTime);
        console.log('✅ Power Sync Completed');
        return true;
      }
      throw new Error(response.data.message || 'Server rejected sync');
    } catch (error: unknown) {
      const err = error as { message: string };
      console.warn('⚠️ Sync deferred:', err.message);
      return false;
    } finally {
      this.isSyncing = false;
    }
  },

  async checkConnection() {
    return navigator.onLine;
  },

  async pushProduct(product: { 
    id: number; 
    name: string; 
    sku: string; 
    quantity: number;
    imageUrl?: string | null;
    cost_price?: number;
    costPrice?: number;
    sell_price?: number;
    sellPrice?: number;
    category_id?: number;
    categoryId?: number;
    is_service?: boolean;
    isService?: boolean;
    discount?: number;
    discount_rate?: number;
    discount_type?: string;
    discountType?: string;
    discount_value?: number;
    discountValue?: number;
    discount_start_date?: string;
    discountStartDate?: string;
    discount_end_date?: string;
    discountEndDate?: string;
  }) {
    try {
      await api.post('/products', {
        id: product.id,
        name: product.name,
        sku: product.sku,
        cost_price: product.cost_price ?? product.costPrice,
        sell_price: product.sell_price ?? product.sellPrice,
        quantity: product.quantity,
        category_id: product.category_id ?? product.categoryId,
        is_service: product.is_service ?? product.isService ?? false,
        imageUrl: product.imageUrl || null,
        discount: product.discount || 0,
        discount_rate: product.discount_rate ?? product.discount ?? 0,
        discount_type: product.discount_type ?? product.discountType,
        discount_value: product.discount_value ?? product.discountValue,
        discount_start_date: product.discount_start_date ?? product.discountStartDate,
        discount_end_date: product.discount_end_date ?? product.discountEndDate,
      });
      return true;
    } catch (error: unknown) {
      console.error('Product sync error:', error);
      return false;
    }
  }
};
