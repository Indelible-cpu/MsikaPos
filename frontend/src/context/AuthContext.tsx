import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../hooks/useAuth';
import api from '../api/client';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setUser = useAuthStore(state => state.setUser);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get('/AuthController/check');
        if (res.data.success) {
          setUser(res.data.data.user);
        }
      } catch {
        setUser(null);
      } finally {
        setIsChecking(false);
      }
    };
    checkAuth();
  }, [setUser]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-bold animate-pulse">Initializing Vendrax...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
