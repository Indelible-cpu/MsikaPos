import Dexie, { type Table } from 'dexie';

export interface LocalProduct {
  id: number;
  categoryId: number;
  sku: string;
  name: string;
  sellPrice: number;
  quantity: number;
  isService: boolean;
  updatedAt: string;
}

export interface LocalSale {
  id: string; // cuid generated on device
  invoiceNo: string;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  changeDue: number;
  paymentMode: string;
  itemsCount: number;
  createdAt: string;
  synced: number; // 0 for false, 1 for true (IndexedDB integer indexing)
  items: any[];
}

export class POSDatabase extends Dexie {
  products!: Table<LocalProduct>;
  categories!: Table<{ id: number; title: string; slug: string }>;
  salesQueue!: Table<LocalSale>;
  settings!: Table<{ key: string; value: any }>;

  constructor() {
    super('JEF_POS_DB');
    this.version(1).stores({
      products: 'id, categoryId, sku, name',
      categories: 'id, slug',
      salesQueue: 'id, invoiceNo, synced',
      settings: 'key'
    });
  }
}

export const db = new POSDatabase();
