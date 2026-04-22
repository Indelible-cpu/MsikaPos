import React from 'react';
import { Lock, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const LockedPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-bg text-surface-text">
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
          Access to Vendrax POS is currently restricted by the Super Administrator or due to non-working hours.
        </p>
        
        <div className="flex items-center justify-center gap-3 py-4 px-6 bg-surface-card border border-surface-border rounded-2xl text-[10px] font-bold text-surface-text/30">
          <Clock className="w-4 h-4" />
          Operating hours enforcement active
        </div>
      </motion.div>
    </div>
  );
};

export default LockedPage;
