import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, BarChart3, Receipt, Settings, ShoppingCart, LogOut, Users, Wallet, Package, UserCheck, Building2, MessageSquare, History } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = React.useState(0);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const { canAccess } = useFeatureAccess();

  const tabs = [
    { id: 'dashboard', key: 'DASHBOARD', label: 'Dashboard', icon: Home, path: '/staff/dashboard' },
    { id: 'pos', key: 'POS_TERMINAL', label: 'Pos terminal', icon: ShoppingCart, path: '/staff/pos' },
    { id: 'transactions', key: 'SALES_HISTORY', label: 'Sales history', icon: Receipt, path: '/staff/transactions' },
    { id: 'debt', key: 'CUSTOMERS', label: 'Credit center', icon: Users, path: '/staff/debt' },
    { id: 'inventory', key: 'INVENTORY', label: 'Stock management', icon: Package, path: '/staff/inventory' },
    { id: 'inquiries', key: 'INQUIRIES', label: 'Inquiry', icon: MessageSquare, path: '/staff/inquiries', badge: pendingCount },
    { id: 'expenses', key: 'FINANCE', label: 'Finance & expenses', icon: Wallet, path: '/staff/expenses' },
    { id: 'team', key: 'STAFF', label: 'Staff management', icon: UserCheck, path: '/staff/users' },
    { id: 'branches', key: 'BRANCHES', label: 'Branch management', icon: Building2, path: '/staff/branches' },
    { id: 'reports', key: 'REPORTS', label: 'System reports', icon: BarChart3, path: '/staff/reports' },
    { id: 'settings', key: 'SETTINGS', label: 'System settings', icon: Settings, path: '/staff/settings' },
    ...(isSuperAdmin ? [{ id: 'audit', key: 'AUDIT_LOGS', label: 'Security logs', icon: History, path: '/staff/audit-logs' }] : []),
  ];

  const filteredTabs = tabs.filter(tab => canAccess(tab.key));

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

  React.useEffect(() => {
    const loadSidebar = async () => {
      fetchPending();
    };
    loadSidebar();
    const interval = setInterval(fetchPending, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [fetchPending]);


  return (
    <aside className="hidden md:flex flex-col w-72 bg-surface-card border-r border-surface-border h-screen sticky top-0 overflow-hidden">
      {/* Navigation - Scrollable */}
      <nav className="flex-1 overflow-y-auto px-6 py-8 space-y-1.5 custom-scrollbar">
        {filteredTabs.map((tab) => (
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
                <span className="truncate">{tab.label.charAt(0).toUpperCase() + tab.label.slice(1).toLowerCase()}</span>
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
           <span className="text-[7px] font-black tracking-[0.2em]">Powered by Msikapos</span>
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
