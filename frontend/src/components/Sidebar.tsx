import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, BarChart3, Receipt, Settings, ShoppingCart, LogOut, Users, Wallet, Package, UserCheck, Building2, History } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { db } from '../db/posDB';
import { SyncService } from '../services/SyncService';
import ThemeToggle from './ThemeToggle';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const { canAccess } = useFeatureAccess();

  const tabs = [
    { id: 'dashboard', key: 'DASHBOARD', label: 'Dashboard', icon: Home, path: '/staff/dashboard' },
    { id: 'pos', key: 'POS_TERMINAL', label: 'Pos', icon: ShoppingCart, path: '/staff/pos' },
    { id: 'transactions', key: 'SALES_HISTORY', label: 'Sales history', icon: Receipt, path: '/staff/transactions' },
    { id: 'debt', key: 'CUSTOMERS', label: 'Credit center', icon: Users, path: '/staff/debt' },
    { id: 'inventory', key: 'INVENTORY', label: 'Stock management', icon: Package, path: '/staff/inventory' },
    { id: 'expenses', key: 'FINANCE', label: 'Salary & expenses', icon: Wallet, path: '/staff/expenses' },
    { id: 'team', key: 'STAFF', label: 'Staff management', icon: UserCheck, path: '/staff/users' },
    { id: 'branches', key: 'BRANCHES', label: 'Branch management', icon: Building2, path: '/staff/branches' },
    { id: 'reports', key: 'REPORTS', label: 'System reports', icon: BarChart3, path: '/staff/reports' },
    { id: 'settings', key: 'SETTINGS', label: 'System settings', icon: Settings, path: '/staff/settings' },
    ...(isSuperAdmin ? [{ id: 'audit', key: 'AUDIT_LOGS', label: 'Security logs', icon: History, path: '/staff/audit-logs' }] : []),
  ];

  const filteredTabs = tabs.filter(tab => canAccess(tab.key));

  const handleLogout = async () => {
    try {
      let unsynced = await db.salesQueue.where('synced').equals(0).count();
      if (unsynced > 0) {
        toast.loading('Syncing pending sales...', { id: 'logout-sync' });
        await SyncService.pushSales();
        unsynced = await db.salesQueue.where('synced').equals(0).count();
        if (unsynced > 0) {
          toast.dismiss('logout-sync');
          toast((t) => (
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-black tracking-wide text-rose-500 uppercase">Logout Blocked</span>
              <span className="text-[10px] font-bold text-muted-foreground leading-relaxed">
                You have {unsynced} unsynced sales. Please connect to the internet to sync them before logging out to prevent data loss.
              </span>
              <div className="flex justify-end mt-1">
                <button 
                  className="px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                  onClick={() => toast.dismiss(t.id)}
                >
                  Understood
                </button>
              </div>
            </div>
          ), { duration: 5000 });
          return;
        } else {
          toast.success('Sync complete.', { id: 'logout-sync' });
        }
      }
      await db.delete();
    } catch (e) {
      console.warn('Error clearing DB during logout', e);
      toast.dismiss('logout-sync');
    }
    localStorage.clear();
    sessionStorage.clear();
    toast.success('Signed out successfully');
    navigate('/staff/login');
  };


  return (
    <aside className="hidden md:flex flex-col w-72 bg-card/50 backdrop-blur-xl border-r border-border/50 h-screen sticky top-0 z-40">
      {/* Navigation - Scrollable */}
      <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-2 custom-scrollbar">
        {filteredTabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.path}
            className={({ isActive }) => clsx(
              "flex items-center gap-4 px-6 h-12 rounded-2xl font-bold tracking-tight text-[14px] transition-all group shrink-0 relative btn-press",
              isActive 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                : "text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent"
            )}
          >
            {({ isActive }) => (
              <>
                <tab.icon className={clsx("w-6 h-6 transition-transform group-hover:scale-110")} strokeWidth={isActive ? 3 : 2} />
                <span className="truncate">{tab.label.charAt(0).toUpperCase() + tab.label.slice(1).toLowerCase()}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer - Fixed */}
      <div className="p-4 border-t border-surface-border shrink-0 flex items-center justify-between gap-2">
        <button 
          onClick={handleLogout}
          className="flex-1 flex items-center justify-center gap-3 h-12 rounded-2xl font-black tracking-widest text-[12px] text-red-500 hover:text-red-600 hover:bg-red-500/5 transition-all group border border-transparent hover:border-red-500/10 shrink-0"
        >
          <LogOut className="w-5 h-5 transition-transform group-hover:scale-110" strokeWidth={2.5} />
          Sign Out
        </button>
        <div className="shrink-0 scale-90 origin-right">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
