import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, BarChart3, Receipt, Settings, ShoppingCart, LogOut, Users, Wallet, Package, UserCheck, Building2, MessageSquare, History } from 'lucide-react';
import BranchSwitcher from './BranchSwitcher';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { db } from '../db/posDB';
import api from '../api/client';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = React.useState(0);
  const [pendingCount, setPendingCount] = React.useState(0);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/staff/dashboard' },
    { id: 'pos', label: 'POS Terminal', icon: ShoppingCart, path: '/staff/pos' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, path: '/staff/transactions' },
    { id: 'debt', label: 'Customers & Debt', icon: Users, path: '/staff/debt' },
    { id: 'inventory', label: 'Stock Management', icon: Package, path: '/staff/inventory' },
    { id: 'inquiries', label: 'Inquiries & Requests', icon: MessageSquare, path: '/staff/inquiries', badge: pendingCount },
    { id: 'expenses', label: 'Finance & Expenses', icon: Wallet, path: '/staff/expenses' },
    { id: 'team', label: 'Staff Management', icon: UserCheck, path: '/staff/users' },
    { id: 'branches', label: 'Branch Management', icon: Building2, path: '/staff/branches' },
    { id: 'reports', label: 'System Reports', icon: BarChart3, path: '/staff/reports' },
    { id: 'settings', label: 'System Settings', icon: Settings, path: '/staff/settings' },
    ...(isSuperAdmin ? [{ id: 'audit', label: 'Security & Audits', icon: History, path: '/staff/audit-logs' }] : []),
  ];

  const fetchPending = React.useCallback(async () => {
    try {
      const res = await api.get('/inquiries');
      const pending = res.data.data.filter((i: { status: string }) => i.status === 'NEW').length;
      setPendingCount(pending);
    } catch { /* silent */ }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Signed out successfully');
    navigate('/staff/login');
  };

  const [shopLogo, setShopLogo] = React.useState('/icon.png?v=2');

  React.useEffect(() => {
    const loadSidebar = async () => {
      const company = await db.settings.get('company_config');
      if (company?.value) {
        // Logo is still in storage for now
      }
      const storedLogo = localStorage.getItem('companyLogo');
      if (storedLogo) setShopLogo(storedLogo);
      
      
      fetchPending();
    };
    loadSidebar();
    const interval = setInterval(fetchPending, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [fetchPending, isSuperAdmin]);


  return (
    <aside className="hidden md:flex flex-col w-72 bg-surface-card border-r border-surface-border h-screen sticky top-0 overflow-hidden">
      {/* Brand Header - Fixed */}
      <div className="p-8 pb-4 shrink-0 flex flex-col items-center text-center">
        <div className="w-24 h-24 flex items-center justify-center overflow-hidden flex-shrink-0 rounded-full bg-surface-bg border border-surface-border shadow-2xl p-1 mb-4 group-hover:scale-105 transition-transform">
          <img src={shopLogo} alt="MsikaPos Logo" className="w-full h-full object-cover" />
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-black text-primary-500 tracking-[0.3em] opacity-80 uppercase">Cloud Powered POS</div>
          <div className="w-12 h-1 bg-primary-500/20 mx-auto rounded-full"></div>
        </div>

        {isSuperAdmin && (
          <div className="w-full mt-6 flex justify-center">
            <BranchSwitcher />
          </div>
        )}
      </div>

      {/* Navigation - Scrollable */}
      <nav className="flex-1 overflow-y-auto px-6 py-4 space-y-1.5 custom-scrollbar">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.path}
            className={({ isActive }) => clsx(
              "flex items-center gap-4 px-5 h-14 rounded-[2rem] font-black tracking-widest text-[13px] transition-all group shrink-0 relative",
              isActive 
                ? "bg-primary-500 text-white shadow-xl shadow-primary-500/20 scale-[1.02]" 
                : "text-surface-text/40 hover:text-primary-500 hover:bg-primary-500/5 border border-transparent hover:border-primary-500/10"
            )}
          >
            {({ isActive }) => (
              <>
                <tab.icon className={clsx("w-6 h-6 transition-transform group-hover:scale-110")} strokeWidth={isActive ? 3 : 2} />
                <span className="truncate">{tab.label}</span>
                {tab.badge ? (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black border-2 border-surface-card animate-pulse shadow-lg shadow-rose-500/20">
                    {tab.badge}
                  </span>
                ) : null}
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
        <div className="mt-4 px-4 flex items-center justify-between opacity-30">
           <span className="text-[7px] font-black tracking-[0.2em] uppercase">Powered by MsikaPOS</span>
           <div className={clsx(
             "w-1.5 h-1.5 rounded-full",
             navigator.onLine ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
           )}></div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
