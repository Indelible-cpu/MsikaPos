import React, { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import MobileNav from './MobileNav';
import MobileHeader from './MobileHeader';
import Sidebar from './Sidebar';
import AppFooter from './AppFooter';
import { clsx } from 'clsx';
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

  return (
    <div className="min-h-screen flex bg-background transition-colors duration-300 relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />
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

        {/* Main Content Area — flex-1 so footer stays at bottom on desktop */}
        <main 
          ref={mainRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={clsx(
            "flex-1 flex flex-col w-full overflow-y-auto overflow-x-hidden scroll-smooth transition-transform duration-300 ease-out px-0 max-w-full"
          )}
        >
          {/* Page content grows to fill available space */}
          <div className="flex-1">
            {children}
          </div>
          {/* Mobile Footer — sits after page content, padded above mobile nav bar */}
          <div className="md:hidden">
            <AppFooter />
            <div className="h-20" /> {/* spacer above mobile nav */}
          </div>
        </main>

        {/* Desktop Footer — always pinned at bottom of the right column, never overlaps content */}
        <div className="hidden md:block shrink-0">
          <AppFooter />
        </div>

        {!hideNav && <MobileNav />}
      </div>
    </div>
  );
};

export default MainLayout;
