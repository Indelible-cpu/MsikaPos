import React, { useEffect } from 'react';
import { useAuthStore } from '../hooks/useAuth';
import api from '../api/client';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setUser = useAuthStore(state => state.setUser);
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get('/AuthController/check');
        if (res.data.success) {
          setUser(res.data.data.user);
        }
      } catch {
        setUser(null);
      }
    };
    checkAuth();
  }, [setUser]);


  return <>{children}</>;
};
