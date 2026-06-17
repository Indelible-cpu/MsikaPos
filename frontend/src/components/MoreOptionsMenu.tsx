import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Settings, 
  Package,
  Users,
  Wallet,
  Building2,
  LogOut,
  ChevronDown,
  BarChart3,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import ThemeToggle from './ThemeToggle';
import BrandName from './BrandName';

interface MoreOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const MoreOptionsMenu: React.FC<MoreOptionsMenuProps> = ({ isOpen, onClose }) => {
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const options = [
    { id: 'inventory', label: 'Inventory', icon: Package, path: '/staff/inventory', color: 'bg-emerald-500' },
    { id: 'debt', label: 'Credit Center', icon: Users, path: '/staff/debt', color: 'bg-orange-500' },
    { id: 'expenses', label: 'Expenses', icon: Wallet, path: '/staff/expenses', color: 'bg-rose-500' },
    { id: 'team', label: 'Staff', icon: Users, path: '/staff/users', color: 'bg-primary' },
    { id: 'branches', label: 'Branches', icon: Building2, path: '/staff/branches', color: 'bg-blue-500' },
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/staff/reports', color: 'bg-violet-500' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/staff/settings', color: 'bg-slate-500' },
    ...(isSuperAdmin ? [{ id: 'audit', label: 'Audit Logs', icon: History, path: '/staff/audit-logs', color: 'bg-amber-600' }] : []),
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    toast.success('Signed out');
    window.location.href = '/';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-surface-bg/80 backdrop-blur-xl z-[60]"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-surface-card border-t border-surface-border rounded-t-[3rem] z-[70] p-0 pb-12 max-h-[90vh] overflow-y-auto"
          >
            {/* Top padding to account for removed header */}
            <div className="pt-8 grid grid-cols-4 gap-y-10 gap-x-2 px-6">
              {options.map((opt) => (
                <NavLink
                  key={opt.id}
                  to={opt.path}
                  onClick={onClose}
                  className="flex flex-col items-center justify-center gap-3 active:scale-95 transition-all group"
                >
                  <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-active:scale-110", opt.color)}>
                    <opt.icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-center leading-tight">{opt.label}</span>
                </NavLink>
              ))}

            </div>

            <div className="mt-8 px-4 flex flex-row flex-nowrap justify-center items-stretch gap-2 max-w-sm mx-auto">
              <div className="flex-1 flex flex-col items-center justify-center gap-1 bg-surface-bg border border-surface-border rounded-3xl min-w-0">
                <span className="text-[8px] font-black text-surface-text/40 uppercase tracking-widest text-center">Appearance</span>
                <div className="scale-75 origin-top">
                  <ThemeToggle />
                </div>
              </div>

              <button
                onClick={onClose}
                className="flex-1 flex flex-col items-center justify-center gap-1 bg-surface-bg border border-surface-border rounded-3xl min-w-0 active:scale-95 transition-all group"
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-surface-bg border border-surface-border text-surface-text/40 shadow-sm transition-transform group-active:scale-110">
                  <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-1 transition-transform" />
                </div>
                <span className="text-[9px] font-black tracking-widest text-surface-text/40 text-center">Close</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex-1 flex flex-col items-center justify-center gap-1 bg-surface-bg border border-surface-border rounded-3xl min-w-0 active:scale-95 transition-all group"
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-rose-500 text-white shadow-lg transition-transform group-active:scale-110">
                  <LogOut className="w-3.5 h-3.5" />
                </div>
                <span className="text-[9px] font-black tracking-widest text-rose-500 text-center">Sign Out</span>
              </button>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MoreOptionsMenu;
