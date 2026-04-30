import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface Branch {
  id: number;
  name: string;
}

const BranchSwitcher: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(
    localStorage.getItem('activeBranchId') ? parseInt(localStorage.getItem('activeBranchId')!) : null
  );

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get('/branches?minimal=1');
        if (res.data.success) {
          setBranches(res.data.data);
        }
      } catch (e) {
        console.error('Failed to fetch branches:', e);
      }
    };
    fetchBranches();
  }, []);

  const handleSwitch = (id: number | null) => {
    if (id === null) {
      localStorage.removeItem('activeBranchId');
    } else {
      localStorage.setItem('activeBranchId', id.toString());
    }
    setActiveBranchId(id);
    setIsOpen(false);
    // Reload to apply new branch context across all components
    window.location.reload();
  };

  const activeBranch = branches.find(b => b.id === activeBranchId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-surface-bg border border-surface-border rounded-2xl hover:border-primary-500/50 transition-all group"
      >
        <div className="p-1.5 bg-primary-500/10 text-primary-500 rounded-lg">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-[10px] font-black text-surface-text/40 tracking-widest uppercase">Context</span>
          <span className="text-xs font-black truncate max-w-[120px]">
            {activeBranch ? activeBranch.name : 'All branches'}
          </span>
        </div>
        <ChevronDown className={clsx("w-4 h-4 text-surface-text/20 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full left-0 mt-2 w-64 bg-surface-card border border-surface-border rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-2">
                <button
                  onClick={() => handleSwitch(null)}
                  className={clsx(
                    "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all",
                    activeBranchId === null ? "bg-primary-500 text-white" : "hover:bg-surface-bg text-surface-text/60"
                  )}
                >
                  <span>Global overview</span>
                  {activeBranchId === null && <Check className="w-4 h-4" />}
                </button>
                
                <div className="h-px bg-surface-border my-2" />
                
                <div className="max-h-64 overflow-y-auto no-scrollbar">
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => handleSwitch(branch.id)}
                      className={clsx(
                        "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all mb-1",
                        activeBranchId === branch.id ? "bg-primary-500 text-white" : "hover:bg-surface-bg text-surface-text/60"
                      )}
                    >
                      <span className="truncate">{branch.name}</span>
                      {activeBranchId === branch.id && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BranchSwitcher;
