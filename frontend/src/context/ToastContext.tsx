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
            className={`pointer-events-auto flex items-center gap-4 px-5 py-3 rounded-xl shadow-2xl border animate-fade-in min-w-[280px] ${
              toast.type === 'success' ? 'bg-[#111] text-white border-white/5' : 
              toast.type === 'error' ? 'bg-[#111] text-rose-500 border-rose-500/20' : 
              'bg-[#111] text-white border-white/5'
            }`}
          >
            <p className="font-normal text-[11px] tracking-wide flex-1">{toast.message}</p>
            <button title="Dismiss" onClick={() => removeToast(toast.id)} className="p-1 hover:bg-white/5 rounded-lg transition-colors shrink-0">
               <X className="w-3 h-3 text-zinc-500" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
