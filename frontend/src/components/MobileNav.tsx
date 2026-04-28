import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Receipt, ShoppingCart, MoreHorizontal, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';
import MoreOptionsMenu from './MoreOptionsMenu';
import api from '../api/client';

const MobileNav: React.FC = () => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPending = React.useCallback(async () => {
    try {
      const res = await api.get('/inquiries');
      const pending = res.data.data.filter((i: any) => i.status === 'NEW').length;
      setPendingCount(pending);
    } catch { /* silent */ }
  }, []);

  React.useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 15000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: Home, path: '/staff/dashboard' },
    { id: 'sales', label: 'Logs', icon: Receipt, path: '/staff/transactions' },
    { id: 'pos', label: 'Pos', icon: ShoppingCart, path: '/staff/pos' },
    { id: 'inquiries', label: 'Inquiry', icon: MessageSquare, path: '/staff/inquiries', badge: pendingCount },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-card/80 backdrop-blur-xl border-t border-surface-border md:hidden safe-bottom pb-2">
        <div className="flex items-center justify-around h-20 px-4">
          {tabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={({ isActive }) => clsx(
                "flex flex-col items-center justify-center flex-1 transition-all duration-500 h-14 rounded-2xl relative",
                isActive ? "text-primary-500 bg-primary-500/5" : "text-surface-text"
              )}
            >
              {({ isActive }) => (
                <>
                  <div className={clsx(
                    "transition-all duration-300 flex items-center justify-center relative",
                    isActive ? "scale-110 opacity-100" : "opacity-60"
                  )}>
                    <tab.icon className={clsx("w-6 h-6")} strokeWidth={isActive ? 3 : 2} />
                    {tab.badge ? (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[7px] font-black border border-surface-card animate-pulse shadow-lg shadow-rose-500/20">
                        {tab.badge}
                      </span>
                    ) : null}
                  </div>
                  <span className={clsx(
                    "text-[9px] font-black tracking-[0.2em] mt-1.5 transition-all",
                    isActive ? "text-black dark:text-white opacity-100" : "text-surface-text opacity-80"
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
            <span className="text-[8px] font-black tracking-[0.2em] mt-1.5 transition-all opacity-80 text-surface-text">
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
