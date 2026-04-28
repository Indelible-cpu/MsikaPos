import express from 'express';
import morgan from 'morgan';
import dotenv from 'dotenv';
// Controllers
import * as UserCtrl from './controllers/UserController';
import * as ProductCtrl from './controllers/ProductController';
import * as BranchCtrl from './controllers/BranchController';
import * as SyncCtrl from './controllers/SyncController';
import * as ReportCtrl from './controllers/ReportController';
import * as SettingsCtrl from './controllers/SettingsController';
import * as DashboardCtrl from './controllers/DashboardController';
import * as CreditCtrl from './controllers/CreditController';
import * as CustomerCtrl from './controllers/CustomerController';
import * as ExpenseCtrl from './controllers/ExpenseController';
import * as AiCtrl from './controllers/AiController';
import * as Security from './middleware/security';

import { authenticate, authorize } from './middleware/auth';
import { prisma } from './lib/prisma';

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
app.get('/api/public/products', async (_req, res) => {
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
  try {
    const settings = await prisma.companySettings.findFirst();
    res.json({ success: true, data: settings });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Protected Routes (Require Authentication)
app.use('/api', authenticate as any);

// Staff-Only Middleware
const staffOnly = authorize(['SUPER_ADMIN', 'ADMIN', 'CASHIER']);
const adminOnly = authorize(['SUPER_ADMIN', 'ADMIN']);

// Dashboard
app.get('/api/dashboard/stats', staffOnly, DashboardCtrl.getDashboardStats);

// Users
app.get('/api/users', adminOnly, UserCtrl.fetchUsers);
app.post('/api/users', adminOnly, UserCtrl.saveUser);
app.post('/api/users/status', adminOnly, UserCtrl.updateUserStatus);
app.delete('/api/users/:id', adminOnly, UserCtrl.deleteUser);
app.post('/api/users/onboarding', UserCtrl.updateOnboarding); // Self-service
app.post('/api/users/verify', UserCtrl.verifyEmail); // Self-service

// Branches
app.get('/api/branches', adminOnly, BranchCtrl.fetchBranches);
app.post('/api/branches', adminOnly, BranchCtrl.saveBranch);
app.delete('/api/branches/:id', adminOnly, BranchCtrl.deleteBranch);

// Products
app.get('/api/products', staffOnly, ProductCtrl.listProducts);
app.get('/api/products/search', staffOnly, ProductCtrl.searchProducts);
app.get('/api/products/totals', staffOnly, ProductCtrl.getProductTotals);
app.post('/api/products/sku', staffOnly, ProductCtrl.generateSku);
app.post('/api/products', staffOnly, ProductCtrl.saveProduct);

// Sales & Sync
app.post('/api/sync', staffOnly, SyncCtrl.syncData);
app.get('/api/reports/transactions', staffOnly, ReportCtrl.fetchTransactions);
app.get('/api/reports/summary', adminOnly, ReportCtrl.getSummary);

// Credits
app.get('/api/credits', staffOnly, CreditCtrl.listCredits);
app.post('/api/credits/payment', staffOnly, CreditCtrl.recordPayment);

// Expenses
app.get('/api/expenses', staffOnly, ExpenseCtrl.listExpenses as any);
app.post('/api/expenses', staffOnly, ExpenseCtrl.saveExpense as any);
app.delete('/api/expenses/:id', staffOnly, ExpenseCtrl.deleteExpense as any);

// Inquiries (Multi-role, handled in controller)
app.post('/api/inquiries', CustomerCtrl.createInquiry as any);
app.get('/api/inquiries', CustomerCtrl.listInquiries as any);
app.put('/api/inquiries/:id', staffOnly, CustomerCtrl.updateInquiryStatus as any);

// AI Insights
app.post('/api/ai/suggestions', staffOnly, AiCtrl.getAiSuggestions as any);

// Settings
app.post('/api/settings', adminOnly, SettingsCtrl.saveSettings);

// Role Initialization
const initRoles = async () => {
  const roles = ['SUPER_ADMIN', 'ADMIN', 'CASHIER', 'CUSTOMER'];
  try {
    for (const roleName of roles) {
      await prisma.role.upsert({
        where: { name: roleName as any },
        update: {},
        create: { name: roleName as any }
      });
    }
    console.log('✅ System roles initialized');
  } catch (err) {
    console.error('❌ Failed to initialize roles:', err);
  }
};

initRoles().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 POS Backend running on http://localhost:${PORT}`);
  });
});
