import express from 'express';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { authenticate } from './middleware/auth.js';

// Controllers
import * as UserCtrl from './controllers/UserController.js';
import * as ProductCtrl from './controllers/ProductController.js';
import * as BranchCtrl from './controllers/BranchController.js';
import * as SyncCtrl from './controllers/SyncController.js';
import * as ReportCtrl from './controllers/ReportController.js';
import * as SettingsCtrl from './controllers/SettingsController.js';
import * as DashboardCtrl from './controllers/DashboardController.js';
import * as CreditCtrl from './controllers/CreditController.js';
import * as CustomerCtrl from './controllers/CustomerController.js';
import * as ExpenseCtrl from './controllers/ExpenseController.js';
import * as Security from './middleware/security.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '1mb' })); 
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(morgan('dev'));

// Security Middleware
app.use(Security.ipBlocker as any);
app.use(Security.securityHeaders as any);
app.use(Security.parameterPollution as any);
app.use('/api', Security.globalLimiter as any);

// Health Check
app.get('/ping', (_req, res) => res.send('pong'));
app.get('/api/ping', (_req, res) => res.send('pong'));

// Public Routes
app.post('/api/auth/login', UserCtrl.loginUser as any);
app.post('/api/auth/magic-login', UserCtrl.magicLogin as any);
app.post('/api/auth/forgot-password', UserCtrl.forgotPassword as any);
app.post('/api/customer/register', CustomerCtrl.registerCustomer as any);
app.post('/api/customer/login', CustomerCtrl.loginCustomer as any);

// Public Storefront Routes (No Auth Required)
app.get('/api/public/products', async (req, res) => {
  const { prisma } = await import('./lib/prisma.js');
  try {
    const products = await prisma.product.findMany({
      where: { deleted: false },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    // Only return products with stock OR services
    const visible = products.filter((p: any) => p.isService || p.quantity > 0);
    res.json({ success: true, data: visible });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/public/settings', async (_req, res) => {
  const { prisma } = await import('./lib/prisma.js');
  try {
    const settings = await prisma.companySettings.findFirst();
    res.json({ success: true, data: settings });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Protected Routes (Require Authentication)
app.use('/api', authenticate as any);

// Dashboard
app.get('/api/dashboard/stats', DashboardCtrl.getDashboardStats);

// Users
app.get('/api/users', UserCtrl.fetchUsers);
app.post('/api/users', UserCtrl.saveUser);
app.post('/api/users/status', UserCtrl.updateUserStatus);
app.delete('/api/users/:id', UserCtrl.deleteUser);
app.post('/api/users/onboarding', UserCtrl.updateOnboarding);
app.post('/api/users/verify', UserCtrl.verifyEmail);

// Branches
app.get('/api/branches', BranchCtrl.fetchBranches);
app.post('/api/branches', BranchCtrl.saveBranch);
app.delete('/api/branches/:id', BranchCtrl.deleteBranch);

// Products
app.get('/api/products', ProductCtrl.listProducts);
app.get('/api/products/search', ProductCtrl.searchProducts);
app.get('/api/products/totals', ProductCtrl.getProductTotals);
app.post('/api/products/sku', ProductCtrl.generateSku);
app.post('/api/products', ProductCtrl.saveProduct);

// Sales & Sync
app.post('/api/sync', SyncCtrl.syncData);
app.get('/api/reports/transactions', ReportCtrl.fetchTransactions);
app.get('/api/reports/summary', ReportCtrl.getSummary);

// Credits
app.get('/api/credits', CreditCtrl.listCredits);
app.post('/api/credits/payment', CreditCtrl.recordPayment);

// Expenses
app.get('/api/expenses', ExpenseCtrl.listExpenses as any);
app.post('/api/expenses', ExpenseCtrl.saveExpense as any);
app.delete('/api/expenses/:id', ExpenseCtrl.deleteExpense as any);

// Inquiries
app.post('/api/inquiries', CustomerCtrl.createInquiry as any);
app.get('/api/inquiries', CustomerCtrl.listInquiries as any);
app.put('/api/inquiries/:id', CustomerCtrl.updateInquiryStatus as any);

// Settings
app.post('/api/settings', SettingsCtrl.saveSettings);

app.listen(PORT, () => {
  console.log(`🚀 POS Backend running on http://localhost:${PORT}`);
});
