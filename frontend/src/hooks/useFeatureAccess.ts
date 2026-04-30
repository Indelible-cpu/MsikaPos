import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuthStore } from './useAuth';

export interface FeatureAccess {
  featureKey: string;
  accessLevel: 'HIDDEN' | 'READ_ONLY' | 'FULL';
}

export const useFeatureAccess = () => {
  const user = useAuthStore(state => state.user);
  const [access, setAccess] = useState<Record<string, 'HIDDEN' | 'READ_ONLY' | 'FULL'>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccess = async () => {
      if (!user) return;
      if (user.role === 'SUPER_ADMIN') {
        setLoading(false);
        return; // Super admins have full access everywhere
      }

      try {
        const res = await api.get('/feature-configs', {
          params: { branchId: user.branch_id, role: user.role }
        });
        const configMap = res.data.data.reduce((acc: any, curr: any) => {
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
  }, [user]);

  const canAccess = (featureKey: string) => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return access[featureKey] !== 'HIDDEN';
  };

  const isReadOnly = (featureKey: string) => {
    if (!user) return true;
    if (user.role === 'SUPER_ADMIN') return false;
    return access[featureKey] === 'READ_ONLY';
  };

  return { canAccess, isReadOnly, loading };
};
