import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { ToastContext, type Toast, type ToastType } from './ToastState';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, toast: showToast }}>
      {children}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-4 px-8 py-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-2 animate-fade-in min-w-[320px] ${
              toast.type === 'success' ? 'bg-zinc-900 text-white border-emerald-500/30' : 
              toast.type === 'error' ? 'bg-zinc-900 text-white border-rose-500/30' : 
              'bg-zinc-900 text-white border-zinc-700'
            }`}
          >
            <p className="font-medium text-[13px] tracking-wide flex-1">{toast.message}</p>
            <button title="Dismiss" onClick={() => removeToast(toast.id)} className="p-2 hover:bg-white/10 rounded-xl transition-colors shrink-0">
               <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
