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
  const [pageTitle, setPageTitle] = useState('Jims POS');

  useEffect(() => {
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
      default: setPageTitle('Jims POS');
    }
  }, [location]);

  return (
    <header className="sticky top-0 z-50 md:hidden bg-surface-card border-b border-surface-border px-6 py-4 flex items-center justify-between backdrop-blur-md bg-opacity-80">
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400 leading-none mb-1">Jims POS</span>
        <h1 className="text-lg font-black tracking-tighter text-surface-text">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-4">
        {isSyncing && (
          <div className="flex items-center gap-2 px-3 py-1 bg-primary-500/10 rounded-full animate-pulse border border-primary-500/20">
            <RefreshCw className="w-3 h-3 text-primary-400 animate-spin" />
            <span className="text-[8px] font-black text-primary-400 uppercase tracking-widest">Syncing</span>
          </div>
        )}
        
        <div className={clsx(
          "flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all",
          isOnline 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
            : "bg-red-500/10 border-red-500/20 text-red-500"
        )}>
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="text-[8px] font-black uppercase tracking-widest">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
