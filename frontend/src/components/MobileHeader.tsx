import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, ChevronLeft, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../db/posDB';
import BranchSwitcher from './BranchSwitcher';

export default function MobileHeader() {
  const location = useLocation();
  const [shopName, setShopName] = useState('Management');
  const [shopLogo, setShopLogo] = useState('/icon.png?v=2');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const updateHeader = async () => {
      // Try DB first for persistence across logouts
      const company = await db.settings.get('company_config');
      if (company?.value) {
        setShopName((company.value as { name: string }).name);
      } else {
        const storedName = localStorage.getItem('companyName');
        if (storedName) setShopName(storedName);
      }

      const storedLogo = localStorage.getItem('companyLogo');
      if (storedLogo) setShopLogo(storedLogo);
    };

    const fetchPending = async () => {
      try {
        const api = (await import('../api/client')).default;
        const res = await api.get('/inquiries');
        const pending = res.data.data.filter((i: { status: string }) => i.status === 'NEW').length;
        setPendingCount(pending);
      } catch { /* silent */ }
    };

    updateHeader();
    fetchPending();
    const interval = setInterval(fetchPending, 15000);
    window.addEventListener('storage', updateHeader);
    return () => {
      window.removeEventListener('storage', updateHeader);
      clearInterval(interval);
    };
  }, []);

  const getPageTitle = (pathname: string) => {
    const path = pathname.replace('/staff', '');
    switch (path) {
      case '/dashboard': return 'Dashboard';
      case '/pos': return 'POS Terminal';
      case '/inventory': return 'Inventory';
      case '/sales': return 'Sale History';
      case '/reports': return 'Business Reports';
      case '/settings': return 'System Settings';
      case '/branches': return 'Branch Management';
      case '/debt': return 'Customer Debt';
      case '/expenses': return 'Finance Logs';
      case '/transactions': return 'System Audit';
      case '/users': return 'Staff Directory';
      case '/onboarding': return 'Account Setup';
      case '/about': return 'MsikaPos Info';
      case '/inquiries': return 'Customer Support';
      default: return 'MsikaPos';
    }
  };

  const isBasePage = ['/dashboard', '/pos', '/stock', '/sales', '/reports'].includes(location.pathname);

  return (
    <>
      <header className="sticky top-0 w-full h-[calc(64px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-surface-bg/95 backdrop-blur-md border-b border-surface-border flex items-center justify-between px-4 z-[100] shadow-sm after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-primary-500/20 after:to-transparent">
        <div className="flex items-center gap-3 overflow-hidden">
          {!isBasePage && (
            <button 
              onClick={() => window.history.back()}
              className="p-2 bg-surface-bg rounded-xl border border-surface-border active:scale-95 transition-all flex-shrink-0"
              title="Go back"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-10 h-10 rounded-full border border-primary-500/20 bg-surface-bg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"
          >
            <img src={shopLogo} alt="Logo" className="w-full h-full object-contain" />
          </motion.div>
          
          <div className="flex flex-col min-w-0">
            <span className="text-[14px] font-black tracking-tighter text-primary-500 leading-none truncate">
              {shopName}
            </span>
            <span className="text-[10px] font-black tracking-[0.2em] text-surface-text/60 truncate !mb-0 uppercase">
              {getPageTitle(location.pathname)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {JSON.parse(localStorage.getItem('user') || '{}').role === 'SUPER_ADMIN' && (
            <div className="scale-75 origin-right">
              <BranchSwitcher />
            </div>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="p-2.5 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-primary-500 active:scale-95 transition-all"
            title="Refresh Page"
            aria-label="Refresh Page"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button 
            onClick={() => window.location.href = '/staff/inquiries'}
            className="relative p-2.5 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-primary-500 active:scale-95 transition-all"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-surface-card animate-pulse shadow-lg shadow-rose-500/20">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </header>
    </>
  );
}
