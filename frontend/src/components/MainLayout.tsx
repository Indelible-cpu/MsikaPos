import React, { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import MobileNav from './MobileNav';
import MobileHeader from './MobileHeader';
import Sidebar from './Sidebar';
import { clsx } from 'clsx';
import AiAssistant from './AiAssistant';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const hideNav = location.pathname.includes('/login');

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const handleTouchStart = (e: React.TouchEvent) => {
    if (mainRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].pageY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current > 0 && mainRef.current?.scrollTop === 0) {
      const currentY = e.touches[0].pageY;
      const diff = currentY - startY.current;
      if (diff > 0) {
        setPullDistance(Math.min(diff * 0.4, 80)); // Resistance
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60) {
      setIsRefreshing(true);
      setTimeout(() => window.location.reload(), 800);
    }
    setPullDistance(0);
    startY.current = 0;
  };

  const getAiContext = () => {
    if (isSuperAdmin) return { mode: 'DIAGNOSTIC' };
    if (location.pathname.includes('/dashboard')) return { mode: 'DASHBOARD' };
    if (location.pathname.includes('/inventory')) return { mode: 'INVENTORY' };
    return { mode: 'GENERAL' };
  };

  const aiType = isSuperAdmin ? 'SYSTEM_DIAGNOSTICS' : 
                 location.pathname.includes('/dashboard') ? 'DASHBOARD_INSIGHTS' : 
                 location.pathname.includes('/inventory') ? 'INVENTORY_STRATEGY' : 'GENERAL_SUPPORT';

  return (
    <div className="min-h-screen flex bg-surface-bg transition-colors duration-300 mesh-bg">
      {/* Desktop Sidebar */}
      {!hideNav && <Sidebar />}

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Pull to Refresh Indicator */}
        <motion.div 
          style={{ height: pullDistance }}
          className="flex items-center justify-center overflow-hidden bg-primary-500/5"
        >
          <RefreshCw className={clsx("w-5 h-5 text-primary-500", (pullDistance > 60 || isRefreshing) && "animate-spin")} />
        </motion.div>

        {/* Dynamic Global Header */}
        {!hideNav && <MobileHeader />}

        {/* Main Content Area */}
        <main 
          ref={mainRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={clsx(
            "flex-1 w-full overflow-y-auto overflow-x-hidden scroll-smooth",
            "pb-24 md:pb-6 pt-0",
            "px-0 max-w-full transition-transform duration-300 ease-out"
          )}
        >
          <div className="w-full mx-auto py-0 min-h-full">
            {children}
          </div>
        </main>

        {!hideNav && <MobileNav />}
      </div>
      {!hideNav && <AiAssistant type={aiType} context={getAiContext()} />}
    </div>
  );
};

export default MainLayout;
