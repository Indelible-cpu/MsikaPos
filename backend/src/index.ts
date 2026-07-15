import dns from 'dns';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

// FORCE IPv4 PRIORITIZATION AT ENTRY POINT
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Controllers
import * as UserCtrl from './controllers/UserController';
import * as ProductCtrl from './controllers/ProductController';
import * as CategoryCtrl from './controllers/CategoryController';
import * as SyncCtrl from './controllers/SyncController';
import * as ReportCtrl from './controllers/ReportController';
import * as SettingsCtrl from './controllers/SettingsController';
import * as DashboardCtrl from './controllers/DashboardController';
import * as CreditCtrl from './controllers/CreditController';
import { BranchController } from './controllers/BranchController';
import * as CustomerCtrl from './controllers/CustomerController';
import * as ExpenseCtrl from './controllers/ExpenseController';
import * as AiCtrl from './controllers/AiController';
import * as FeatureCtrl from './controllers/FeatureController';
import * as SaleCtrl from './controllers/SaleController';
import * as PayrollCtrl from './controllers/PayrollController';
import * as Security from './middleware/security';

import { authenticate, authorize } from './middleware/auth';
import { prisma, tenantContext } from './lib/prisma';

dotenv.config();

// Global Error Handling to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err);
  // Give time for logging before exiting
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🌊 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

if (!process.env.DATABASE_URL) {
  console.error('❌ CRITICAL ERROR: DATABASE_URL is not defined in environment variables.');
  process.exit(1);
} else {
  console.log('📡 Database connection string found.');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Trust Render/Cloud Proxy
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: true, // Reflect the request origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-branch-id', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.options(/.*/, cors() as any); // Enable pre-flight for all routes (Express 5 compatible)

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// Gzip compress all responses — reduces API payload size by ~60-80%
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));

// Health Check (Must be before any middleware that touches DB)
app.get('/ping', (_req, res) => res.send('pong'));
app.get('/api/ping', (_req, res) => res.send('pong'));

// Security Middleware
app.use(Security.ipBlocker as any);
app.use(Security.securityHeaders as any);
app.use(Security.parameterPollution as any);
app.use('/api', Security.globalLimiter as any);

// Public Routes
app.post('/api/auth/login', UserCtrl.loginUser as any);
app.post('/api/auth/magic-login', UserCtrl.magicLogin as any);
app.post('/api/auth/forgot-password', UserCtrl.forgotPassword as any);
app.post('/api/auth/reset-password', UserCtrl.resetPassword as any);
app.post('/api/onboarding/validate', UserCtrl.magicLogin as any);
app.post('/api/customer/register', CustomerCtrl.registerCustomer as any);
app.post('/api/customer/login', CustomerCtrl.loginCustomer as any);

// Public Storefront Routes (No Auth Required)
app.get('/api/public/products', async (req, res) => {
  try {
    const branchId = req.headers['x-branch-id'];
    const where: any = { deleted: false };
    
    if (branchId) {
      where.branchId = parseInt(branchId as string);
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    // Return all non-deleted products
    res.json({ success: true, data: products });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/public/settings', async (_req, res) => {
  try {
    const settings = await prisma.companySettings.findFirst();
    res.set('Cache-Control', 'public, max-age=300'); // 5 minute cache
    res.json({ success: true, data: settings });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/public/products/:id/rate', ProductCtrl.rateProduct as any);
app.get('/api/public/products/:id/ratings', ProductCtrl.getProductRatings as any);

// Protected Routes (Require Authentication)
app.use('/api', authenticate as any, (req: any, _res: any, next: any) => {
  if (req.user && req.user.businessId) {
    tenantContext.run({ businessId: req.user.businessId }, next);
  } else {
    next();
  }
});

app.post('/api/auth/biometrics', authenticate as any, UserCtrl.enableBiometrics as any);

// Staff-Only Middleware
const staffOnly = authorize(['SUPER_ADMIN', 'ADMIN', 'CASHIER']);
const adminOnly = authorize(['SUPER_ADMIN', 'ADMIN']);

// Dashboard
app.get('/api/dashboard/stats', staffOnly, DashboardCtrl.getDashboardStats);

// Branches
app.get('/api/branches', authenticate as any, BranchController.getBranches as any);
app.post('/api/branches', adminOnly, BranchController.createBranch as any);
app.put('/api/branches/:id', adminOnly, BranchController.updateBranch as any);
app.delete('/api/branches/:id', adminOnly, BranchController.deleteBranch as any);

// Users
app.get('/api/users', adminOnly, UserCtrl.fetchUsers);
app.post('/api/users', adminOnly, UserCtrl.saveUser);
app.post('/api/users/status', adminOnly, UserCtrl.updateUserStatus);
app.delete('/api/users/:id', adminOnly, UserCtrl.deleteUser);
app.post('/api/users/onboarding', UserCtrl.updateOnboarding); // Self-service
app.post('/api/users/verify', UserCtrl.verifyEmail); // Self-service

// Categories
app.get('/api/categories', staffOnly, CategoryCtrl.listCategories);
app.post('/api/categories', adminOnly, CategoryCtrl.saveCategory);
app.delete('/api/categories/:id', adminOnly, CategoryCtrl.deleteCategory);

// Products
app.get('/api/products', staffOnly, ProductCtrl.listProducts);
app.get('/api/products/search', staffOnly, ProductCtrl.searchProducts);
app.get('/api/products/totals', staffOnly, ProductCtrl.getProductTotals);
app.post('/api/products/sku', staffOnly, ProductCtrl.generateSku);
app.post('/api/products', staffOnly, ProductCtrl.saveProduct);
app.delete('/api/products/:id', adminOnly, ProductCtrl.deleteProduct);

// Sales & Sync
app.post('/api/sync', staffOnly, SyncCtrl.syncData);
app.put('/api/sales/:id', staffOnly, SaleCtrl.updateSale);
app.delete('/api/sales/:id', adminOnly, SaleCtrl.deleteSale);
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
app.delete('/api/inquiries/all', adminOnly, CustomerCtrl.deleteAllInquiries as any);

// AI Insights
app.post('/api/ai/suggestions', staffOnly, AiCtrl.getAiSuggestions as any);

// Settings
app.post('/api/settings', adminOnly, SettingsCtrl.saveSettings);

// Feature Access Control
app.get('/api/feature-configs', authenticate, FeatureCtrl.getFeatureConfigs);
app.post('/api/feature-configs', adminOnly, FeatureCtrl.updateFeatureConfig);

// Payroll
app.get('/api/payroll/employees', adminOnly, PayrollCtrl.getEmployees as any);
app.post('/api/payroll/salary-config', adminOnly, PayrollCtrl.setSalaryConfig as any);
app.get('/api/payroll/advances', adminOnly, PayrollCtrl.getAdvances as any);
app.post('/api/payroll/advances', adminOnly, PayrollCtrl.createAdvance as any);
app.put('/api/payroll/advances/:id', adminOnly, PayrollCtrl.updateAdvance as any);
app.get('/api/payroll/payslips', adminOnly, PayrollCtrl.getPayslips as any);
app.post('/api/payroll/payslips/generate', adminOnly, PayrollCtrl.generatePayslip as any);
app.put('/api/payroll/payslips/:id/sign', adminOnly, PayrollCtrl.signPayslip as any);

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

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 POS Backend running on port ${PORT}`);
  
  // Initialize roles in background
  initRoles().catch(err => {
    console.error('❌ Role initialization failed:', err);
  });
});
