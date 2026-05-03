import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';


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
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-zinc-900/60 backdrop-blur-md"
        >
          <motion.div 
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            className={`glass-panel border border-border/60 rounded-3xl w-full ${maxWidth} max-h-[90vh] shadow-2xl overflow-hidden flex flex-col`}
          >
            <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/10">
              <h2 className="text-xl font-black tracking-tighter text-foreground uppercase">{title}</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {children}
            </div>

            <div className="border-t border-border/50 bg-muted/5">
              <button 
                onClick={onClose}
                className="w-full h-14 bg-transparent text-[10px] font-black tracking-widest text-muted-foreground hover:bg-muted/20 transition-all btn-press uppercase"
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
