import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { 
  ChevronRight,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

interface FeatureConfig {
  featureKey: string;
  roleName: string;
  accessLevel: 'FULL' | 'READ_ONLY' | 'HIDDEN';
}

const FEATURES = [
  { key: 'DASHBOARD', label: 'Dashboard stats', icon: 'Home' },
  { key: 'POS_TERMINAL', label: 'POS terminal', icon: 'ShoppingCart' },
  { key: 'SALES_HISTORY', label: 'Sales history', icon: 'Receipt' },
  { key: 'CUSTOMERS', label: 'Credit center', icon: 'Users' },
  { key: 'INVENTORY', label: 'Stock management', icon: 'Package' },
  { key: 'INQUIRIES', label: 'Inquiries & requests', icon: 'MessageSquare' },
  { key: 'FINANCE', label: 'Finance & expenses', icon: 'Wallet' },
  { key: 'STAFF', label: 'Staff management', icon: 'Users' },
  { key: 'BRANCHES', label: 'Branch management', icon: 'Building' },
  { key: 'REPORTS', label: 'System reports', icon: 'BarChart' },
  { key: 'SETTINGS', label: 'System settings', icon: 'Settings' },
  { key: 'AUDIT_LOGS', label: 'Security logs', icon: 'History' }
];

const ROLES = ['ADMIN', 'CASHIER'];

const FeatureAccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<FeatureConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedBranch] = useState<string>('all');

  const fetchConfigs = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedBranch !== 'all') params.branchId = selectedBranch;
      
      const res = await api.get('/feature-configs', { params });
      setConfigs(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err: unknown) {
      const error = err as any;
      const msg = error.response?.data?.message || error.message;
      toast.error('Failed to load permissions: ' + msg);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleUpdate = async (featureKey: string, roleName: string, accessLevel: string) => {
    setSaving(true);
    try {
      const payload: any = {
        featureKey,
        roleName,
        accessLevel
      };
      if (selectedBranch !== 'all') payload.branchId = selectedBranch;

      await api.post('/feature-configs', payload);
      toast.success('Permission updated');
      fetchConfigs();
    } catch (err: unknown) {
      const error = err as any;
      const msg = error.response?.data?.message || error.message;
      toast.error('Failed to update permission: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const getAccess = (featureKey: string, roleName: string) => {
    const config = configs.find(c => c.featureKey === featureKey && c.roleName === roleName);
    return config?.accessLevel || 'FULL';
  };

  return (
    <div className="flex flex-col min-h-screen bg-background transition-all pb-24 md:pb-0 relative">
      <div className="fixed inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="glass-panel border-b border-border/50 px-6 md:px-12 py-6 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tighter">Feature access control</h1>
        </div>
      </div>

      <main className="p-6 md:p-12 max-w-6xl mx-auto w-full">
        <div className="glass-panel rounded-[2.5rem] border border-border/50 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/50 bg-muted/10">
                  <th className="p-8 text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase">Feature module</th>
                  {ROLES.map(role => (
                    <th key={role} className="p-8 text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase text-center">{role}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {FEATURES.map(feature => (
                  <tr key={feature.key} className="group hover:bg-primary/5 transition-all">
                    <td className="p-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-surface-bg border border-surface-border rounded-2xl flex items-center justify-center text-surface-text/40 group-hover:text-primary-500 group-hover:border-primary-500/20 transition-all">
                           <ChevronRight className="w-5 h-5 opacity-20" />
                        </div>
                        <div>
                          <p className="text-sm font-black tracking-tight">{feature.label}</p>
                          <p className="text-[9px] font-bold text-surface-text/30 uppercase tracking-widest">{feature.key}</p>
                        </div>
                      </div>
                    </td>
                    {ROLES.map(role => (
                      <td key={role} className="p-8">
                        <div className="flex justify-center">
                          <select 
                            title={`Access level for ${role}`}
                            className={`
                              appearance-none px-6 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-all cursor-pointer
                              ${getAccess(feature.key, role) === 'HIDDEN' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                getAccess(feature.key, role) === 'READ_ONLY' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}
                            `}
                            value={getAccess(feature.key, role)}
                            onChange={(e) => handleUpdate(feature.key, role, e.target.value)}
                            disabled={saving}
                          >
                            <option value="FULL">Full access</option>
                            <option value="READ_ONLY">Read only</option>
                            <option value="HIDDEN">Hidden</option>
                          </select>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 flex items-start gap-4 p-6 bg-primary/5 rounded-3xl border border-primary/10 max-w-2xl glass-card">
          <Info className="w-5 h-5 text-primary mt-1 shrink-0" />
          <div className="space-y-2">
            <p className="text-xs font-black text-muted-foreground leading-relaxed tracking-wide">
              Permissions are applied instantly. If a feature is set to <strong className="text-destructive uppercase">Hidden</strong>, it will be removed from the sidebar and navigation for that role. <strong className="text-amber-500 uppercase">Read only</strong> will disable all save/edit/delete actions within that module.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button onClick={() => navigate('/staff/settings')} className="px-8 py-4 glass-card border border-border/50 rounded-2xl text-[10px] font-black tracking-widest text-muted-foreground hover:text-primary transition-all uppercase shadow-sm flex items-center gap-2 btn-press">
            Close access control
          </button>
        </div>
      </main>
    </div>
  );
};

export default FeatureAccessPage;
