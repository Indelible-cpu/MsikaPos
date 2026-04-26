import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  BarChart3, 
  Receipt, 
  Settings, 
  ShoppingCart, 
  MoreHorizontal,
  Package,
  Users,
  Wallet,
  Building2,
  Info,
  LogOut,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface MoreOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const MoreOptionsMenu: React.FC<MoreOptionsMenuProps> = ({ isOpen, onClose }) => {
  
  const options = [
    { id: 'debt', label: 'Debt', icon: Users, path: '/debt', color: 'bg-orange-500' },
    { id: 'expenses', label: 'Expenses', icon: Wallet, path: '/expenses', color: 'bg-rose-500' },
    { id: 'team', label: 'Staff', icon: Users, path: '/users', color: 'bg-primary-500' },
    { id: 'branches', label: 'Branches', icon: Building2, path: '/branches', color: 'bg-blue-500' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', color: 'bg-slate-500' },
    { id: 'about', label: 'Support', icon: Info, path: '/about', color: 'bg-indigo-500' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Signed out');
    window.location.href = '/login';
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
            className="fixed bottom-0 left-0 right-0 bg-surface-card border-t border-surface-border rounded-t-[3rem] z-[70] p-8 pb-12 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black tracking-tighter italic">More Options</h2>
                <p className="text-[10px] font-black tracking-widest text-surface-text/30 uppercase mt-1">Management & Support</p>
              </div>
              <button 
                onClick={onClose}
                className="w-12 h-12 bg-surface-bg border border-surface-border rounded-full flex items-center justify-center active:scale-90 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {options.map((opt) => (
                <NavLink
                  key={opt.id}
                  to={opt.path}
                  onClick={onClose}
                  className="flex flex-col items-center justify-center gap-3 p-6 bg-surface-bg border border-surface-border rounded-[2rem] active:scale-95 transition-all group"
                >
                  <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-active:scale-110", opt.color)}>
                    <opt.icon className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-black tracking-widest uppercase italic">{opt.label}</span>
                </NavLink>
              ))}

              <button
                onClick={handleLogout}
                className="col-span-2 flex items-center justify-center gap-4 p-6 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] text-rose-500 active:scale-95 transition-all mt-4"
              >
                <LogOut className="w-6 h-6" />
                <span className="text-sm font-black tracking-widest uppercase italic">Sign Out</span>
              </button>
            </div>

            <div className="mt-8 text-center">
              <p className="text-[10px] font-black text-surface-text/20 tracking-[0.3em] uppercase">MsikaPos v2.4.0</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MoreOptionsMenu;
