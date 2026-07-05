import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Receipt, ShoppingCart, MoreHorizontal, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import MoreOptionsMenu from './MoreOptionsMenu';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

const MobileNav: React.FC = () => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { canAccess } = useFeatureAccess();

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: Home, path: '/staff/dashboard', feature: 'DASHBOARD' },
    { id: 'sales', label: 'Sales', icon: Receipt, path: '/staff/transactions', feature: 'SALES_HISTORY' },
    { id: 'pos', label: 'Pos', icon: ShoppingCart, path: '/staff/pos', feature: 'POS_TERMINAL' },
    { id: 'expenses', label: 'Salary', icon: Wallet, path: '/staff/expenses', feature: 'FINANCE' },
  ].filter(t => canAccess(t.feature));


  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border/50 md:hidden safe-bottom">
        <div className="flex items-center justify-around h-16 px-4">
          {tabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={({ isActive }) => clsx(
                "flex flex-col items-center justify-center flex-1 transition-all duration-500 h-14 rounded-2xl relative btn-press",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {({ isActive }) => (
                <>
                  <div className={clsx(
                    "transition-all duration-300 flex items-center justify-center relative",
                    isActive ? "scale-110 opacity-100" : "opacity-60"
                  )}>
                    <tab.icon className={clsx("w-6 h-6")} strokeWidth={isActive ? 3 : 2} />
                  </div>
                  <span className={clsx(
                    "text-[9px] font-black tracking-[0.2em] mt-1.5 transition-all",
                    isActive ? "text-primary opacity-100" : "text-muted-foreground opacity-80"
                  )}>
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
          
          <button
            onClick={() => setIsMoreOpen(true)}
            className={clsx(
              "flex flex-col items-center justify-center flex-1 transition-all duration-500 h-14 rounded-2xl relative text-surface-text",
            )}
          >
            <div className="transition-all duration-300 flex items-center justify-center opacity-60">
              <MoreHorizontal className="w-5 h-5" strokeWidth={2} />
            </div>
            <span className="text-[9px] font-black tracking-[0.2em] mt-1.5 transition-all opacity-80 text-surface-text">
              More
            </span>
          </button>
        </div>
      </nav>

      <MoreOptionsMenu isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </>
  );
};

export default MobileNav;
