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
  status: 'Active' | 'Inactive';
  imageUrl?: string;
  soldCount?: number;
  discount?: number; // legacy
  discountType?: 'Percentage' | 'Fixed';
  discountValue?: number;
  discountStartDate?: string;
  discountEndDate?: string;
  reorderLevel?: number; // Added for Smart Ordering
  supplierId?: string; // Added for Smart Ordering
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
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
  syncRetries?: number; // counts failed sync attempts; skip after 10
  customerId?: string;
  items: LocalSaleItem[];
  sellerName?: string;
  userId: number;
  tax?: number;
  bankName?: string;
  accountNumber?: string;
  amountReceived?: number;
  profit: number;
  status: string;
  dueDate?: string;
  refundReason?: string;
}

export interface LocalCustomer {
  id: string;
  name: string;
  phone: string;
  witnessPhone?: string;
  balance: number;
  totalCreditAmount: number;
  totalPaidAmount: number;
  idNumber?: string;
  village?: string;
  livePhoto?: string;
  fingerprintData?: string;
  createdAt: string;
  updatedAt: string;
  synced: number;
  syncRetries?: number;
}

export interface LocalDebtPayment {
  id: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  cashierName?: string;
  signature?: string;
  reference?: string;
  createdAt: string;
  synced: number;
  syncRetries?: number;
}

export interface LocalExpense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  paymentMethod: string;
  frequency?: 'Daily' | 'Weekly' | 'Monthly' | 'Annually';
  createdAt: string;
  synced: number;
  syncRetries?: number;
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
  type: 'Info' | 'Warning' | 'Error';
  createdAt: string;
}

export interface LocalOfflineAuth {
  username: string;
  passwordHash: string;
  userData: any;
  token: string;
}

export interface LocalSupplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: string;
  synced: number;
}

export interface LocalPurchaseOrderItem {
  productId: number;
  productName: string;
  currentStock: number;
  reorderLevel: number;
  orderQty: number;
  unitCost: number;
  lineTotal: number;
}

export interface LocalPurchaseOrder {
  id: string;
  supplierId?: string;
  supplierName?: string;
  status: 'Draft' | 'Sent' | 'Received' | 'Cancelled';
  items: LocalPurchaseOrderItem[];
  total: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  synced: number;
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
  offlineAuth!: Table<LocalOfflineAuth>;
  suppliers!: Table<LocalSupplier>;
  purchaseOrders!: Table<LocalPurchaseOrder>;

  constructor() {
    super('JEF_POS_DB');
    this.version(17).stores({
      products: 'id, categoryId, sku, name, status, supplierId, updatedAt',
      categories: 'id, slug',
      salesQueue: 'id, customerId, status, synced, syncRetries, createdAt',
      settings: 'key',
      customers: 'id, name, phone, balance, idNumber, synced, syncRetries, updatedAt',
      debtPayments: 'id, customerId, createdAt, synced, syncRetries',
      expenses: 'id, category, date, synced, syncRetries, updatedAt',
      users: 'id, username, role',
      auditLogs: 'id, userId, action, type, createdAt',
      offlineAuth: 'username',
      suppliers: 'id, name, synced',
      purchaseOrders: 'id, supplierId, status, synced, createdAt'
    });
    // v18: add createdAt index to expenses
    this.version(18).stores({
      products: 'id, categoryId, sku, name, status, supplierId, updatedAt',
      categories: 'id, slug',
      salesQueue: 'id, customerId, status, synced, syncRetries, createdAt',
      settings: 'key',
      customers: 'id, name, phone, balance, idNumber, synced, syncRetries, updatedAt',
      debtPayments: 'id, customerId, createdAt, synced, syncRetries',
      expenses: 'id, category, date, synced, syncRetries, updatedAt, createdAt',
      users: 'id, username, role',
      auditLogs: 'id, userId, action, type, createdAt',
      offlineAuth: 'username',
      suppliers: 'id, name, synced',
      purchaseOrders: 'id, supplierId, status, synced, createdAt'
    });
  }
}

export const db = new POSDatabase();
