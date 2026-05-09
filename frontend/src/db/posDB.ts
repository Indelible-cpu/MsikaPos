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
}

export interface LocalCustomer {
  id: string;
  name: string;
  phone: string;
  witnessPhone?: string;
  balance: number;
  totalCreditAmount: number; // Added: sum of all credit sales
  totalPaidAmount: number;   // Added: sum of all payments
  idNumber?: string;
  village?: string;
  livePhoto?: string;
  fingerprintData?: string; // Encrypted representation
  createdAt: string;
  updatedAt: string;
  synced: number; // 0 = unsynced, 1 = synced
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

  constructor() {
    super('JEF_POS_DB');
    this.version(14).stores({
      products: 'id, categoryId, sku, name, status, updatedAt',
      categories: 'id, slug',
      salesQueue: 'id, customerId, status, synced, createdAt',
      settings: 'key',
      customers: 'id, name, phone, balance, idNumber, synced, updatedAt',
      debtPayments: 'id, customerId, createdAt, synced',
      expenses: 'id, category, date, synced',
      users: 'id, username, role',
      auditLogs: 'id, userId, action, createdAt',
      offlineAuth: 'username'
    });
  }
}

export const db = new POSDatabase();
