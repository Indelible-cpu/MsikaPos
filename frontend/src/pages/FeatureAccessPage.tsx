import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { 
  Shield, 
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
  { key: 'DASHBOARD', label: 'Dashboard Stats', icon: 'Home' },
  { key: 'POS_TERMINAL', label: 'POS Terminal', icon: 'ShoppingCart' },
  { key: 'SALES_HISTORY', label: 'Sales History', icon: 'Receipt' },
  { key: 'CUSTOMERS', label: 'Customers & Debt', icon: 'Users' },
  { key: 'INVENTORY', label: 'Stock Management', icon: 'Package' },
  { key: 'INQUIRIES', label: 'Inquiries & Requests', icon: 'MessageSquare' },
  { key: 'FINANCE', label: 'Finance & Expenses', icon: 'Wallet' },
  { key: 'STAFF', label: 'Staff Management', icon: 'Users' },
  { key: 'BRANCHES', label: 'Branch Management', icon: 'Building' },
  { key: 'REPORTS', label: 'System Reports', icon: 'BarChart' },
  { key: 'SETTINGS', label: 'System Settings', icon: 'Settings' },
  { key: 'AUDIT_LOGS', label: 'Security Logs', icon: 'History' }
];

const ROLES = ['ADMIN', 'CASHIER'];

const FeatureAccessPage: React.FC = () => {
  const [configs, setConfigs] = useState<FeatureConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<{id: number, name: string}[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get('/branches');
        setBranches(res.data.data);
      } catch (err: unknown) {
        const error = err as Error;
        console.error('Failed to fetch branches', error.message);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/feature-configs', {
          params: { branchId: selectedBranch === 'all' ? null : selectedBranch }
        });
        setConfigs(res.data.data);
      } catch (err: unknown) {
        const error = err as Error;
        toast.error('Failed to load permissions: ' + error.message);
      }
    };
    load();
  }, [selectedBranch]);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await api.get('/feature-configs', {
        params: { branchId: selectedBranch === 'all' ? null : selectedBranch }
      });
      setConfigs(res.data.data);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error('Failed to load permissions: ' + error.message);
    }
  }, [selectedBranch]);

  const handleUpdate = async (featureKey: string, roleName: string, accessLevel: string) => {
    setSaving(true);
    try {
      await api.post('/feature-configs', {
        featureKey,
        roleName,
        accessLevel,
        branchId: selectedBranch === 'all' ? null : selectedBranch
      });
      toast.success('Permission updated');
      fetchConfigs();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error('Failed to update permission: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getAccess = (featureKey: string, roleName: string) => {
    const config = configs.find(c => c.featureKey === featureKey && c.roleName === roleName);
    return config?.accessLevel || 'FULL';
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <header className="bg-surface-card border-b border-surface-border px-6 md:px-12 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6 sticky top-0 z-30">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-500 border border-primary-500/20">
                <Shield className="w-5 h-5" />
             </div>
             <h1 className="text-2xl font-black tracking-tighter uppercase">Access Control</h1>
          </div>
          <p className="text-[10px] font-black text-surface-text/30 tracking-[0.2em] uppercase">Configure module visibility and permissions</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <div className="text-[10px] font-black text-surface-text/30 uppercase tracking-widest">Selected Context</div>
            <div className="text-xs font-black text-primary-500 uppercase">
              {selectedBranch === 'all' ? 'Global Configuration' : branches.find(b => b.id.toString() === selectedBranch)?.name}
            </div>
          </div>
          <select 
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            title="Switch Branch Context"
            aria-label="Switch Branch Context"
            className="px-6 py-3 bg-surface-card border border-surface-border rounded-xl text-[10px] font-black tracking-widest uppercase text-primary-500 outline-none cursor-pointer hover:border-primary-500/20 transition-all shadow-sm"
          >
            <option value="all">GLOBAL (ALL BRANCHES)</option>
            {branches.map(b => (
              <option key={b.id} value={b.id.toString()}>{b.name.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="p-6 md:p-12 max-w-6xl mx-auto w-full">
        <div className="bg-surface-card rounded-[2.5rem] border border-surface-border shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-surface-border bg-surface-bg/50">
                  <th className="p-8 text-[10px] font-black tracking-[0.2em] text-surface-text/30 uppercase">Feature Module</th>
                  {ROLES.map(role => (
                    <th key={role} className="p-8 text-[10px] font-black tracking-[0.2em] text-surface-text/30 uppercase text-center">{role}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50">
                {FEATURES.map(feature => (
                  <tr key={feature.key} className="group hover:bg-primary-500/5 transition-colors">
                    <td className="p-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-surface-bg border border-surface-border rounded-2xl flex items-center justify-center text-surface-text/40 group-hover:text-primary-500 group-hover:border-primary-500/20 transition-all">
                           {/* Dynamic Icons would be here, using labels for now */}
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
                            <option value="FULL">Full Access</option>
                            <option value="READ_ONLY">Read Only</option>
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

        <div className="mt-8 flex items-start gap-4 p-6 bg-primary-500/5 rounded-3xl border border-primary-500/10 max-w-2xl">
          <Info className="w-5 h-5 text-primary-500 mt-1" />
          <div className="space-y-2">
            <p className="text-xs font-bold text-surface-text/60 leading-relaxed">
              Permissions are applied instantly. If a feature is set to <strong className="text-red-500">HIDDEN</strong>, it will be removed from the sidebar and navigation for that role. <strong className="text-amber-500">READ ONLY</strong> will disable all save/edit/delete actions within that module.
            </p>
            <p className="text-[9px] font-black text-primary-500/50 uppercase tracking-widest">Global settings apply unless a branch-specific override exists.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FeatureAccessPage;
