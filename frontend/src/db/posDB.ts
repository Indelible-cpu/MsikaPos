import Dexie, { type Table } from 'dexie';

export interface LocalProduct {
  id: number;
  categoryId: number;
  sku: string;
  name: string;
  costPrice: number;
  sellPrice: number;
  quantity: number;
  isService: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface LocalSaleItem {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  lineTotal: number;
  profit: number;
}

export interface LocalSale {
  id: string; 
  invoiceNo: string;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  changeDue: number;
  paymentMode: string;
  itemsCount: number;
  createdAt: string;
  synced: number; 
  items: LocalSaleItem[];
}

export class POSDatabase extends Dexie {
  products!: Table<LocalProduct>;
  categories!: Table<{ id: number; title: string; slug: string }>;
  salesQueue!: Table<LocalSale>;
  settings!: Table<{ key: string; value: string | number | boolean | object }>;

  constructor() {
    super('JEF_POS_DB');
    this.version(2).stores({
      products: 'id, categoryId, sku, name',
      categories: 'id, slug',
      salesQueue: 'id, invoiceNo, synced',
      settings: 'key'
    });
  }
}

export const db = new POSDatabase();
