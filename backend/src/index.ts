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
import * as DashboardCtrl from './controllers/DashboardController.js';
import * as CreditCtrl from './controllers/CreditController.js';

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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));

// Health Check
app.get('/ping', (_req, res) => res.send('pong'));

// Public Routes
app.post('/api/auth/login', UserCtrl.loginUser as any);
app.post('/api/auth/forgot-password', UserCtrl.forgotPassword as any);

// Protected Routes (Require Authentication)
app.use('/api', authenticate as any);

// Dashboard
app.get('/api/dashboard/stats', DashboardCtrl.getDashboardStats);

// Users
app.get('/api/users', UserCtrl.fetchUsers);
app.post('/api/users', UserCtrl.saveUser);
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

app.listen(PORT, () => {
  console.log(`🚀 POS Backend running on http://localhost:${PORT}`);
});
