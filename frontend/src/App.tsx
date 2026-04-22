import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import DashboardPage from './pages/DashboardPage';
import POSPage from './pages/POSPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import DebtPage from './pages/DebtPage';
import ExpensesPage from './pages/ExpensesPage';
import TransactionsPage from './pages/TransactionsPage';
import UsersPage from './pages/UsersPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import LockedPage from './pages/LockedPage';
import { SyncService } from './services/SyncService';
import MainLayout from './components/MainLayout';
import { db } from './db/posDB';
import { initDB } from './db/seedData';
import { AuditService } from './services/AuditService';

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const checkSystemLock = useCallback(async () => {
    try {
      const lockSetting = await db.settings.get('system_lock');
      if (lockSetting && lockSetting.value === true) {
        setIsLocked(true);
        return;
      }

      const hoursSetting = await db.settings.get('lockout_hours');
      if (hoursSetting) {
        const { start, end } = hoursSetting.value as { start: string; end: string };
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;

        // Logic for overnight lockout
        if (startTime > endTime) {
           if (currentTime >= startTime || currentTime <= endTime) {
             setIsLocked(true);
             return;
           }
        } else {
           if (currentTime >= startTime && currentTime <= endTime) {
             setIsLocked(true);
             return;
           }
        }
      }
      setIsLocked(false);
    } catch (err) {
      console.error('Lock check failed:', err);
    }
  }, []);

  const handleSync = useCallback(async () => {
    if (navigator.onLine) {
      setIsSyncing(true);
      try {
        await SyncService.pushSales();
        await AuditService.log('SYNC', 'Background sync completed successfully');
      } catch {
        await AuditService.log('SYNC_ERROR', 'Background sync failed', 'ERROR');
      }
      setTimeout(() => setIsSyncing(false), 2000); // Keep indicator for a bit
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await initDB(db);
      } catch (e) {
        console.error("Seed failed", e);
      }
    };
    init();

    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    setTimeout(() => {
      handleSync();
      checkSystemLock();
    }, 100);

    const syncInterval = setInterval(handleSync, 60000);
    const lockInterval = setInterval(checkSystemLock, 300000); // Check lock every 5 mins

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      clearInterval(syncInterval);
      clearInterval(lockInterval);
    };
  }, [handleSync, checkSystemLock]);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  if (isLocked && !isSuperAdmin) {
    return <LockedPage />;
  }

  return (
    <Router>
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: 'transparent',
            boxShadow: 'none',
            padding: 0,
            color: 'inherit',
            fontWeight: '900',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          },
          icon: null,
          success: { icon: null },
          error: { icon: null }
        }} 
      />
      <div className="min-h-screen selection:bg-primary-500/30">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route 
            path="/*" 
            element={
              localStorage.getItem('token') ? (
                <MainLayout isOnline={isOnline} isSyncing={isSyncing}>
                  <Routes>
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="pos" element={<POSPage />} />
                    <Route path="inventory" element={<InventoryPage />} />
                    <Route path="sales" element={<SalesPage />} />
                    <Route path="debt" element={<DebtPage />} />
                    <Route path="expenses" element={<ExpensesPage />} />
                    <Route path="transactions" element={<TransactionsPage />} />
                    <Route path="users" element={<UsersPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </MainLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
