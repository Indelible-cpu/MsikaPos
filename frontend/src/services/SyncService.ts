import { apiFetch } from '../api/apiFetch';
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

    // Handle session invalidation event from apiFetch
    window.addEventListener('auth:session-invalid', () => {
      console.warn('🔓 Session expired or invalid. Redirecting to login.');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('activeBranchId');
      window.location.href = '/staff/login';
    });

    // Initial sync
    if (navigator.onLine) {
      this.pushSales().catch(console.error);
    }
  },

  async pushSales() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('📡 Sync skipped: No authentication token found.');
      this.isSyncing = false;
      return false;
    }
    
    if (this.isSyncing) return false;
    this.isSyncing = true;

    try {
      // Fetch all unsynced records
      const unsyncedSales = await db.salesQueue.where('synced').equals(0).toArray();
      const unsyncedExpenses = await db.expenses.where('synced').equals(0).toArray();
      const unsyncedCustomers = await db.customers.where('synced').equals(0).toArray();
      const unsyncedPayments = await db.debtPayments.where('synced').equals(0).toArray();

      const hasLocalChanges = unsyncedSales.length > 0 || unsyncedExpenses.length > 0 || 
                             unsyncedCustomers.length > 0 || unsyncedPayments.length > 0;

      if (hasLocalChanges) {
        console.log(`🔄 Syncing: ${unsyncedSales.length} sales, ${unsyncedExpenses.length} expenses, ${unsyncedCustomers.length} customers...`);
      } else {
        console.log('🔄 Checking for remote updates...');
      }

      const deviceId = localStorage.getItem('deviceId') || 'unknown';
      const rawTimestamp = localStorage.getItem('lastSyncTimestamp');
      let lastSyncTimestamp = rawTimestamp;
      
      if (rawTimestamp) {
        // Subtract 5 minutes buffer to account for server/client clock skew
        const date = new Date(rawTimestamp);
        date.setMinutes(date.getMinutes() - 5);
        lastSyncTimestamp = date.toISOString();
      }

      const data = await apiFetch('/sync', {
        method: 'POST',
        body: JSON.stringify({
          sales: unsyncedSales,
          expenses: unsyncedExpenses,
          customers: unsyncedCustomers,
          debtPayments: unsyncedPayments,
          deviceId,
          lastSyncTimestamp
        }),
        timeout: 45000 
      });

      if (data.success) {
        // Mark all as synced
        if (unsyncedSales.length > 0) {
          const ids = unsyncedSales.map(s => s.id);
          await db.salesQueue.where('id').anyOf(ids).modify({ synced: 1 });
        }
        if (unsyncedExpenses.length > 0) {
          const ids = unsyncedExpenses.map(e => e.id);
          await db.expenses.where('id').anyOf(ids).modify({ synced: 1 });
        }
        if (unsyncedCustomers.length > 0) {
          const ids = unsyncedCustomers.map(c => c.id);
          await db.customers.where('id').anyOf(ids).modify({ synced: 1 });
        }
        if (unsyncedPayments.length > 0) {
          const ids = unsyncedPayments.map(p => p.id);
          await db.debtPayments.where('id').anyOf(ids).modify({ synced: 1 });
        }
        
        const { products, categories } = data.updates;
        if (products && products.length > 0) await db.products.bulkPut(products);
        if (categories && categories.length > 0) await db.categories.bulkPut(categories);

        localStorage.setItem('lastSyncTimestamp', data.serverTime);
        console.log('✅ Power Sync Completed');
        return true;
      }
      
      throw new Error(data.message || 'Server rejected sync');
    } catch (error: any) {
      console.error('📡 Sync Error:', error.data || error.message);
      return false;
    } finally {
      this.isSyncing = false;
    }
  },

  async checkConnection() {
    return navigator.onLine;
  },

  async pushProduct(product: any) {
    try {
      const data = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          id: product.id,
          name: product.name,
          sku: product.sku,
          cost_price: product.cost_price ?? product.costPrice,
          sell_price: product.sell_price ?? product.sellPrice,
          quantity: product.quantity,
          deleted: product.deleted ?? false,
          category_id: product.category_id ?? product.categoryId,
          is_service: product.is_service ?? product.isService ?? false,
          imageUrl: product.imageUrl || null,
          discount: product.discount || 0,
          discount_rate: product.discount_rate ?? product.discount ?? 0,
          discount_type: product.discount_type ?? product.discountType,
          discount_value: product.discount_value ?? product.discountValue,
          discount_start_date: product.discount_start_date ?? product.discountStartDate,
          discount_end_date: product.discount_end_date ?? product.discountEndDate,
        })
      });

      const serverId = data?.data?.id || product.id;

      // Update local database immediately with the correct server ID
      await db.products.put({
        ...product,
        id: serverId,
        name: product.name,
        sku: product.sku,
        quantity: product.quantity,
        costPrice: product.cost_price ?? product.costPrice ?? 0,
        sellPrice: product.sell_price ?? product.sellPrice ?? 0,
        categoryId: (product.category_id ?? product.categoryId) || 0,
        isService: product.is_service ?? product.isService ?? false,
        status: 'ACTIVE',
        createdAt: product.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // If the server assigned a different ID (creation), remove the temporary one
      if (serverId !== product.id) {
        await db.products.delete(product.id);
      }

      return true;
    } catch (error: unknown) {
      console.error('Product sync error:', error);
      return false;
    }
  }
};

