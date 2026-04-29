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
      /* 
      try {
        await api.get('/ping', { timeout: 5000 });
      } catch (_e) {
        throw new Error('Server is unreachable. Please wait 30s and try again.');
      }
      */

      const response = await api.post('/sync', {
        sales: unsyncedSales,
        deviceId,
        lastSyncTimestamp
      }, { timeout: 30000 }); // Give it 30 seconds to process

      if (response.data.success) {
        const saleIds = unsyncedSales.map(s => s.id);
        if (saleIds.length > 0) {
          await db.salesQueue.where('id').anyOf(saleIds).modify({ synced: 1 });
        }
        
        const { products, categories } = response.data.updates;
        if (products && products.length > 0) await db.products.bulkPut(products);
        if (categories && categories.length > 0) await db.categories.bulkPut(categories);

        localStorage.setItem('lastSyncTimestamp', response.data.serverTime);
        return true;
      }
      throw new Error(response.data.message || 'Server rejected sync');
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number, data?: { message?: string } }, message?: string };
      const status = axiosError.response?.status;
      const message = axiosError.response?.data?.message || axiosError.message;
      console.error('Sync Error Payload:', axiosError.response?.data);
      console.error('Sync Error Summary:', { status, message });
      throw new Error(status ? `${status}: ${message}` : message);
    }
  },

  async checkConnection() {
    return navigator.onLine;
  },

  async pushProduct(product: { id: number; name: string; sku: string; costPrice: number; sellPrice: number; quantity: number; categoryId: number; isService?: boolean; imageUrl?: string; discount?: number; discountType?: string; discountValue?: number; discountStartDate?: string; discountEndDate?: string }) {
    try {
      await api.post('/products', {
        id: product.id,
        name: product.name,
        sku: product.sku,
        cost_price: product.costPrice,
        sell_price: product.sellPrice,
        quantity: product.quantity,
        category_id: product.categoryId,
        is_service: product.isService || false,
        imageUrl: product.imageUrl || null,
        discount: product.discount || 0,
        discount_rate: product.discount || 0,
        discount_type: product.discountType,
        discount_value: product.discountValue,
        discount_start_date: product.discountStartDate,
        discount_end_date: product.discountEndDate,
      });
      return true;
    } catch (error: unknown) {
      console.error('Product sync error:', error);
      return false;
    }
  }
};
