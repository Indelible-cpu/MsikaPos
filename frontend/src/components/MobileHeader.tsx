import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../db/posDB';
import { useLiveQuery } from 'dexie-react-hooks';


export default function MobileHeader() {
  const location = useLocation();
  const [shopName, setShopName] = useState('Management');
  const [shopLogo, setShopLogo] = useState('/icon.png?v=2');

  const localSales = useLiveQuery(() => db.salesQueue.toArray());
  const today = new Date().toISOString().split('T')[0];
  const transactionsToday = (localSales || []).filter(s => 
    s.createdAt.startsWith(today) && 
    s.status !== 'DELETED' && 
    s.status !== 'REFUNDED'
  ).length;

  useEffect(() => {
    const updateHeader = async () => {
      const activeBranchId = localStorage.getItem('activeBranchId') || sessionStorage.getItem('activeBranchId');
      
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
        const storedName = localStorage.getItem('companyName') || sessionStorage.getItem('companyName');
        if (storedName) setShopName(storedName);
      }

      let storedLogo = localStorage.getItem('companyLogo') || sessionStorage.getItem('companyLogo');
      if (!storedLogo) {
        const logoSetting = await db.settings.get('company_logo');
        if (logoSetting?.value) storedLogo = logoSetting.value as string;
      }
      if (storedLogo) setShopLogo(storedLogo);
    };

    updateHeader();
    window.addEventListener('storage', updateHeader);
    return () => {
      window.removeEventListener('storage', updateHeader);
    };
  }, []);

  const getPageTitle = (pathname: string) => {
    const path = pathname.replace('/staff', '');
    switch (path) {
      case '/dashboard': return 'Dashboard';
      case '/pos': return 'Pos';
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
      case '/about': return 'MsikaPos Info';
      case '/inquiries': return 'Inquiry';
      case '/audit-logs': return 'Security logs';
      default: return 'MsikaPos';
    }
  };

  const isBasePage = ['/dashboard', '/pos', '/stock', '/sales', '/reports'].includes(location.pathname);

  return (
    <>
    <header className="sticky top-0 w-full h-[calc(64px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-background border-b border-border/50 flex items-center justify-between px-2 z-[100] shadow-sm after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-primary/20 after:to-transparent">
      <div className="flex items-center gap-1 overflow-hidden flex-1">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-9 h-9 rounded-full border border-primary/20 bg-background flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"
          >
            <img src={shopLogo} alt="Logo" className="w-full h-full object-cover" />
          </motion.div>

          {!isBasePage && (
            <button
              onClick={() => window.history.back()}
              className="p-1.5 bg-background rounded-lg border border-border/50 active:scale-90 transition-all flex-shrink-0 btn-press"
              title="Go back"
              aria-label="Go back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex flex-col min-w-0 flex-1 ml-0.5">
            <span className="text-[17px] font-black tracking-tighter text-primary leading-none block break-words">
              {shopName}
            </span>
            <span className="text-[8px] font-black tracking-[0.3em] text-muted-foreground truncate !mb-0 uppercase mt-0.5">
              {getPageTitle(location.pathname)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-2.5 h-2.5 bg-success rounded-full animate-pulse shadow-lg shadow-success/50" title="System Online" />

          <button
            onClick={() => window.location.href = '/staff/transactions'}
            className="relative p-2.5 bg-background border border-border/50 rounded-xl text-muted-foreground hover:text-primary active:scale-95 transition-all btn-press"
            title="Transactions"
            aria-label="Transactions"
          >
            <Bell className="w-5 h-5" />
            {transactionsToday > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-primary-foreground text-[8px] font-black rounded-full flex items-center justify-center border-2 border-background animate-pulse shadow-lg shadow-primary/20">
                {transactionsToday}
              </span>
            )}
          </button>
        </div>
      </header>
    </>
  );
}
