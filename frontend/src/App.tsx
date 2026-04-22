import React, { useEffect, useState } from 'react';
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
import { SyncService } from './services/SyncService';
import MainLayout from './components/MainLayout';
import { db } from './db/posDB';
import { initDB } from './db/seedData';

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (navigator.onLine) {
      setIsSyncing(true);
      await SyncService.pushSales();
      setTimeout(() => setIsSyncing(false), 2000); // Keep indicator for a bit
    }
  };

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

    handleSync();

    const syncInterval = setInterval(handleSync, 60000);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      clearInterval(syncInterval);
    };
  }, []);

  return (
    <Router>
      <Toaster position="top-center" />
      <div className="min-h-screen selection:bg-primary-500/30">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
