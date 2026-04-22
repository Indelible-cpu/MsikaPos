import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import MobileNav from './MobileNav';
import MobileHeader from './MobileHeader';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface MainLayoutProps {
  children: React.ReactNode;
  isOnline: boolean;
  isSyncing?: boolean;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, isOnline, isSyncing = false }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Signed out successfully');
    navigate('/login');
  };

  const hideNav = location.pathname === '/login';

  return (
    <div className="min-h-screen flex flex-col bg-surface-bg transition-colors duration-300">
      {/* Dynamic Mobile Header */}
      {!hideNav && <MobileHeader isOnline={isOnline} isSyncing={isSyncing} />}

      {/* Main Content Area - Mobile Gutter 0 */}
      <main className={clsx(
        "flex-1 w-full mx-auto pb-20 md:pb-0 transition-all",
        "px-0 md:px-6 max-w-screen-2xl"
      )}>
        {children}
      </main>

      {/* Desktop Sign Out */}
      <div className="hidden md:flex fixed top-4 right-6 z-50 gap-3">
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 bg-surface-card border border-surface-border rounded-full shadow-lg text-xs font-bold hover:bg-accent-danger hover:text-white transition-all group"
        >
          <LogOut className="w-4 h-4 text-accent-danger group-hover:text-white transition-colors" />
          Sign out
        </button>
      </div>

      {!hideNav && <MobileNav />}
    </div>
  );
};

export default MainLayout;
