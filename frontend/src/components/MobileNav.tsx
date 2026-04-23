import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Package, Receipt, Settings, ShoppingCart } from 'lucide-react';
import { clsx } from 'clsx';

const MobileNav: React.FC = () => {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: Home, path: '/dashboard' },
    { id: 'sales', label: 'Logs', icon: Receipt, path: '/sales' },
    { id: 'pos', label: 'POS', icon: ShoppingCart, path: '/pos' },
    { id: 'inventory', label: 'Stock', icon: Package, path: '/inventory' },
    { id: 'settings', label: 'Menu', icon: Settings, path: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-card/95 backdrop-blur-md border-t border-surface-border md:hidden safe-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.path}
            className={({ isActive }) => clsx(
              "flex flex-col items-center justify-center flex-1 transition-all duration-300 h-full",
              isActive ? "text-primary-500" : "text-surface-text/30 hover:text-surface-text"
            )}
          >
            {({ isActive }) => (
              <>
                <div className={clsx(
                  "transition-all duration-300 flex items-center justify-center relative",
                  isActive && "after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary-500 after:rounded-full shadow-primary-500/10"
                )}>
                  <tab.icon className={clsx("w-6 h-6", isActive && "scale-110")} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={clsx(
                  "text-[8px] font-black tracking-widest uppercase mt-1.5 transition-all",
                  isActive ? "opacity-100 translate-y-0" : "opacity-40"
                )}>
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNav;
