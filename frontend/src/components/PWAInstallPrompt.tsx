import React from 'react';
import { ShoppingBag, X } from 'lucide-react';

interface PWAInstallPromptProps {
  deferredPrompt: any;
  onInstall: () => void;
  onDismiss: () => void;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ deferredPrompt, onInstall, onDismiss }) => {
  if (!deferredPrompt) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md bg-surface-card border-2 border-primary-500 p-4 rounded-[2rem] shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-10">
      <div className="flex items-center gap-3">
        <button 
          onClick={onDismiss}
          className="w-8 h-8 flex items-center justify-center text-surface-text/20 hover:text-rose-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="w-10 h-10 bg-primary-500 text-white rounded-2xl flex items-center justify-center">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-black">Install MsikaPos App</p>
          <p className="text-[9px] font-bold text-surface-text/40 ">Access system faster from home screen</p>
        </div>
      </div>
      <button 
        onClick={onInstall}
        className="px-6 py-2.5 bg-primary-500 text-white rounded-xl text-[10px] font-black tracking-widest shadow-lg shadow-primary-500/20"
      >
        INSTALL
      </button>
    </div>
  );
};

export default PWAInstallPrompt;
