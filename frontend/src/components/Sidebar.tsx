import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, BarChart3, Receipt, Settings, ShoppingCart, LogOut, Users, Wallet, Package, UserCheck, Building2 } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'pos', label: 'POS Terminal', icon: ShoppingCart, path: '/pos' },
    { id: 'sales', label: 'Daily Sales', icon: Receipt, path: '/sales' },
    { id: 'debt', label: 'Debt Management', icon: Users, path: '/debt' },
    { id: 'expenses', label: 'Expenses Tracking', icon: Wallet, path: '/expenses' },
    { id: 'inventory', label: 'Stock Management', icon: Package, path: '/inventory' },
    { id: 'team', label: 'Team Management', icon: UserCheck, path: '/users' },
    { id: 'branches', label: 'Branch Management', icon: Building2, path: '/branches' },
    { id: 'transactions', label: 'Transactions History', icon: BarChart3, path: '/transactions' },
    { id: 'reports', label: 'Sales Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Signed out successfully');
    navigate('/login');
  };

  return (
    <aside className="hidden md:flex flex-col w-72 bg-surface-card border-r border-surface-border h-screen sticky top-0 overflow-hidden">
      {/* Brand Header - Fixed */}
      <div className="p-8 pb-4 shrink-0 flex flex-col items-center text-center">
        <div className="w-24 h-24 flex items-center justify-center overflow-hidden flex-shrink-0 rounded-full bg-surface-bg border border-surface-border shadow-2xl p-1 mb-4 group-hover:scale-105 transition-transform">
          <img src="/icon.png?v=2" alt="Vendrax Logo" className="w-full h-full object-contain" />
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-black text-primary-500 tracking-[0.3em] uppercase opacity-80">Cloud POS</div>
          <div className="w-12 h-1 bg-primary-500/20 mx-auto rounded-full"></div>
        </div>
      </div>

      {/* Navigation - Scrollable */}
      <nav className="flex-1 overflow-y-auto px-6 py-4 space-y-1.5 custom-scrollbar">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.path}
            className={({ isActive }) => clsx(
              "flex items-center gap-4 px-5 h-14 rounded-[1.5rem] font-black tracking-widest text-[13px] transition-all group shrink-0 uppercase",
              isActive 
                ? "bg-primary-500 text-white shadow-xl shadow-primary-500/20 scale-[1.02]" 
                : "text-surface-text/40 hover:text-primary-500 hover:bg-primary-500/5 border border-transparent hover:border-primary-500/10"
            )}
          >
            {({ isActive }) => (
              <>
                <tab.icon className={clsx("w-5 h-5 transition-transform group-hover:scale-110")} strokeWidth={isActive ? 3 : 2} />
                <span className="truncate">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer - Fixed */}
      <div className="p-4 border-t border-surface-border shrink-0">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-4 px-4 h-14 w-full rounded-2xl font-black tracking-widest text-[13px] text-red-500 hover:text-red-600 hover:bg-red-500/5 transition-all group border border-transparent hover:border-red-500/10 shrink-0"
        >
          <LogOut className="w-6 h-6 transition-transform group-hover:scale-110" strokeWidth={2.5} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
