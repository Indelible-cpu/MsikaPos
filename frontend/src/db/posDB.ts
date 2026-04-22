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
  customerId?: string;
  items: LocalSaleItem[];
}

export interface LocalCustomer {
  id: string;
  name: string;
  phone: string;
  balance: number; 
  idNumber?: string;
  village?: string;
  livePhoto?: string;
  fingerprintData?: string; // Encrypted representation
  createdAt: string;
  updatedAt: string;
}

export interface LocalDebtPayment {
  id: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  createdAt: string;
}

export interface LocalExpense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  paymentMethod: string;
  createdAt: string;
}

export interface LocalUser {
  id: string;
  username: string;
  fullname: string;
  email?: string;
  phone?: string;
  role: string;
  roleId: number;
  createdAt: string;
}

export interface LocalAuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  type: 'INFO' | 'WARNING' | 'ERROR';
  createdAt: string;
}

export class POSDatabase extends Dexie {
  products!: Table<LocalProduct>;
  categories!: Table<{ id: number; title: string; slug: string }>;
  salesQueue!: Table<LocalSale>;
  settings!: Table<{ key: string; value: string | number | boolean | object }>;
  customers!: Table<LocalCustomer>;
  debtPayments!: Table<LocalDebtPayment>;
  expenses!: Table<LocalExpense>;
  users!: Table<LocalUser>;
  auditLogs!: Table<LocalAuditLog>;

  constructor() {
    super('JEF_POS_DB');
    this.version(6).stores({
      products: 'id, categoryId, sku, name',
      categories: 'id, slug',
      salesQueue: 'id, status, createdAt',
      settings: 'key',
      customers: 'id, name, phone, idNumber',
      debtPayments: 'id, customerId, createdAt',
      expenses: 'id, category, date',
      users: 'id, username, role',
      auditLogs: 'id, userId, action, createdAt'
    });
  }
}

export const db = new POSDatabase();
