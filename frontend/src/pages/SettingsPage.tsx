import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Store, Smartphone, Building2, Info, ChevronRight, ShieldAlert, History, TrendingUp, Plus, Wallet } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import toast from 'react-hot-toast';
import { db } from '../db/posDB';
import { AuditService } from '../services/AuditService';
import api from '../api/client';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const [lockTime, setLockTime] = React.useState('20:00');
  const [unlockTime, setUnlockTime] = React.useState('06:00');
  const [taxRate, setTaxRate] = React.useState(0);
  const [taxInclusive, setTaxInclusive] = React.useState(true);
  const [companyName, setCompanyName] = React.useState('');
  const [momoProvider, setMomoProvider] = React.useState('TNM Mpamba, Airtel Money');
  const [bankNameSetting, setBankNameSetting] = React.useState('National Bank, NBS Bank, Standard Bank');
  const [branchWhatsApp, setBranchWhatsApp] = React.useState('');

  React.useEffect(() => {
    const loadSettings = async () => {
      const hours = await db.settings.get('lockout_hours');
      if (hours?.value) {
        const value = hours.value as { start: string; end: string };
        setLockTime(value.start);
        setUnlockTime(value.end);
      }
      const tax = await db.settings.get('tax_config');
      if (tax?.value) {
        const value = tax.value as { rate: number; inclusive: boolean };
        setTaxRate(value.rate);
        setTaxInclusive(value.inclusive);
      }
      const company = await db.settings.get('company_config');
      if (company?.value) {
        setCompanyName((company.value as { name: string }).name);
      }
      const payment = await db.settings.get('payment_config');
      if (payment?.value) {
        const val = payment.value as { momo: string; bank: string };
        setMomoProvider(val.momo || 'TNM Mpamba, Airtel Money');
        setBankNameSetting(val.bank || 'National Bank, NBS Bank, Standard Bank');
      }
      
      const currentBranchStr = localStorage.getItem('currentBranch');
      if (currentBranchStr) {
        const branch = JSON.parse(currentBranchStr);
        setBranchWhatsApp(branch.whatsapp || '');
      }
    };
    loadSettings();
  }, []);

  const saveCompanyConfig = async () => {
    try {
      await db.settings.put({ key: 'company_config', value: { name: companyName } });
      localStorage.setItem('companyName', companyName);
      
      const token = localStorage.getItem('token');
      if (token) {
        await api.post('/settings', { companyName }, {
          headers: { Authorization: `Bearer \${token}` }
        });
      }

      toast.success('Company information updated');
      window.dispatchEvent(new Event('storage'));
    } catch {
      toast.error('Failed to save company info');
    }
  };

  const savePaymentConfig = async () => {
    try {
      await db.settings.put({ key: 'payment_config', value: { momo: momoProvider, bank: bankNameSetting } });
      toast.success('Payment methods updated');
    } catch {
      toast.error('Failed to save payment config');
    }
  };

  const saveBranchDetails = async () => {
    try {
      const currentBranchStr = localStorage.getItem('currentBranch');
      if (currentBranchStr) {
        const branch = JSON.parse(currentBranchStr);
        const updatedBranch = { ...branch, whatsapp: branchWhatsApp };
        await db.branches.put(updatedBranch);
        localStorage.setItem('currentBranch', JSON.stringify(updatedBranch));
        toast.success('Branch details updated');
      }
    } catch {
      toast.error('Failed to save branch details');
    }
  };

  const saveHours = async () => {
    try {
      await db.settings.put({ key: 'lockout_hours', value: { start: lockTime, end: unlockTime } });
      toast.success('Auto-lock hours updated');
    } catch {
      toast.error('Failed to save auto-lock hours');
    }
  };

  const saveTaxConfig = async () => {
    try {
      await db.settings.put({ key: 'tax_config', value: { rate: taxRate, inclusive: taxInclusive } });
      toast.success('Tax configuration updated');
    } catch {
      toast.error('Failed to save tax configuration');
    }
  };

  const toggleSystemLock = async (isLocked: boolean) => {
    try {
      await db.settings.put({ key: 'system_lock', value: isLocked });
      await AuditService.log(isLocked ? 'SYSTEM_LOCKED' : 'SYSTEM_UNLOCKED', `System manually \${isLocked ? 'locked' : 'unlocked'} by \${user.username}`);
      toast.success(`System \${isLocked ? 'Locked' : 'Unlocked'}`);
      window.location.reload();
    } catch {
      toast.error('Failed to update system lock');
    }
  };

  return (
    <div className="flex flex-col w-full bg-surface-bg transition-all pb-32">
       <div className="p-4 md:p-10 space-y-6 md:space-y-10">
          <div className="p-10 border-b border-surface-border/50 flex flex-col md:flex-row items-center md:items-start gap-8 group transition-all duration-500">
             <div className="relative w-32 h-32 shrink-0">
                <div className="w-32 h-32 bg-primary-500/10 text-primary-500 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary-500/20 group-hover:border-primary-500 transition-all shadow-2xl p-1">
                   {user.profile_pic ? (
                     <img src={user.profile_pic} alt="Profile" className="w-full h-full object-cover rounded-full" />
                   ) : (
                     <User className="w-12 h-12" />
                   )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform border-4 border-surface-card" title="Change profile picture">
                   <Plus className="w-5 h-5" />
                   <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      title="Upload profile picture"
                      aria-label="Upload profile picture"
                      onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                                    const base64Logo = reader.result as string;
                                    localStorage.setItem('companyLogo', base64Logo);
                                    
                                    try {
                                      const token = localStorage.getItem('token');
                                      if (token) {
                                        await api.post('/settings', { logo: base64Logo }, {
                                          headers: { Authorization: `Bearer \${token}` }
                                        });
                                      }
                                      toast.success('Logo updated');
                                      window.dispatchEvent(new Event('storage'));
                                      window.location.reload();
                                    } catch {
                                      toast.error('Failed to save logo to database');
                                    }
                                 };
                                 reader.readAsDataURL(file);
                         }
                      }}
                   />
                </label>
             </div>
             <div className="text-center md:text-left flex-1">
                <h2 className="text-3xl font-black tracking-tighter italic">{user.fullname || user.username || 'Employee'}</h2>
                <div className="card-label !mt-1">Branch: {user.branch_name || 'Domasi Main'}</div>
                <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
                   <span className="px-4 py-1.5 bg-primary-500/10 text-primary-500 rounded-none text-[10px] font-black tracking-widest border border-primary-500/20">Role: {user.role || 'Staff'}</span>
                   <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-none text-[10px] font-black tracking-widest border border-emerald-500/20">Online Status</span>
                </div>
             </div>
          </div>

          <div className="space-y-px md:space-y-6">
            <div className="border-t border-surface-border overflow-hidden">
               <div className="px-8 py-5 border-b border-surface-border/50 bg-surface-bg/30">
                  <div className="card-label !mb-0">System preferences</div>
               </div>
               
                {isSuperAdmin && (
                  <div className="p-8 border-b border-surface-border/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group hover:bg-primary-500/5 transition-colors">
                    <div className="flex items-center gap-6">
                       <div className="w-20 h-20 flex items-center justify-center shrink-0">
                          {localStorage.getItem('companyLogo') ? (
                             <img src={localStorage.getItem('companyLogo')!} alt="Company Logo" className="w-full h-full object-contain" />
                          ) : (
                             <Store className="w-8 h-8 text-surface-text/20" />
                          )}
                       </div>
                       <div>
                          <div className="font-black text-base tracking-tight italic">Company branding</div>
                          <div className="card-label !mb-0">Set a circular logo for the system header</div>
                       </div>
                    </div>
                    <label className="btn-primary !px-6 !py-3 text-[10px] font-black tracking-widest  cursor-pointer w-full md:w-auto text-center shadow-lg shadow-primary-500/20" title="Upload company logo">
                       Upload logo
                       <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          title="Choose company logo file"
                          aria-label="Choose company logo file"
                          onChange={(e) => {
                             const file = e.target.files?.[0];
                             if (file) {
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                    const base64Logo = reader.result as string;
                                    localStorage.setItem('companyLogo', base64Logo);
                                    
                                    try {
                                      const token = localStorage.getItem('token');
                                      if (token) {
                                        await api.post('/settings', { logo: base64Logo }, {
                                          headers: { Authorization: `Bearer \${token}` }
                                        });
                                      }
                                      toast.success('Logo updated');
                                      window.dispatchEvent(new Event('storage'));
                                      window.location.reload();
                                    } catch {
                                      toast.error('Failed to save logo to database');
                                    }
                                 };
                                 reader.readAsDataURL(file);
                             }
                          }} 
                       />
                    </label>
                  </div>
                )}

               <div className="p-6 flex items-center justify-between group hover:bg-primary-500/5 transition-colors border-b border-surface-border/50">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                        <Smartphone className="w-5 h-5 text-primary-400" />
                     </div>
                     <div>
                        <div className="font-black text-sm tracking-tight">Appearance</div>
                        <div className="text-xs text-surface-text/40 font-bold">Switch between light and dark themes</div>
                     </div>
                  </div>
                  <ThemeToggle />
               </div>

               {isSuperAdmin && (
                 <div className="p-6 flex flex-col gap-4 group hover:bg-primary-500/5 transition-colors border-b border-surface-border/50">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                          <Building2 className="w-5 h-5 text-primary-400" />
                       </div>
                       <div>
                          <div className="font-black text-sm tracking-tight">Company registration</div>
                          <div className="text-xs text-surface-text/40 font-bold">Register your shop name / main brand</div>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1">
                        <input 
                          type="text" 
                          value={companyName} 
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="input-field w-full py-2 px-3 text-sm font-black shadow-inner" 
                          placeholder="Enter shop name..."
                        />
                      </div>
                      <button onClick={saveCompanyConfig} className="btn-primary !px-4 !py-2 text-[10px] font-black  tracking-widest h-[38px] shadow-lg shadow-primary-500/20">
                        Register
                      </button>
                    </div>
                 </div>
               )}

               {isSuperAdmin && (
                 <div className="p-6 flex flex-col gap-4 group hover:bg-primary-500/5 transition-colors">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                          <Wallet className="w-5 h-5 text-primary-400" />
                       </div>
                       <div>
                          <div className="font-black text-sm tracking-tight">Payment methods</div>
                          <div className="text-xs text-surface-text/40 font-bold">Configure mobile money and bank names (separate with commas)</div>
                       </div>
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-4 mt-2">
                      <div className="flex-1 w-full">
                        <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">MoMo Provider</label>
                        <input 
                          type="text" 
                          value={momoProvider} 
                          onChange={(e) => setMomoProvider(e.target.value)}
                          className="input-field w-full py-2 px-3 text-sm font-black shadow-inner" 
                          placeholder="e.g. TNM Mpamba, Airtel Money"
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Bank Name</label>
                        <input 
                          type="text" 
                          value={bankNameSetting} 
                          onChange={(e) => setBankNameSetting(e.target.value)}
                          className="input-field w-full py-2 px-3 text-sm font-black shadow-inner" 
                          placeholder="e.g. National Bank, NBS Bank, Standard Bank"
                        />
                      </div>
                      <div className="flex items-end h-full pt-4 w-full md:w-auto">
                        <button onClick={savePaymentConfig} className="btn-primary !px-4 !py-2 text-[10px] font-black tracking-widest h-[38px] w-full md:w-auto shadow-lg shadow-primary-500/20">
                          Save Config
                        </button>
                      </div>
                    </div>
                 </div>
               )}
            </div>

            {isSuperAdmin && (
              <div className="border-t border-surface-border overflow-hidden">
                 <div className="px-8 py-5 border-b border-surface-border/50 bg-accent-danger/5">
                    <h3 className="text-[10px] font-black text-accent-danger  tracking-[0.2em]">System security & control</h3>
                 </div>

                 <div className="p-6 border-b border-surface-border/50 flex items-center justify-between group hover:bg-accent-danger/5 transition-colors">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-accent-danger/10 rounded-2xl flex items-center justify-center border border-accent-danger/20 group-hover:border-accent-danger transition-all">
                          <ShieldAlert className="w-5 h-5 text-accent-danger" />
                       </div>
                       <div>
                          <div className="font-black text-sm tracking-tight">Force system lock</div>
                          <div className="text-xs text-surface-text/40 font-bold">Immediately restrict access for all non-admin users</div>
                       </div>
                    </div>
                    <button 
                       onClick={() => toggleSystemLock(true)}
                       className="btn-primary !bg-accent-danger hover:!bg-red-600 !px-4 !py-2 text-[10px] font-black  tracking-widest shadow-lg shadow-red-900/20"
                       title="Lock system access"
                    >
                       Lock system
                    </button>
                 </div>

                  <div className="p-6 border-b border-surface-border/50 flex flex-col gap-4 group hover:bg-primary-500/5 transition-colors">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                          <History className="w-5 h-5 text-primary-400" />
                       </div>
                       <div>
                          <div className="font-black text-sm tracking-tight">Working hours auto-lock</div>
                          <div className="text-xs text-surface-text/40 font-bold">Access is restricted daily during these off hours</div>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-surface-text/40 ml-1  tracking-widest">Lock Time</label>
                        <input 
                          type="time" 
                          value={lockTime} 
                          onChange={(e) => setLockTime(e.target.value)}
                          className="input-field w-full py-2 px-3 text-sm font-black shadow-inner" 
                          title="Set lock time"
                          aria-label="Set lock time"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-surface-text/40 ml-1  tracking-widest">Unlock Time</label>
                        <input 
                          type="time" 
                          value={unlockTime} 
                          onChange={(e) => setUnlockTime(e.target.value)}
                          className="input-field w-full py-2 px-3 text-sm font-black shadow-inner" 
                          title="Set unlock time"
                          aria-label="Set unlock time"
                        />
                      </div>
                      <div className="flex items-end h-full pt-4">
                        <button onClick={saveHours} className="btn-primary !px-4 !py-2 text-[10px] font-black  tracking-widest h-[38px] shadow-lg shadow-primary-500/20" title="Save auto-lock hours">
                          Save
                        </button>
                      </div>
                    </div>
                 </div>

                 <div className="p-6 flex flex-col gap-4 group hover:bg-primary-500/5 transition-colors">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                          <TrendingUp className="w-5 h-5 text-emerald-500" />
                       </div>
                       <div>
                          <div className="font-black text-sm tracking-tight">Tax Configuration</div>
                          <div className="text-xs text-surface-text/40 font-bold">Set global tax rate and calculation method</div>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-surface-text/40 ml-1  tracking-widest">Tax Rate (%)</label>
                        <input 
                          type="number" 
                          value={taxRate} 
                          onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                          className="input-field w-full py-2 px-3 text-sm font-black shadow-inner" 
                          title="Set tax rate percentage"
                          aria-label="Set tax rate percentage"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-surface-text/40 ml-1  tracking-widest">Tax Type</label>
                        <select 
                          value={taxInclusive ? 'inclusive' : 'exclusive'} 
                          onChange={(e) => setTaxInclusive(e.target.value === 'inclusive')}
                          className="input-field w-full py-2 px-3 text-sm font-black shadow-inner"
                          title="Select tax type"
                          aria-label="Select tax type"
                        >
                          <option value="inclusive">Inclusive</option>
                          <option value="exclusive">Exclusive</option>
                        </select>
                      </div>
                      <div className="flex items-end h-full pt-4">
                        <button onClick={saveTaxConfig} className="btn-primary !px-4 !py-2 text-[10px] font-black  tracking-widest h-[38px] shadow-lg shadow-primary-500/20" title="Save tax configuration">
                          Save
                        </button>
                      </div>
                    </div>
                 </div>
              </div>
            )}

            {isSuperAdmin && (
              <div className="p-6 flex flex-col gap-4 group hover:bg-primary-500/5 transition-colors border-b border-surface-border/50">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                       <Store className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                       <div className="font-black text-sm tracking-tight">Branch details</div>
                       <div className="text-xs text-surface-text/40 font-bold">Configure contact details for this branch</div>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                   <div className="w-full">
                     <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">WhatsApp Number</label>
                     <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#25D366]">
                           <svg fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </div>
                        <input 
                          type="text" 
                          value={branchWhatsApp} 
                          onChange={(e) => setBranchWhatsApp(e.target.value)}
                          className="input-field w-full py-2 pl-10 pr-3 text-sm font-black shadow-inner" 
                          placeholder="+265..."
                        />
                     </div>
                   </div>
                   <div className="flex items-end pt-4">
                     <button onClick={saveBranchDetails} className="btn-primary !px-6 !py-2 text-[10px] font-black tracking-widest h-[38px] shadow-lg shadow-primary-500/20">
                       Save Branch Info
                     </button>
                   </div>
                 </div>
              </div>
            )}

            {isSuperAdmin && (
              <div className="border-t border-surface-border overflow-hidden">
                 <div className="px-8 py-5 border-b border-surface-border/50 bg-surface-bg/30">
                    <div className="card-label !mb-0">Support & Information</div>
                 </div>
                 
                 <button 
                    onClick={() => navigate('/about')}
                    className="w-full text-left p-6 flex items-center justify-between group hover:bg-primary-500/5 transition-colors"
                 >
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                          <Info className="w-5 h-5 text-primary-400" />
                       </div>
                       <div>
                          <div className="font-black text-sm tracking-tight">Support & Documentation</div>
                          <div className="text-xs text-surface-text/40 font-bold">FAQ, Troubleshooting and Privacy Policy</div>
                       </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-surface-text/20 group-hover:text-primary-500 transition-all" />
                 </button>
              </div>
            )}
          </div>
       </div>
    </div>
  );
};

export default SettingsPage;
