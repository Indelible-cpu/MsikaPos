import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Settings, UserCheck, Building2, X, LayoutGrid } from 'lucide-react';
import { clsx } from 'clsx';

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const MoreSheet: React.FC<MoreSheetProps> = ({ isOpen, onClose }) => {
  const menuItems = [
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
    { id: 'team', label: 'Team', icon: UserCheck, path: '/users' },
    { id: 'branches', label: 'Branches', icon: Building2, path: '/branches' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.offset.y < -100) onClose();
            }}
            className="fixed bottom-0 left-0 right-0 glass-panel border-t border-border/50 rounded-t-[3rem] z-[101] overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.4)] pb-safe"
          >
            {/* Handle */}
            <div className="w-12 h-1.5 bg-border/50 rounded-full mx-auto mt-4 mb-2" />

            <div className="px-8 pt-2 pb-12">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <LayoutGrid className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-black tracking-tighter text-foreground uppercase">More Options</h2>
                </div>
                <button 
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-muted/10 flex items-center justify-center border border-border/50 btn-press"
                  title="Close"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {menuItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) => clsx(
                      "flex flex-col items-center justify-center p-6 rounded-[2rem] border transition-all gap-3 group btn-press",
                      isActive 
                        ? "bg-primary border-primary/80 text-primary-foreground shadow-xl shadow-primary/20" 
                        : "glass-card border-border/50 text-muted-foreground hover:border-primary/30 hover:text-primary"
                    )}
                  >
                    <item.icon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black tracking-widest">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MoreSheet;
