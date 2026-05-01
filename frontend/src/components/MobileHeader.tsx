import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, ChevronLeft } from 'lucide-react';
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
      const activeBranchId = localStorage.getItem('activeBranchId');
      
      // Try to get branch name if activeBranchId exists
      if (activeBranchId) {
        try {
          const api = (await import('../api/client')).default;
          const res = await api.get('/branches?minimal=1');
          if (res.data.success) {
            const branches = res.data.data;
            const activeBranch = branches.find((b: { id: number }) => b.id === parseInt(activeBranchId));
            if (activeBranch) {
              setShopName(activeBranch.name);
              return; // Found branch name, no need to check company config
            }
          }
        } catch (e) {
          console.error('Failed to fetch branch name for header:', e);
        }
      }

      // Fallback to company config
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
      case '/pos': return 'Pos terminal';
      case '/inventory': return 'Inventory';
      case '/sales': return 'Sales history';
      case '/reports': return 'Business reports';
      case '/settings': return 'System settings';
      case '/branches': return 'Branch management';
      case '/debt': return 'Credit center';
      case '/expenses': return 'Finance & expenses';
      case '/transactions': return 'Sales history';
      case '/users': return 'Staff management';
      case '/onboarding': return 'Account setup';
      case '/about': return 'Msikapos info';
      case '/inquiries': return 'Inquiry';
      case '/audit-logs': return 'Security logs';
      default: return 'Msikapos';
    }
  };

  const isBasePage = ['/dashboard', '/pos', '/stock', '/sales', '/reports'].includes(location.pathname);

  return (
    <>
      <header className="sticky top-0 w-full h-[calc(64px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-surface-bg/95 backdrop-blur-md border-b border-surface-border flex items-center justify-between px-4 z-[100] shadow-sm after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-primary-500/20 after:to-transparent md:hidden">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-9 h-9 rounded-full border border-primary-500/20 bg-surface-bg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"
          >
            <img src={shopLogo} alt="Logo" className="w-full h-full object-cover" />
          </motion.div>

          {!isBasePage && (
            <button
              onClick={() => window.history.back()}
              className="p-1.5 bg-surface-bg rounded-lg border border-surface-border active:scale-90 transition-all flex-shrink-0"
              title="Go back"
              aria-label="Go back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex flex-col min-w-0 flex-1 ml-1">
            <span className="text-[17px] font-black tracking-tighter text-primary-500 leading-none truncate block">
              {shopName}
            </span>
            <span className="text-[8px] font-black tracking-[0.3em] text-surface-text/40 truncate !mb-0 uppercase mt-1">
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
