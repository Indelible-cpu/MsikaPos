import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Package, Receipt, Settings, ShoppingCart } from 'lucide-react';
import { clsx } from 'clsx';

const MobileNav: React.FC = () => {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: Home, path: '/dashboard' },
    { id: 'sales', label: 'Sales', icon: Receipt, path: '/sales' },
    { id: 'pos', label: 'POS', icon: ShoppingCart, path: '/pos', isCenter: true },
    { id: 'inventory', label: 'Stock', icon: Package, path: '/inventory' },
    { id: 'settings', label: 'Menu', icon: Settings, path: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-card border-t border-surface-border md:hidden">
      <div className="flex items-end justify-around h-[64px]">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.path}
            className={({ isActive }) => clsx(
              "flex flex-col items-center justify-center flex-1 transition-all duration-300 py-2",
              isActive ? "text-primary-500" : "text-surface-text/40 hover:text-surface-text",
              tab.isCenter && "relative -top-4"
            )}
          >
            {({ isActive }) => (
              <>
                <div className={clsx(
                  "transition-all duration-300 flex items-center justify-center",
                  tab.isCenter ? (
                    isActive 
                      ? "w-14 h-14 bg-primary-500 text-white rounded-full shadow-lg shadow-primary-500/40 -mb-1" 
                      : "w-12 h-12 bg-surface-card border-2 border-primary-500/20 text-primary-500 rounded-full shadow-md"
                  ) : (
                    isActive ? "scale-110" : ""
                  )
                )}>
                  <tab.icon className={clsx(tab.isCenter ? "w-6 h-6" : "w-5 h-5")} />
                </div>
                <span className={clsx(
                  "text-[8px] font-black tracking-[0.15em] uppercase mt-1 transition-opacity",
                  tab.isCenter && !isActive && "opacity-0"
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
