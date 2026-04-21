import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import POSPage from './pages/POSPage';
import LoginPage from './pages/LoginPage';
import { SyncService } from './services/SyncService';

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    // Initial Sync Attempt if online
    if (navigator.onLine) {
      SyncService.pushSales();
    }

    // Auto-sync every 60 seconds if online
    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        SyncService.pushSales();
      }
    }, 60000);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      clearInterval(syncInterval);
    };
  }, []);

  return (
    <Router>
      <div className="min-h-screen selection:bg-primary-500/30">
        <Toaster position="top-right" />

        
        {/* Connectivity Banner */}
        {!isOnline && (
          <div className="bg-accent-vibrant text-black text-center text-xs py-1 font-bold animate-pulse">
            OFFLINE MODE ACTIVE - Data is being saved locally
          </div>
        )}

        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/pos" 
            element={localStorage.getItem('token') ? <POSPage /> : <Navigate to="/login" replace />} 
          />
          <Route path="/" element={<Navigate to="/pos" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
