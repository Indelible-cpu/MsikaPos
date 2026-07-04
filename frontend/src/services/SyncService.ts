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

    // Sync when the user returns to this tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine && !this.isSyncing) {
        console.log('👁 Tab visible: Triggering sync...');
        this.pushSales().catch(console.error);
      }
    });

    // Handle session invalidation event from apiFetch
    window.addEventListener('auth:session-invalid', () => {
      console.warn('🔓 Session expired or invalid. Redirecting to login.');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/staff/login';
    });

    // Initial sync
    if (navigator.onLine) {
      this.pushSales().catch(console.error);
    }

    // Automatic recurring sync with ±10s jitter to avoid thundering-herd
    const scheduleNextSync = () => {
      const jitter = Math.floor(Math.random() * 20000) - 10000; // ±10s
      const delay = 30000 + jitter;
      setTimeout(() => {
        if (navigator.onLine && !this.isSyncing) {
          this.pushSales().catch((err) => {
            console.error('Automatic sync interval failed:', err);
          });
        }
        scheduleNextSync();
      }, delay);
    };
    scheduleNextSync();
  },

  async pushSales() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      console.warn('📡 Sync skipped: No authentication token found.');
      this.isSyncing = false;
      return false;
    }
    
    if (this.isSyncing) return false;
    this.isSyncing = true;

    try {
      // Chunked retrieval of local unsynced records, skipping ones that have
      // repeatedly failed (syncRetries >= 10) to avoid infinite retry loops.
      const getUnsynced = async (table: any) => {
        const results: any[] = [];
        let count = 0;
        await table.where('synced').equals(0).each((item: any) => {
          // Skip permanently stuck records (too many retries)
          if ((item.syncRetries ?? 0) >= 10) return;
          results.push(item);
          count++;
          // Yield every 100 items to keep UI responsive
          if (count % 100 === 0) {
             return new Promise(resolve => setTimeout(resolve, 0));
          }
        });
        return results;
      };

      const [unsyncedSales, unsyncedExpenses, unsyncedCustomers, unsyncedPayments] = await Promise.all([
        getUnsynced(db.salesQueue),
        getUnsynced(db.expenses),
        getUnsynced(db.customers),
        getUnsynced(db.debtPayments)
      ]);

      const hasLocalChanges = unsyncedSales.length > 0 || unsyncedExpenses.length > 0 || 
                             unsyncedCustomers.length > 0 || unsyncedPayments.length > 0;

      if (hasLocalChanges) {
        console.log(`🔄 Syncing: ${unsyncedSales.length} sales, ${unsyncedExpenses.length} expenses, ${unsyncedCustomers.length} customers...`);
      } else {
        console.log('🔄 Checking for remote updates...');
      }

      // Small yield to allow UI to breathe after local fetch
      await new Promise(resolve => setTimeout(resolve, 0));

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

      // YIELD to the browser to prevent long-task violations before processing response
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));

      if (data.success) {
        const { products, categories, customers, expenses, debtPayments, sales } = data.updates;
        // customerIdMap: { [offlineUUID]: serverIntId } — used to remap local IDs
        const customerIdMap: Record<string, number> = data.customerIdMap || {};
        
        // 2. CHUNKED MAPPING: Map data in small batches to avoid blocking
        const MAP_CHUNK_SIZE = 100;
        const yieldToMain = () => new Promise(resolve => {
          // Use setTimeout to yield and let the event loop process other tasks
          setTimeout(resolve, 0);
        });

        const mapInChunks = async <T, R>(items: T[], mapper: (item: T) => R): Promise<R[]> => {
          const results: R[] = [];
          if (!items || items.length === 0) return results;
          
          for (let i = 0; i < items.length; i += MAP_CHUNK_SIZE) {
            const chunk = items.slice(i, i + MAP_CHUNK_SIZE);
            results.push(...chunk.map(mapper));
            // Only yield if there are more chunks to process
            if (i + MAP_CHUNK_SIZE < items.length) {
              await yieldToMain();
            }
          }
          return results;
        };

        const mappedCustomers = await mapInChunks(customers || [], (c: any) => ({
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

        const mappedExpenses = await mapInChunks(expenses || [], (e: any) => ({
          ...e,
          date: e.expenseDate,
          synced: 1
        }));

        const mappedPayments = await mapInChunks(debtPayments || [], (p: any) => ({
          ...p,
          synced: 1
        }));

        const mappedSales = await mapInChunks(sales || [], (s: any) => ({
          ...s,
          synced: 1
        }));

        // 3. CHUNKED SYNC: Process each table separately with optimized chunks
        const WRITE_CHUNK_SIZE = 100;

        const processInChunks = async (table: any, items: any[]) => {
          if (!items || items.length === 0) return;
          for (let i = 0; i < items.length; i += WRITE_CHUNK_SIZE) {
            const chunk = items.slice(i, i + WRITE_CHUNK_SIZE);
            await table.bulkPut(chunk);
            if (i + WRITE_CHUNK_SIZE < items.length) {
              await yieldToMain();
            }
          }
        };

        // 1. Mark local changes as synced in small chunks
        const markAsSynced = async (table: any, items: any[]) => {
          const ids = items.map(i => i.id);
          const MODIFY_CHUNK_SIZE = 50;
          for (let i = 0; i < ids.length; i += MODIFY_CHUNK_SIZE) {
            const chunk = ids.slice(i, i + MODIFY_CHUNK_SIZE);
            await table.where('id').anyOf(chunk).modify({ synced: 1 });
            await yieldToMain();
          }
        };

        // ── Customer ID Remapping ──────────────────────────────────────────────
        // The server returns a map of { offlineUUID → serverIntId }.
        // We must update every local record (customers, sales, debtPayments)
        // that references the old offline UUID so future syncs link correctly.
        if (Object.keys(customerIdMap).length > 0) {
          for (const [offlineId, serverId] of Object.entries(customerIdMap)) {
            const serverIdStr = String(serverId);
            // Update the customer record itself
            const localCust = await db.customers.get(offlineId);
            if (localCust) {
              await db.customers.delete(offlineId);
              await db.customers.put({ ...localCust, id: serverIdStr, synced: 1 });
            }
            // Update any sales that referenced this customer's offline UUID
            await db.salesQueue
              .where('customerId').equals(offlineId)
              .modify({ customerId: serverIdStr });
            // Update any debt payments that referenced this customer's offline UUID
            await db.debtPayments
              .where('customerId').equals(offlineId)
              .modify({ customerId: serverIdStr });
          }
        }

        // ── Mark confirmed records as synced ─────────────────────────────────
        // Use server-confirmed IDs to mark only truly synced sales
        const confirmedSaleIds: string[] = data.syncedSaleIds || unsyncedSales.map((s: any) => s.id);
        if (confirmedSaleIds.length > 0) {
          const MODIFY_CHUNK_SIZE = 50;
          const yieldFn = () => new Promise(resolve => setTimeout(resolve, 0));
          for (let i = 0; i < confirmedSaleIds.length; i += MODIFY_CHUNK_SIZE) {
            const chunk = confirmedSaleIds.slice(i, i + MODIFY_CHUNK_SIZE);
            await db.salesQueue.where('id').anyOf(chunk).modify({ synced: 1 });
            await yieldFn();
          }
        }
        if (unsyncedExpenses.length > 0) {
          await markAsSynced(db.expenses, unsyncedExpenses);
        }
        if (unsyncedCustomers.length > 0) {
          // Only mark customers synced if they were remapped — otherwise they
          // already got synced=1 in the remapping step above
          const notRemapped = unsyncedCustomers.filter((c: any) => !customerIdMap[c.id]);
          if (notRemapped.length > 0) await markAsSynced(db.customers, notRemapped);
        }
        if (unsyncedPayments.length > 0) {
          await markAsSynced(db.debtPayments, unsyncedPayments);
        }

        // 2. Apply remote updates in tiny chunks
        if (products && products.length > 0) {
          await processInChunks(db.products, products);
        }
        
        if (categories && categories.length > 0) {
          await processInChunks(db.categories, categories);
        }

        if (mappedCustomers.length > 0) {
          await processInChunks(db.customers, mappedCustomers);
        }

        if (mappedExpenses.length > 0) {
          await processInChunks(db.expenses, mappedExpenses);
        }

        if (mappedPayments.length > 0) {
          await processInChunks(db.debtPayments, mappedPayments);
        }

        if (mappedSales.length > 0) {
          await processInChunks(db.salesQueue, mappedSales);
        }


        localStorage.setItem('lastSyncTimestamp', data.serverTime);
        console.log('✅ Power Sync Completed');
        // Notify all listening components (e.g. Dashboard) to refetch from server immediately
        window.dispatchEvent(new CustomEvent('sync:completed'));
        return true;
      }
      
      throw new Error(data.message || 'Server rejected sync');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('📡 Sync Error:', msg);
      // Increment syncRetries on all unsynced records so we can detect stuck ones
      try {
        const increment = (table: any) =>
          table.where('synced').equals(0).modify((item: any) => {
            item.syncRetries = (item.syncRetries ?? 0) + 1;
          });
        await Promise.all([
          increment(db.salesQueue),
          increment(db.expenses),
          increment(db.customers),
          increment(db.debtPayments),
        ]);
      } catch { /* non-critical */ }
      return false;
    } finally {
      this.isSyncing = false;
    }
  },

  async checkConnection() {
    return navigator.onLine;
  },

  async pushCategory(category: { id: number; title: string; slug: string }) {
    try {
      await apiFetch('/categories', {
        method: 'POST',
        body: JSON.stringify(category)
      });
      return true;
    } catch (error: unknown) {
      console.error('Category sync error:', error);
      return false;
    }
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
        discountType: (product.discount_type ?? product.discountType) as 'Percentage' | 'Fixed' | undefined,
        status: 'Active',
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

