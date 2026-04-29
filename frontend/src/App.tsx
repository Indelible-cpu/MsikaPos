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
import OnboardingPage from './pages/OnboardingPage';
import LockedPage from './pages/LockedPage';
import ReportsPage from './pages/ReportsPage';
import BranchesPage from './pages/BranchesPage';
import AboutPage from './pages/AboutPage';
import PublicStorefront from './pages/PublicStorefront';
import InquiriesPage from './pages/InquiriesPage';
import AuditLogsPage from './pages/AuditLogsPage';
import { SyncService } from './services/SyncService';
import MainLayout from './components/MainLayout';
import { db } from './db/posDB';
import { initDB } from './db/seedData';
import { AuditService } from './services/AuditService';
import api from './api/client';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // PWA Auto-Update Logic
  const {
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      // Check for updates every 10 minutes
      if (r) {
        setInterval(() => {
          r.update();
        }, 10 * 60 * 1000);
      }
    },
    onNeedRefresh() {
      // Automatically update and reload when a new version is found
      updateServiceWorker(true);
    }
  });

  useEffect(() => {
    const duration = 30000; // 30 seconds
    const interval = 100; // Update every 100ms
    const steps = duration / interval;
    const increment = 100 / steps;

    const timer = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsInitialLoading(false);
          return 100;
        }
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // 1. Don't show if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    // 2. Don't show if user dismissed it recently (e.g., in last 7 days)
    const lastDismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (lastDismissed) {
      const daysSinceDismissal = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissal < 7) return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismissInstall = () => {
    setDeferredPrompt(null);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  const checkSystemLock = useCallback(async () => {
    try {
      const overrideSetting = await db.settings.get('lockout_override');
      if (overrideSetting && overrideSetting.value === true) {
        const lastActive = parseInt(localStorage.getItem('lastActivity') || '0', 10);
        if (Date.now() - lastActive > 12 * 60 * 60 * 1000) { // 12 Hours
          // Expired
          await db.settings.put({ key: 'lockout_override', value: false });
        } else {
          setIsLocked(false);
          return;
        }
      }

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
      try {
        await SyncService.pushSales();
        await AuditService.log('SYNC', 'Background sync completed successfully');
      } catch {
        await AuditService.log('SYNC_ERROR', 'Background sync failed', 'ERROR');
      }
    }
  }, []);

  useEffect(() => {
    const handleActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const handleFocus = () => {
      // Check for updates whenever user returns to the app
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
          if (registration) registration.update();
        });
      }
    };
    window.addEventListener('focus', handleFocus);

    const init = async () => {
      try {
        await initDB(db);
        // Force unlock if it was set to the old 20:00 lock time
        const hours = await db.settings.get('lockout_hours');
        const val = hours?.value as { start: string; end: string } | undefined;
        if (val?.start === '20:00' || val?.start === '23:59') {
          await db.settings.put({ key: 'lockout_hours', value: { start: '05:00', end: '06:00' } });
        }
        
        // Sync Company Settings with Cloud
        try {
          const res = await api.get('/public/settings');
          if (res.data?.success && res.data.data) {
            const settings = res.data.data;
            if (settings.companyName) {
              await db.settings.put({ key: 'company_config', value: { name: settings.companyName } });
              localStorage.setItem('companyName', settings.companyName);
            }
            if (settings.logo) {
              localStorage.setItem('companyLogo', settings.logo);
            }
            window.dispatchEvent(new Event('storage'));
          }
        } catch (err) {
          console.error("Failed to sync remote settings", err);
        }

      } catch (e) {
        console.error("Seed failed", e);
      }
    };
    init();

    setTimeout(() => {
      handleSync();
      checkSystemLock();
    }, 100);

    const syncInterval = setInterval(handleSync, 60000);
    const lockInterval = setInterval(checkSystemLock, 60000); // Check lock every min

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(syncInterval);
      clearInterval(lockInterval);
    };
  }, [handleSync, checkSystemLock]);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const handleUnlock = async () => {
    await db.settings.put({ key: 'lockout_override', value: true });
    localStorage.setItem('lastActivity', Date.now().toString());
    checkSystemLock();
  };

  if (isLocked) {
    return <LockedPage isSuperAdmin={isSuperAdmin} onUnlock={handleUnlock} />;
  }

  if (isInitialLoading) {
    return (
      <div className="fixed inset-0 z-[1000] bg-surface-bg flex flex-col items-center justify-center p-8 overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-rose-500/10 rounded-full blur-[120px] animate-pulse delay-700"></div>
        
        <div className="relative flex flex-col items-center max-w-sm w-full">
          <div className="w-32 h-32 mb-12 relative">
             <div className="absolute inset-0 bg-primary-500/20 rounded-full blur-2xl animate-ping opacity-50"></div>
             <div className="relative w-full h-full rounded-full bg-surface-card border-4 border-primary-500 flex items-center justify-center overflow-hidden shadow-2xl p-2 scale-110">
                <img src="/icon.png?v=2" alt="MsikaPos Logo" className="w-full h-full object-cover rounded-full" />
             </div>
          </div>
          
          <div className="text-center space-y-4 mb-12">
            <h1 className="text-3xl font-black tracking-tighter text-surface-text uppercase italic">MsikaPos</h1>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black tracking-[0.4em] text-primary-500 uppercase opacity-80">Cloud Powered Business Hub</span>
              <div className="w-12 h-1 bg-primary-500/20 rounded-full overflow-hidden">
                 <div className="h-full bg-primary-500 animate-[loading-bar_2s_infinite]"></div>
              </div>
            </div>
          </div>

          <div className="w-full space-y-3">
             <div className="flex justify-between items-end mb-1">
                <span className="text-[8px] font-black tracking-widest text-surface-text/40 uppercase">
                  {loadingProgress < 30 ? 'Initializing core modules...' : 
                   loadingProgress < 60 ? 'Syncing branch data...' : 
                   loadingProgress < 90 ? 'Optimizing database hooks...' : 'Finishing touches...'}
                </span>
                <span className="text-[10px] font-black text-primary-500 tabular-nums">{Math.floor(loadingProgress)}%</span>
             </div>
             <div className="h-2 w-full bg-surface-card border border-surface-border rounded-full overflow-hidden p-0.5">
                <div 
                  className="h-full bg-primary-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(var(--primary-500-rgb),0.5)]"
                  style={{ width: `${loadingProgress}%` } as React.CSSProperties}
                ></div>
             </div>
          </div>

          <p className="mt-12 text-[8px] font-black tracking-[0.3em] text-surface-text/20 uppercase">Version 2.4.0 • Enterprise Edition</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: '#111',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '10px 20px',
            color: '#fff',
            fontWeight: '400',
            fontSize: '11px',
            letterSpacing: '0.02em',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          },
          duration: 2500,
          success: {
            icon: null,
          },
          error: {
            icon: null,
          }
        }} 
      />
      <div className="min-h-screen selection:bg-primary-500/30">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicStorefront />} />
          <Route path="/about" element={<AboutPage />} />

          {/* Staff Auth */}
          <Route path="/staff" element={<Navigate to="/staff/login" replace />} />
          <Route path="/staff/login" element={<LoginPage />} />
          <Route path="/staff/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/staff/onboarding" element={localStorage.getItem('token') ? <OnboardingPage /> : <Navigate to="/staff/login" replace />} />
          
          {/* Private Staff Interface */}
          <Route 
            path="/staff/*" 
            element={
              localStorage.getItem('token') ? (
                (() => {
                    let u;
                    try {
                      u = JSON.parse(localStorage.getItem('user') || '{}');
                    } catch {
                      return <Navigate to="/staff/login" replace />;
                    }
                    
                    // STRICT ROLE CHECK: Only Staff can access staff portal
                    const isStaff = ['SUPER_ADMIN', 'ADMIN', 'CASHIER'].includes(u.role);
                    if (!isStaff) {
                      return <Navigate to="/" replace />;
                    }
  
                    if (!u.isVerified || u.mustChangePassword) {
                      return <Navigate to="/staff/onboarding" replace />;
                    }
                  
                  return (
                    <MainLayout>
                      <Routes>
                        <Route path="dashboard" element={<DashboardPage />} />
                        <Route path="pos" element={<POSPage />} />
                        <Route path="inquiries" element={<InquiriesPage />} />
                        <Route path="inventory" element={<InventoryPage />} />
                        <Route path="sales" element={<SalesPage />} />
                        <Route path="debt" element={<DebtPage />} />
                        <Route path="expenses" element={<ExpensesPage />} />
                        <Route path="transactions" element={<TransactionsPage />} />
                        <Route path="users" element={<UsersPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="reports" element={<ReportsPage />} />
                        <Route path="branches" element={<BranchesPage />} />
                        <Route path="audit-logs" element={isSuperAdmin ? <AuditLogsPage /> : <Navigate to="/staff/dashboard" replace />} />
                        <Route path="about" element={<AboutPage />} />
                        <Route path="" element={<Navigate to="dashboard" replace />} />
                      </Routes>
                    </MainLayout>
                  );
                })()
              ) : (
                <Navigate to="/staff/login" replace />
              )
            } 
          />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <PWAInstallPrompt 
          deferredPrompt={deferredPrompt} 
          onInstall={handleInstallClick} 
          onDismiss={handleDismissInstall} 
        />
      </div>
    </Router>
  );
};

export default App;
