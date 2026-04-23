import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

interface MobileHeaderProps {
  isOnline: boolean;
  isSyncing: boolean;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ isOnline, isSyncing }) => {
  const location = useLocation();
  const [pageTitle, setPageTitle] = useState('Vendrax');
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    const updateLogo = () => setLogo(localStorage.getItem('companyLogo'));
    updateLogo();
    window.addEventListener('storage', updateLogo);
    return () => window.removeEventListener('storage', updateLogo);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      const path = location.pathname.split('/')[1] || '';
      switch (path) {
        case 'dashboard': setPageTitle('Dashboard'); break;
        case 'pos': setPageTitle('Point of Sale'); break;
        case 'inventory': setPageTitle('Inventory'); break;
        case 'sales': setPageTitle('Sales Records'); break;
        case 'debt': setPageTitle('Debt Book'); break;
        case 'expenses': setPageTitle('Expenses'); break;
        case 'transactions': setPageTitle('Transactions'); break;
        case 'users': setPageTitle('Team'); break;
        case 'settings': setPageTitle('Settings'); break;
        default: setPageTitle('Vendrax');
      }
    }, 0);
  }, [location]);

  return (
    <header className="sticky top-0 z-50 md:hidden bg-surface-card border-b border-surface-border px-5 py-3 flex items-center justify-between backdrop-blur-xl bg-opacity-90">
      {/* Decorative subtle element */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 via-transparent to-primary-500/5 pointer-events-none" />
      
      <div className="flex items-center gap-3 relative z-10">
        <div className="w-10 h-10 rounded-full border border-primary-500/30 overflow-hidden shrink-0 bg-surface-bg flex items-center justify-center shadow-lg shadow-primary-500/10">
          <img src={logo || '/vendrax-logo.png'} alt="Vendrax" className="w-full h-full object-cover scale-[1.2]" />
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-[17px] font-black text-primary-500 leading-none mb-0.5 tracking-tighter italic">VENDRAX</span>
          <h1 className="text-[9px] font-black tracking-[0.1em] text-surface-text/40 uppercase leading-none">{pageTitle}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isSyncing && (
          <div className="flex items-center gap-2 px-3 py-1 bg-primary-500/10 rounded-full animate-pulse border border-primary-500/20">
            <RefreshCw className="w-3 h-3 text-primary-400 animate-spin" />
            <span className="text-[8px] font-bold text-primary-400">Syncing</span>
          </div>
        )}
        
        <div className={clsx(
          "flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all",
          isOnline 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
            : "bg-red-500/10 border-red-500/20 text-red-500"
        )}>
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="text-[8px] font-bold">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
