import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

import DashboardPage from './pages/DashboardPage';
import POSPage from './pages/POSPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import InventoryPage from './pages/InventoryPage';
import OrdersPage from './pages/OrdersPage';
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
import LandingPage from './pages/LandingPage';
import AuditLogsPage from './pages/AuditLogsPage';
import FeatureAccessPage from './pages/FeatureAccessPage';

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface-bg">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-surface-border border-t-primary-500 rounded-full animate-spin"></div>
      <p className="text-[10px] font-black tracking-widest text-surface-text/40 uppercase">Loading</p>
    </div>
  </div>
);
import { SyncService } from './services/SyncService';
import MainLayout from './components/MainLayout';
import FeatureGuard from './components/FeatureGuard';
import { db } from './db/posDB';
import { initDB } from './db/seedData';
import { AuditService } from './services/AuditService';
import { getBase64Image } from './utils/imageUtils';
import api from './api/client';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Removed BeforeInstallPromptEvent

const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(false);

  // PWA Auto-Update Logic
  const updateSWRef = React.useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  const pwaOptions = React.useMemo(() => ({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (!r) return;
      // Check for updates every 60 seconds
      setInterval(() => { r.update(); }, 60 * 1000);
      // Also check immediately when user switches back to this tab
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') r.update();
      });
    },
    onNeedRefresh() {
      toast.loading(() => (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-black tracking-widest text-white uppercase">Updating system</p>
          <p className="text-[9px] font-bold text-muted-foreground">Applying new features...</p>
        </div>
      ), { position: 'top-center' });
      
      setTimeout(() => {
        if (updateSWRef.current) {
          updateSWRef.current(true);
        } else {
          window.location.reload();
        }
      }, 1500);
    }
  }), []);

  const { updateServiceWorker } = useRegisterSW(pwaOptions);

  useEffect(() => {
    updateSWRef.current = updateServiceWorker;
  }, [updateServiceWorker]);


  useEffect(() => {
    // 1. Don't show if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone || localStorage.getItem('pwa-installed') === 'true') return;

    // 2. Don't show if user previously dismissed it
    if (localStorage.getItem('pwa-prompt-dismissed')) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // setDeferredPrompt(e as unknown as BeforeInstallPromptEvent); // Removed
    };

    const handleAppInstalled = () => {
      localStorage.setItem('pwa-installed', 'true');
      // setDeferredPrompt(null); // Removed
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

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
        await AuditService.log('SYNC_ERROR', 'Background sync failed', 'Error');
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

    let lastFocusCheck = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusCheck < 300000) return; // Only check once every 5 minutes
      lastFocusCheck = now;

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
          if (registration) {
            // Use requestIdleCallback if available to avoid blocking interaction
            const update = () => registration.update().catch(() => {});
            if ('requestIdleCallback' in window) {
              (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(update);
            } else {
              setTimeout(update, 1000);
            }
          }
        });
      }
    };
    window.addEventListener('focus', handleFocus);

    const init = async () => {
      try {
        await initDB(db);
        SyncService.init();
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
              const base64Logo = await getBase64Image(settings.logo);
              localStorage.setItem('companyLogo', base64Logo);
              sessionStorage.setItem('companyLogo', base64Logo);
              await db.settings.put({ key: 'company_logo', value: base64Logo });
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
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => checkSystemLock());
      } else {
        checkSystemLock();
      }
    }, 500);

    const lockInterval = setInterval(() => {
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => checkSystemLock());
      } else {
        checkSystemLock();
      }
    }, 60000); // Check lock every min

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };
    window.addEventListener('focusin', handleFocusIn);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('focusin', handleFocusIn);
      clearInterval(lockInterval);
    };
  }, [handleSync, checkSystemLock]);

  const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
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


  return (
    <Router>
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: 'hsl(var(--card) / 0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid hsl(var(--border))',
            borderRadius: '16px',
            padding: '12px 24px',
            color: 'hsl(var(--foreground))',
            fontWeight: '600',
            fontSize: '12px',
            letterSpacing: '-0.01em',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          },
          duration: 3000,
        }} 
      />
      <div className="min-h-screen selection:bg-primary-500/30">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/store" element={<PublicStorefront />} />
            <Route path="/about" element={<AboutPage />} />

            {/* Staff Auth */}
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/staff" element={<Navigate to="/staff/login" replace />} />
            <Route path="/staff/login" element={<LoginPage />} />
            <Route path="/staff/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/staff/onboarding" element={(localStorage.getItem('token') || sessionStorage.getItem('token')) ? <OnboardingPage /> : <Navigate to="/staff/login" replace />} />
            
            {/* Private Staff Interface */}
            <Route 
              path="/staff/*" 
              element={
                (localStorage.getItem('token') || sessionStorage.getItem('token')) ? (
                  (() => {
                      let u;
                      try {
                        u = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
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
                          <Route element={<FeatureGuard featureKey="DASHBOARD" />}><Route path="dashboard" element={<DashboardPage />} /></Route>
                          <Route element={<FeatureGuard featureKey="POS_TERMINAL" />}><Route path="pos" element={<POSPage />} /></Route>
                          <Route element={<FeatureGuard featureKey="INVENTORY" />}><Route path="inventory" element={<InventoryPage />} /></Route>
                          <Route element={<FeatureGuard featureKey="INVENTORY" />}><Route path="orders" element={<OrdersPage />} /></Route>
                          <Route element={<FeatureGuard featureKey="SALES_HISTORY" />}><Route path="sales" element={<SalesPage />} /></Route>
                          <Route element={<FeatureGuard featureKey="CUSTOMERS" />}><Route path="debt" element={<DebtPage />} /></Route>
                          <Route element={<FeatureGuard featureKey="FINANCE" />}><Route path="expenses" element={<ExpensesPage />} /></Route>
                          <Route element={<FeatureGuard featureKey="SALES_HISTORY" />}><Route path="transactions" element={<TransactionsPage />} /></Route>
                          <Route element={<FeatureGuard featureKey="STAFF" />}><Route path="users" element={<UsersPage />} /></Route>
                          <Route element={<FeatureGuard featureKey="SETTINGS" />}><Route path="settings" element={<SettingsPage />} /></Route>
                          <Route element={<FeatureGuard featureKey="REPORTS" />}><Route path="reports" element={<ReportsPage />} /></Route>
                          <Route element={<FeatureGuard featureKey="BRANCHES" />}><Route path="branches" element={<BranchesPage />} /></Route>
                          <Route path="audit-logs" element={isSuperAdmin ? <AuditLogsPage /> : <Navigate to="/staff/dashboard" replace />} />
                          <Route path="feature-access" element={isSuperAdmin ? <FeatureAccessPage /> : <Navigate to="/staff/dashboard" replace />} />
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
        </Suspense>
      </div>
    </Router>
  );
};

export default App;
