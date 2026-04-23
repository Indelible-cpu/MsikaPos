import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Store, Smartphone, Receipt, Users, CreditCard, Wallet, Plus, TrendingUp, ShieldAlert, History } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import toast from 'react-hot-toast';
import { db } from '../db/posDB';
import { AuditService } from '../services/AuditService';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Signed out successfully');
    navigate('/login');
  };

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const [lockTime, setLockTime] = React.useState('20:00');
  const [unlockTime, setUnlockTime] = React.useState('06:00');

  React.useEffect(() => {
    const loadHours = async () => {
      const hours = await db.settings.get('lockout_hours');
      if (hours?.value) {
        setLockTime((hours.value as any).start);
        setUnlockTime((hours.value as any).end);
      }
    };
    loadHours();
  }, []);

  const saveHours = async () => {
    try {
      await db.settings.put({ key: 'lockout_hours', value: { start: lockTime, end: unlockTime } });
      toast.success('Auto-lock hours updated');
    } catch {
      toast.error('Failed to save auto-lock hours');
    }
  };

  const toggleSystemLock = async (isLocked: boolean) => {
    try {
      await db.settings.put({ key: 'system_lock', value: isLocked });
      await AuditService.log(isLocked ? 'SYSTEM_LOCKED' : 'SYSTEM_UNLOCKED', `System manually ${isLocked ? 'locked' : 'unlocked'} by ${user.username}`);
      toast.success(`System ${isLocked ? 'Locked' : 'Unlocked'}`);
      window.location.reload();
    } catch {
      toast.error('Failed to update system lock');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg text-surface-text">
       {/* Mobile Header */}
       <header className="p-6 bg-surface-card border-b border-surface-border md:hidden">
          <h1 className="text-2xl font-black tracking-tighter">Account menu</h1>
       </header>

       <div className="p-0 md:p-8 space-y-px md:space-y-6">
          {/* User Profile Section */}
          <div className="bg-surface-card p-6 border-b border-surface-border md:border md:rounded-3xl flex items-center gap-4 group">
             <div className="relative w-20 h-20 shrink-0">
                <div className="w-20 h-20 bg-primary-600/20 text-primary-400 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary-500/20 group-hover:border-primary-500 transition-all shadow-xl shadow-primary-500/5">
                   {user.profile_pic ? (
                     <img src={user.profile_pic} alt="Profile" className="w-full h-full object-cover" />
                   ) : (
                     <User className="w-10 h-10" />
                   )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform border-4 border-surface-card">
                   <Plus className="w-5 h-5" />
                   <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                               const updatedUser = { ...user, profile_pic: reader.result as string };
                               localStorage.setItem('user', JSON.stringify(updatedUser));
                               toast.success('Profile picture updated');
                               window.location.reload();
                            };
                            reader.readAsDataURL(file);
                         }
                      }}
                   />
                </label>
             </div>
             <div>
                <h2 className="text-xl font-black tracking-tight">{user.fullname || user.username || 'Employee'}</h2>
                <p className="text-[10px] text-surface-text/40 font-black uppercase tracking-[0.2em] mt-1">Branch: {user.branch_name || 'Domasi Main'}</p>
                <div className="mt-2 flex gap-2">
                   <span className="px-2 py-0.5 bg-primary-500/10 text-primary-500 rounded text-[8px] font-black uppercase tracking-widest border border-primary-500/20">{user.role || 'Staff'}</span>
                   <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">Online</span>
                </div>
             </div>
          </div>

          <div className="space-y-px md:space-y-6">
            {/* System Preferences */}
            <div className="bg-surface-card md:border md:rounded-3xl overflow-hidden">
               <div className="px-6 py-4 border-b border-surface-border/50">
                  <h3 className="text-[10px] font-black text-surface-text/30 uppercase tracking-[0.2em]">System preferences</h3>
               </div>
               
               {/* Logo Upload Section */}
               <div className="p-6 border-b border-surface-border/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group hover:bg-primary-500/5 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 rounded-full border-2 border-primary-500/40 overflow-hidden bg-surface-bg flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/5 group-hover:border-primary-500 transition-all">
                        {localStorage.getItem('companyLogo') ? (
                           <img src={localStorage.getItem('companyLogo')!} alt="Company Logo" className="w-full h-full object-cover scale-[1.2]" />
                        ) : (
                           <Store className="w-6 h-6 text-surface-text/20" />
                        )}
                     </div>
                     <div>
                        <div className="font-black text-sm tracking-tight">Company logo</div>
                        <div className="text-xs text-surface-text/40 font-bold">Set a circular logo for the mobile header</div>
                     </div>
                  </div>
                  <label className="btn-primary !px-6 !py-3 text-[10px] font-black tracking-widest uppercase cursor-pointer w-full md:w-auto text-center shadow-lg shadow-primary-500/20">
                     Upload logo
                     <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                 localStorage.setItem('companyLogo', reader.result as string);
                                 toast.success('Logo updated');
                                 window.dispatchEvent(new Event('storage'));
                                 window.location.reload();
                              };
                              reader.readAsDataURL(file);
                           }
                        }} 
                     />
                  </label>
               </div>

               <div className="p-6 flex items-center justify-between group hover:bg-primary-500/5 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-surface-bg rounded-xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                        <Smartphone className="w-5 h-5 text-primary-400" />
                     </div>
                     <div>
                        <div className="font-black text-sm tracking-tight">Appearance</div>
                        <div className="text-xs text-surface-text/40 font-bold">Switch between light and dark themes</div>
                     </div>
                  </div>
                  <ThemeToggle />
               </div>
            </div>

            {/* Business Info */}
            <div className="bg-surface-card md:border md:rounded-3xl overflow-hidden">
               <div className="px-6 py-4 border-b border-surface-border/50">
                  <h3 className="text-[10px] font-black text-surface-text/30 uppercase tracking-[0.2em]">Business tools</h3>
               </div>
               
               <div className="divide-y divide-surface-border/50">
                  <button onClick={() => navigate('/debt')} className="w-full text-left p-6 flex items-center justify-between group hover:bg-primary-500/5 transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-surface-bg rounded-xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                           <CreditCard className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                           <div className="font-black text-sm tracking-tight">Debt management</div>
                           <div className="text-xs text-surface-text/40 font-bold">Track customer balances and payments</div>
                        </div>
                     </div>
                  </button>

                  <button onClick={() => navigate('/expenses')} className="w-full text-left p-6 flex items-center justify-between group hover:bg-primary-500/5 transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-surface-bg rounded-xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                           <Wallet className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                           <div className="font-black text-sm tracking-tight">Expenses tracking</div>
                           <div className="text-xs text-surface-text/40 font-bold">Log and monitor daily operational costs</div>
                        </div>
                     </div>
                  </button>

                  <button onClick={() => navigate('/transactions')} className="w-full text-left p-6 flex items-center justify-between group hover:bg-primary-500/5 transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-surface-bg rounded-xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                           <Receipt className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                           <div className="font-black text-sm tracking-tight">Transactions history</div>
                           <div className="text-xs text-surface-text/40 font-bold">Detailed history of all system activities</div>
                        </div>
                     </div>
                  </button>

                  <button onClick={() => navigate('/reports')} className="w-full text-left p-6 flex items-center justify-between group hover:bg-primary-500/5 transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-surface-bg rounded-xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                           <TrendingUp className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                           <div className="font-black text-sm tracking-tight">Business Reports</div>
                           <div className="text-xs text-surface-text/40 font-bold">Financial, staff and customer analytics</div>
                        </div>
                     </div>
                  </button>

                  <button onClick={() => navigate('/users')} className="w-full text-left p-6 flex items-center justify-between group hover:bg-primary-500/5 transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-surface-bg rounded-xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                           <Users className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                           <div className="font-black text-sm tracking-tight">Team management</div>
                           <div className="text-xs text-surface-text/40 font-bold">Manage staff access and permissions</div>
                        </div>
                     </div>
                  </button>

                  <button onClick={() => navigate('/branches')} className="w-full text-left p-6 flex items-center justify-between group hover:bg-primary-500/5 transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-surface-bg rounded-xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                           <Store className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                           <div className="font-black text-sm tracking-tight">Branch management</div>
                           <div className="text-xs text-surface-text/40 font-bold">View and update location details</div>
                        </div>
                     </div>
                  </button>
               </div>
            </div>

            {/* Super Admin Security Section */}
            {isSuperAdmin && (
              <div className="bg-surface-card md:border md:rounded-3xl overflow-hidden">
                 <div className="px-6 py-4 border-b border-surface-border/50 bg-accent-danger/5">
                    <h3 className="text-[10px] font-black text-accent-danger uppercase tracking-[0.2em]">System security & control</h3>
                 </div>

                 <div className="p-6 border-b border-surface-border/50 flex items-center justify-between group hover:bg-accent-danger/5 transition-colors">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-accent-danger/10 rounded-xl flex items-center justify-center border border-accent-danger/20 group-hover:border-accent-danger transition-all">
                          <ShieldAlert className="w-5 h-5 text-accent-danger" />
                       </div>
                       <div>
                          <div className="font-black text-sm tracking-tight">Force system lock</div>
                          <div className="text-xs text-surface-text/40 font-bold">Immediately restrict access for all non-admin users</div>
                       </div>
                    </div>
                    <button 
                       onClick={() => toggleSystemLock(true)}
                       className="btn-primary !bg-accent-danger hover:!bg-red-600 !px-4 !py-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-900/20"
                    >
                       Lock system
                    </button>
                 </div>

                 <div className="p-6 flex flex-col gap-4 group hover:bg-primary-500/5 transition-colors">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-surface-bg rounded-xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                          <History className="w-5 h-5 text-primary-400" />
                       </div>
                       <div>
                          <div className="font-black text-sm tracking-tight">Working hours auto-lock</div>
                          <div className="text-xs text-surface-text/40 font-bold">Access is restricted daily during these off hours</div>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-surface-text/40 ml-1 uppercase tracking-widest">Lock Time</label>
                        <input 
                          type="time" 
                          value={lockTime} 
                          onChange={(e) => setLockTime(e.target.value)}
                          className="input-field w-full py-2 px-3 text-sm font-black shadow-inner" 
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-surface-text/40 ml-1 uppercase tracking-widest">Unlock Time</label>
                        <input 
                          type="time" 
                          value={unlockTime} 
                          onChange={(e) => setUnlockTime(e.target.value)}
                          className="input-field w-full py-2 px-3 text-sm font-black shadow-inner" 
                        />
                      </div>
                      <div className="flex items-end h-full pt-4">
                        <button onClick={saveHours} className="btn-primary !px-4 !py-2 text-[10px] font-black uppercase tracking-widest h-[38px] shadow-lg shadow-primary-500/20">
                          Save
                        </button>
                      </div>
                    </div>
                 </div>
              </div>
            )}

            {/* Logout Action */}
            <div className="p-6 md:px-0 pb-12">
               <button 
                  onClick={handleSignOut}
                  className="w-full py-5 bg-accent-danger/10 hover:bg-accent-danger text-accent-danger hover:text-white border border-accent-danger/20 rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 active:scale-95 shadow-xl shadow-red-900/5"
               >
                  <LogOut className="w-6 h-6" />
                  Sign out of system
               </button>
            </div>
          </div>
       </div>
    </div>
  );
};

export default SettingsPage;
