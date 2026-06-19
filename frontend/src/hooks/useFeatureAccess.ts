import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuthStore } from './useAuth';

export interface FeatureAccess {
  featureKey: string;
  accessLevel: 'HIDDEN' | 'READ_ONLY' | 'FULL';
}

export const useFeatureAccess = () => {
  const user = useAuthStore(state => state.user);
  // Pre-seed from localStorage so there's no null flash on first render
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
  const resolvedUser = user ?? storedUser;

  const [access, setAccess] = useState<Record<string, 'HIDDEN' | 'READ_ONLY' | 'FULL'>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccess = async () => {
      if (!resolvedUser) {
        setLoading(false);
        return;
      }
      if (resolvedUser.role === 'SUPER_ADMIN') {
        setLoading(false);
        return; // Super admins have full access everywhere
      }

      try {
        const res = await api.get('/feature-configs', {
          params: { role: resolvedUser.role }
        });
        const configMap = res.data.data.reduce((acc: Record<string, string>, curr: { featureKey: string; accessLevel: string }) => {
          acc[curr.featureKey] = curr.accessLevel;
          return acc;
        }, {});
        setAccess(configMap);
      } catch (err) {
        console.error('Failed to fetch feature access', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAccess();
  }, [resolvedUser?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  const getDefaultAccess = (role: string, featureKey: string) => {
    if (role === 'ADMIN') return 'FULL';
    if (role === 'CASHIER') {
      if (featureKey === 'POS_TERMINAL') return 'FULL';
      if (featureKey === 'SALES_HISTORY') return 'READ_ONLY';
      return 'HIDDEN';
    }
    return 'HIDDEN';
  };

  const canAccess = (featureKey: string) => {
    if (!resolvedUser) return false;
    if (resolvedUser.role === 'SUPER_ADMIN') return true;
    // While loading, default to showing (permissive) — hide only explicit HIDDEN after load
    if (loading) return true;
    const current = access[featureKey] || getDefaultAccess(resolvedUser.role, featureKey);
    return current !== 'HIDDEN';
  };

  const isReadOnly = (featureKey: string) => {
    if (!resolvedUser) return true;
    if (resolvedUser.role === 'SUPER_ADMIN') return false;
    const current = access[featureKey] || getDefaultAccess(resolvedUser.role, featureKey);
    return current === 'READ_ONLY';
  };

  return { canAccess, isReadOnly, loading };
};
