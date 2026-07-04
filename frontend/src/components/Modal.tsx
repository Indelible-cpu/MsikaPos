import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional subtitle shown under the title */
  subtitle?: string;
  /** Desktop max width. Defaults to max-w-lg */
  maxWidth?: string;
  /** Set true for danger/destructive dialogs — colours the header ring red */
  danger?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  subtitle,
  maxWidth = 'max-w-lg',
  danger = false,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  /* ── Keyboard: Escape to close ── */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  /* ── Prevent body scroll while open ── */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        /* ── Backdrop ── */
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-end md:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          {/* ── Panel ── */}
          <motion.div
            key="modal-panel"
            onClick={(e) => e.stopPropagation()}
            /* Mobile: slides up from bottom; Desktop: pops in from center */
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={clsx(
              'relative w-full flex flex-col',
              /* Mobile: full width, rounded top corners, max 92vh */
              'rounded-t-[2rem] md:rounded-[2rem]',
              /* Desktop: centered card with max width */
              'md:mx-auto',
              maxWidth,
              /* Height: on mobile fill up to 92vh; desktop up to 88vh */
              'max-h-[92svh] md:max-h-[88vh]',
              /* Colors */
              'bg-surface-card border border-surface-border/60',
              'shadow-[0_-8px_60px_rgba(0,0,0,0.25)] md:shadow-[0_24px_80px_rgba(0,0,0,0.35)]',
            )}
          >
            {/* ── Drag handle (mobile only) ── */}
            <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-surface-text/20" />
            </div>

            {/* ── Header ── */}
            <div className={clsx(
              'flex items-start justify-between px-6 pt-4 pb-5 shrink-0',
              'border-b border-surface-border/50',
              danger && 'border-b-destructive/30'
            )}>
              <div className="flex-1 pr-4">
                <h2 className={clsx(
                  'text-lg font-black tracking-tight leading-tight',
                  danger ? 'text-destructive' : 'text-surface-text'
                )}>
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs font-medium text-surface-text/45 mt-0.5 leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-surface-text/8 hover:bg-destructive/10 hover:text-destructive text-surface-text/50 transition-all active:scale-90"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Scrollable Content ── */}
            <div
              ref={contentRef}
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
