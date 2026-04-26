import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../db/posDB';

export default function MobileHeader() {
  const location = useLocation();
  const [shopName, setShopName] = useState('MsikaPos');
  const [shopLogo, setShopLogo] = useState('/icon.png?v=2');

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

    updateHeader();
    window.addEventListener('storage', updateHeader);
    return () => window.removeEventListener('storage', updateHeader);
  }, []);

  const getPageTitle = (pathname: string) => {
    const path = pathname.replace('/staff', '');
    switch (path) {
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
      case '/about': return 'About MsikaPos';
      case '/inquiries': return 'Inquiries';
      default: return 'System';
    }
  };

  const isBasePage = ['/dashboard', '/pos', '/stock', '/sales', '/reports'].includes(location.pathname);

  return (
    <>
      <header className="sticky top-0 w-full h-[calc(64px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-surface-bg/95 backdrop-blur-md border-b border-surface-border flex items-center justify-between px-4 z-[50] shadow-sm after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-primary-500/20 after:to-transparent">
        <div className="flex items-center gap-3 overflow-hidden">
          {isBasePage ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-10 h-10 rounded-full border border-primary-500/20 bg-surface-bg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"
            >
              <img src={shopLogo} alt="Logo" className="w-full h-full object-contain" />
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
            <span className="text-[14px] font-black tracking-tighter italic text-primary-500 leading-none truncate">
              {shopName}
            </span>
            <span className="text-[10px] font-black tracking-[0.2em] text-surface-text/60 italic uppercase truncate !mb-0">
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
        </div>
      </header>
    </>
  );
}
