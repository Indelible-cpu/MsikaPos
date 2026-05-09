import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';


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
  const [isInputFocused, setIsInputFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen && isInputFocused) {
      setIsInputFocused(false);
    }
  }, [isOpen, isInputFocused]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        setIsInputFocused(true);
      }
    };

    const handleBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        // Short delay to see if next focus is also an input
        setTimeout(() => {
          if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) {
            setIsInputFocused(false);
          }
        }, 100);
      }
    };

    window.addEventListener('focusin', handleFocus);
    window.addEventListener('focusout', handleBlur);
    return () => {
      window.removeEventListener('focusin', handleFocus);
      window.removeEventListener('focusout', handleBlur);
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={clsx(
            "fixed inset-0 z-[100] flex p-4 md:p-6 bg-zinc-900/60 backdrop-blur-md transition-all duration-500",
            isInputFocused ? "items-start pt-2" : "items-center justify-center"
          )}
          onClick={onClose}
        >
          <motion.div 
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ 
              y: isInputFocused ? 0 : 0, 
              opacity: 1, 
              scale: 1,
            }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            className={clsx(
              "glass-panel border border-border/60 rounded-3xl w-full shadow-2xl overflow-hidden flex flex-col transition-all duration-500",
              maxWidth,
              isInputFocused ? "max-h-[50vh] md:max-h-[90vh]" : "max-h-[90vh]"
            )}
          >
            <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/10">
              <h2 className="text-xl font-black tracking-tighter text-foreground uppercase">{title}</h2>
            </div>
            
            <div className={clsx(
              "flex-1 overflow-y-auto custom-scrollbar transition-all duration-500",
              isInputFocused && "pb-32"
            )}>
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
