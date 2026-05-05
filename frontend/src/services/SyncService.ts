import { apiFetch } from '../api/apiFetch';
import { db } from '../db/posDB';

interface ProductPayload {
  id: number;
  name: string;
  sku?: string;
  cost_price?: number;
  costPrice?: number;
  sell_price?: number;
  sellPrice?: number;
  quantity: number;
  deleted?: boolean;
  category_id?: number;
  categoryId?: number;
  is_service?: boolean;
  isService?: boolean;
  imageUrl?: string | null;
  discount?: number;
  discount_rate?: number;
  discount_type?: 'PERCENTAGE' | 'FIXED';
  discountType?: 'PERCENTAGE' | 'FIXED';
  discount_value?: number;
  discountValue?: number;
  discount_start_date?: string;
  discountStartDate?: string;
  discount_end_date?: string;
  discountEndDate?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
}

export const SyncService = {
  isSyncing: false,
  hasInitialized: false,

  async init() {
    if (this.hasInitialized) return;
    this.hasInitialized = true;

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

      // YIELD to the browser to prevent long-task violations
      await new Promise(resolve => setTimeout(resolve, 0));

      if (data.success) {
        const { products, categories, customers, expenses, debtPayments, sales } = data.updates;

        // 1. Mark local changes as synced (Atomic for local state consistency)
        await db.transaction('rw', [db.salesQueue, db.expenses, db.customers, db.debtPayments], async () => {
          if (unsyncedSales.length > 0) await db.salesQueue.where('id').anyOf(unsyncedSales.map(s => s.id)).modify({ synced: 1 });
          if (unsyncedExpenses.length > 0) await db.expenses.where('id').anyOf(unsyncedExpenses.map(e => e.id)).modify({ synced: 1 });
          if (unsyncedCustomers.length > 0) await db.customers.where('id').anyOf(unsyncedCustomers.map(c => c.id)).modify({ synced: 1 });
          if (unsyncedPayments.length > 0) await db.debtPayments.where('id').anyOf(unsyncedPayments.map(p => p.id)).modify({ synced: 1 });
        });

        // YIELD to browser
        await new Promise(resolve => setTimeout(resolve, 10));

        // 2. Apply remote updates per table to avoid locking the UI for too long
        if (products?.length > 0) {
          await db.products.bulkPut(products);
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        if (categories?.length > 0) {
          const currentCats = await db.categories.toArray();
          if (JSON.stringify(categories) !== JSON.stringify(currentCats)) {
            await db.categories.bulkPut(categories);
          }
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        if (customers?.length > 0) {
          const mapped = customers.map((c: any) => ({
            id: String(c.id),
            name: c.fullname,
            phone: c.phone,
            idNumber: c.idNumber,
            village: c.village,
            livePhoto: c.livePhoto,
            balance: Number(c.balance || 0),
            totalCreditAmount: Number(c.totalCreditAmount || 0),
            totalPaidAmount: Number(c.totalPaidAmount || 0),
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            synced: 1
          }));
          await db.customers.bulkPut(mapped);
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        if (expenses?.length > 0) {
          await db.expenses.bulkPut(expenses.map((e: any) => ({ ...e, date: e.expenseDate, synced: 1 })));
          await new Promise(resolve => setTimeout(resolve, 5));
        }

        if (debtPayments?.length > 0) {
          await db.debtPayments.bulkPut(debtPayments.map((p: any) => ({ ...p, synced: 1 })));
          await new Promise(resolve => setTimeout(resolve, 5));
        }

        if (sales?.length > 0) {
          await db.salesQueue.bulkPut(sales.map((s: any) => ({ ...s, synced: 1 })));
        }

        localStorage.setItem('lastSyncTimestamp', data.serverTime);
        console.log('✅ Power Sync Completed');
        return true;
      }
      
      throw new Error(data.message || 'Server rejected sync');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('📡 Sync Error:', msg);
      return false;
    } finally {
      this.isSyncing = false;
    }
  },

  async checkConnection() {
    return navigator.onLine;
  },

  async pushProduct(product: ProductPayload) {
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
        sku: product.sku ?? '',
        quantity: product.quantity,
        costPrice: product.cost_price ?? product.costPrice ?? 0,
        sellPrice: product.sell_price ?? product.sellPrice ?? 0,
        categoryId: (product.category_id ?? product.categoryId) || 0,
        isService: product.is_service ?? product.isService ?? false,
        imageUrl: product.imageUrl ?? undefined,
        discountType: (product.discount_type ?? product.discountType) as 'PERCENTAGE' | 'FIXED' | undefined,
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
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Product sync error:', msg);
      return false;
    }
  }
};

