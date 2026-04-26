import React, { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import MobileNav from './MobileNav';
import MobileHeader from './MobileHeader';
import Sidebar from './Sidebar';
import { clsx } from 'clsx';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const hideNav = location.pathname.includes('/login');

  return (
    <div className="min-h-screen flex bg-surface-bg transition-colors duration-300 mesh-bg">
      {/* Desktop Sidebar */}
      {!hideNav && <Sidebar />}

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Dynamic Global Header */}
        {!hideNav && <MobileHeader />}

        {/* Main Content Area */}
        <main 
          ref={mainRef}
          className={clsx(
            "flex-1 w-full overflow-y-auto overflow-x-hidden scroll-smooth",
            "pb-24 md:pb-0 pt-0",
            "px-0 max-w-full transition-transform duration-300 ease-out"
          )}
        >
          <div className="w-full mx-auto py-0 min-h-full">
            {children}
          </div>
        </main>

        {!hideNav && <MobileNav />}
      </div>
    </div>
  );
};

export default MainLayout;
