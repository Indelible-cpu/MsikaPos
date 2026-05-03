import React from 'react';
import { Lock, Clock, Key } from 'lucide-react';
import { motion } from 'framer-motion';

interface LockedPageProps {
  isSuperAdmin?: boolean;
  onUnlock?: () => void;
}

const LockedPage: React.FC<LockedPageProps> = ({ isSuperAdmin, onUnlock }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground relative">
      <div className="fixed inset-0 bg-gradient-to-tr from-destructive/5 via-transparent to-transparent pointer-events-none" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full glass-panel p-10 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-accent-danger/50"></div>
        
        <div className="inline-flex p-5 rounded-3xl bg-accent-danger/10 text-accent-danger mb-8">
          <Lock className="w-12 h-12" />
        </div>
        
        <h1 className="text-2xl font-black tracking-tight mb-4">System locked</h1>
        <p className="text-surface-text/40 text-xs font-bold leading-relaxed mb-8">
          Access to MsikaPos is currently restricted by the Super Administrator or due to non-working hours.
        </p>
        
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-3 py-4 px-6 glass-card border border-border/50 rounded-2xl text-[10px] font-black text-muted-foreground w-full">
            <Clock className="w-4 h-4" />
            Operating hours enforcement active
          </div>
          
          {isSuperAdmin && onUnlock && (
            <button 
              onClick={onUnlock}
              className="flex items-center justify-center gap-2 w-full py-4 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/20 rounded-2xl font-black tracking-widest text-[10px] transition-all btn-press uppercase"
            >
              <Key className="w-5 h-5" />
              Unlock system temporarily (30m)
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LockedPage;
