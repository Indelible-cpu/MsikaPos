import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, ChevronLeft, LayoutGrid } from 'lucide-react';
import { motion } from 'framer-motion';
import MoreSheet from './MoreSheet';

export default function MobileHeader() {
  const location = useLocation();
  const [shopName, setShopName] = useState('Vendrax');
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => {
    const updateHeader = () => {
      const storedName = localStorage.getItem('companyName');
      if (storedName) setShopName(storedName);
    };

    updateHeader();
    window.addEventListener('storage', updateHeader);
    return () => window.removeEventListener('storage', updateHeader);
  }, []);

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/dashboard': return 'Overview';
      case '/pos': return 'Point of Sale';
      case '/inventory': return 'Stock Management';
      case '/sales': return 'Sale Logs';
      case '/reports': return 'Analytics';
      case '/settings': return 'Settings';
      case '/branches': return 'Branches';
      case '/debt': return 'Credit & Debt';
      case '/expenses': return 'Expenses';
      case '/transactions': return 'Audit History';
      case '/users': return 'Team Management';
      case '/onboarding': return 'Setup';
      default: return 'System';
    }
  };

  const isBasePage = ['/dashboard', '/pos', '/stock', '/sales', '/reports'].includes(location.pathname);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-[calc(64px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-surface-card/95 backdrop-blur-md border-b border-surface-border flex items-center justify-between px-4 z-[50] shadow-sm after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-primary-500/20 after:to-transparent">
        <div className="flex items-center gap-3 overflow-hidden">
          {isBasePage ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-10 h-10 rounded-full border border-primary-500/20 bg-surface-bg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"
            >
              <img src="/icon.png?v=2" alt="Logo" className="w-full h-full object-contain" />
            </motion.div>
          ) : (
            <button 
              onClick={() => window.history.back()}
              className="p-2 bg-surface-bg rounded-xl border border-surface-border active:scale-95 transition-all flex-shrink-0"
              title="Go back"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          
          <div className="flex flex-col min-w-0">
            <span className="text-[14px] font-black tracking-tighter italic text-primary-500 leading-none truncate uppercase">
              {shopName}
            </span>
            <span className="card-label !mb-0 truncate">
              {getPageTitle(location.pathname)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            className="relative p-2.5 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 active:scale-95 transition-all"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary-500 rounded-full border-2 border-surface-card"></span>
          </button>
          <button 
            onClick={() => setIsMoreOpen(true)}
            className="w-10 h-10 rounded-xl border border-surface-border bg-surface-bg flex items-center justify-center overflow-hidden active:scale-95 transition-all text-surface-text/40 hover:text-primary-500 hover:border-primary-500/20"
            title="More Options"
            aria-label="More Options"
          >
             <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </header>

      <MoreSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </>
  );
}
