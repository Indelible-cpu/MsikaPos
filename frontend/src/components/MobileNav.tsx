import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Package, Receipt, Settings, ShoppingCart } from 'lucide-react';
import { clsx } from 'clsx';

const MobileNav: React.FC = () => {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: Home, path: '/dashboard' },
    { id: 'pos', label: 'Sale', icon: ShoppingCart, path: '/pos' },
    { id: 'inventory', label: 'Stock', icon: Package, path: '/inventory' },
    { id: 'sales', label: 'Sales', icon: Receipt, path: '/sales' },
    { id: 'settings', label: 'Menu', icon: Settings, path: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#121212] border-t border-white/5 md:hidden safe-area-bottom">
      <div className="flex items-stretch justify-around h-16">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.path}
            className={({ isActive }) => clsx(
              "flex flex-col items-center justify-center flex-1 transition-all duration-200",
              isActive ? "text-brand-green" : "text-white/60 hover:text-white"
            )}
          >
            <tab.icon className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNav;
