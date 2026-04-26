import React, { useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import MobileNav from './MobileNav';
import MobileHeader from './MobileHeader';
import Sidebar from './Sidebar';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { SyncService } from '../services/SyncService';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

  const handleSync = async () => {
    try {
      await SyncService.pushSales();
      return true;
    } catch (err) {
      console.error('Refresh sync failed:', err);
      throw err;
    }
  };

  const hideNav = location.pathname === '/login';

  const PULL_THRESHOLD = 80;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (mainRef.current && mainRef.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.4, 120));
    }
  }, [isPulling, isRefreshing]);

  const onTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(50);
      
      toast.loading('Syncing data in background...', { id: 'refreshing' });
      
      // Perform background sync
      handleSync().then(() => {
        setIsRefreshing(false);
        setPullDistance(0);
        toast.success('System up to date', { id: 'refreshing' });
      }).catch(() => {
        setIsRefreshing(false);
        setPullDistance(0);
        toast.error('Sync failed. Check connection.', { id: 'refreshing' });
      });
    } else {
      setPullDistance(0);
    }
    setIsPulling(false);
  }, [pullDistance, isRefreshing]);

  return (
    <div className="min-h-screen flex bg-surface-bg transition-colors duration-300 mesh-bg">
      {/* Desktop Sidebar */}
      {!hideNav && <Sidebar />}

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Dynamic Mobile Header */}
        {!hideNav && (
          <div className="md:hidden">
            <MobileHeader />
          </div>
        )}

        {/* Pull to Refresh Indicator */}
        {pullDistance > 0 && (
          <div 
            className={clsx(
              "fixed left-1/2 -translate-x-1/2 z-[60] flex items-center justify-center transition-all top-28"
            )}
          >
            <div className={clsx(
              "w-10 h-10 bg-surface-card border border-surface-border rounded-full flex items-center justify-center shadow-lg transition-all",
              isRefreshing && "animate-spin",
              pullDistance >= PULL_THRESHOLD && "border-primary-500 bg-primary-500/10"
            )}>
              <RefreshCw className={clsx("w-5 h-5", pullDistance >= PULL_THRESHOLD ? "text-primary-500" : "text-surface-text/40")} />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main 
          ref={mainRef}
          onTouchStart={!hideNav ? onTouchStart : undefined}
          onTouchMove={!hideNav ? onTouchMove : undefined}
          onTouchEnd={!hideNav ? onTouchEnd : undefined}
          className={clsx(
            "flex-1 w-full overflow-y-auto overflow-x-hidden",
            "pb-24 md:pb-0 pt-[calc(64px+env(safe-area-inset-top))] md:pt-0",
            "px-0 md:px-[0.1rem] max-w-full",
            isPulling ? "transition-none" : "transition-transform duration-300 ease-out"
          )}
        >
          <div className="w-full mx-auto mt-[0.1rem] py-0 h-full">
            {children}
          </div>
        </main>

        {!hideNav && <MobileNav />}
      </div>
    </div>
  );
};

export default MainLayout;
