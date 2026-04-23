import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, BarChart3, Receipt, Settings, ShoppingCart, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'pos', label: 'POS Terminal', icon: ShoppingCart, path: '/pos' },
    { id: 'sales', label: 'Transaction Logs', icon: Receipt, path: '/sales' },
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
    <aside className="hidden md:flex flex-col w-72 bg-surface-card border-r border-surface-border h-screen sticky top-0">
      <div className="p-8">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-10 h-10 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src="/icon.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-black text-primary-500 tracking-tighter italic leading-none">Vendrax</h1>
            <p className="text-surface-text/40 text-[8px] font-black tracking-widest mt-1">Cloud POS System</p>
          </div>
        </div>

        <nav className="space-y-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={({ isActive }) => clsx(
                "flex items-center gap-4 px-4 h-14 rounded-2xl font-black tracking-widest text-[10px] transition-all group",
                isActive 
                  ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20" 
                  : "text-surface-text/40 hover:text-surface-text hover:bg-surface-bg border border-transparent hover:border-surface-border"
              )}
            >
              <tab.icon className={clsx("w-5 h-5 transition-transform group-hover:scale-110")} />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-8 border-t border-surface-border">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-4 px-4 h-14 w-full rounded-2xl font-black tracking-widest text-[10px] text-red-500/60 hover:text-red-500 hover:bg-red-500/5 transition-all group border border-transparent hover:border-red-500/10"
        >
          <LogOut className="w-5 h-5 transition-transform group-hover:scale-110" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
