import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = 'max-w-lg' 
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/60 backdrop-blur-md"
        >
          <motion.div 
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            className={`bg-surface-card md:border md:border-surface-border md:rounded-3xl w-full ${maxWidth} h-full md:h-auto md:max-h-[90vh] shadow-2xl overflow-hidden flex flex-col`}
          >
            <div className="p-6 border-b border-surface-border flex justify-between items-center bg-surface-bg/30">
              <h2 className="text-xl font-black tracking-tighter">{title}</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {children}
            </div>

            <div className="border-t border-surface-border bg-surface-bg/10">
              <button 
                onClick={onClose}
                className="w-full h-14 bg-surface-bg text-[10px] font-black tracking-widest hover:bg-surface-border/50 transition-all active:scale-[0.98]"
              >
                Close Window
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
