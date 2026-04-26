import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { 
  Users, 
  UserPlus, 
  Edit2, 
  Mail, 
  Phone, 
  Search, 
  Trash2, 
  User as UserIcon,
  ShieldCheck,
  Store,
  Copy,
  Check,
  Loader2,
  Ban,
  UserX,
  Power,
  Info,
  Trash
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

interface User {
  id: number;
  username: string;
  fullname: string;
  email: string;
  phone: string;
  role: string;
  branch_id: number | null;
  branch_name: string;
  isVerified: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  createdAt: string;
}

const UsersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<{id: number, name: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [magicToken, setMagicToken] = useState<string | null>(null);
  
  // Action Modal State
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean,
    type: 'SUSPEND' | 'DEACTIVATE' | 'REACTIVATE' | 'DELETE' | 'HARD_DELETE' | null,
    user: User | null,
    reason: string
  }>({
    isOpen: false,
    type: null,
    user: null,
    reason: ''
  });

  const [formData, setFormData] = useState({
    username: '',
    fullname: '',
    email: '',
    phone: '',
    roleId: 2,
    branchId: ''
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch {
      toast.error('Failed to fetch users');
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get('/branches');
      setBranches(res.data.data);
    } catch {
      toast.error('Failed to fetch branches');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchUsers(), fetchBranches()]);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchUsers, fetchBranches]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/users', {
        ...formData,
        id: editingUser?.id
      });
      
      if (!editingUser && res.data.data?.tempPassword) {
        setTempPassword(res.data.data.tempPassword);
        setMagicToken(res.data.data.magicToken);
      } else {
        setIsModalOpen(false);
        toast.success(editingUser ? 'User updated' : 'User created');
      }
      
      fetchUsers();
      setEditingUser(null);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const PREDEFINED_REASONS = {
    SUSPEND: [
      "Suspicious login activity detected",
      "Repeated policy violations",
      "Stock discrepancy under investigation",
      "Unauthorized discounts detected",
      "Misuse of system features",
      "Temporary suspension for training",
      "Other (Type manually)"
    ],
    DEACTIVATE: [
      "Employee resigned",
      "End of employment contract",
      "Staff on long-term leave",
      "Account no longer required",
      "Branch closure",
      "Other (Type manually)"
    ],
    DELETE: [
      "Duplicate account created by mistake",
      "Staff member left the company",
      "Contract terminated for cause",
      "Account created for testing",
      "Other (Type manually)"
    ],
    HARD_DELETE: [
      "Privacy request (Right to be forgotten)",
      "Permanent removal of test data",
      "Security protocol enforcement",
      "Other (Type manually)"
    ]
  };

  const handleAction = async () => {
    if (!actionModal.user || !actionModal.type) return;
    
    const finalReason = actionModal.reason;
    if (actionModal.type !== 'REACTIVATE' && !finalReason) {
      return toast.error("Please provide a reason");
    }

    setLoading(true);
    try {
      if (actionModal.type === 'DELETE' || actionModal.type === 'HARD_DELETE') {
        await api.delete(`/users/${actionModal.user.id}`, {
          data: { 
            reason: actionModal.reason,
            hardDelete: actionModal.type === 'HARD_DELETE' 
          }
        });
      } else {
        const statusMap: Record<string, string> = {
          SUSPEND: 'SUSPENDED',
          DEACTIVATE: 'DEACTIVATED',
          REACTIVATE: 'ACTIVE'
        };
        await api.post('/users/status', {
          id: actionModal.user.id,
          status: statusMap[actionModal.type],
          reason: actionModal.reason
        });
      }

      toast.success("Action completed successfully");
      setActionModal({ isOpen: false, type: null, user: null, reason: '' });
      fetchUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      fullname: user.fullname || '',
      email: user.email || '',
      phone: user.phone || '',
      roleId: user.role === 'SUPER_ADMIN' ? 1 : user.role === 'ADMIN' ? 3 : 2,
      branchId: user.branch_id?.toString() || ''
    });
    setTempPassword(null);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      fullname: '',
      email: '',
      phone: '',
      roleId: 2,
      branchId: ''
    });
    setTempPassword(null);
    setMagicToken(null);
  };

  const filteredUsers = users.filter(u => 
    (u.fullname || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <header className="px-0 py-0 md:px-0 md:py-0 bg-transparent md:border-b border-surface-border sticky top-0 z-30">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="hidden md:flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter italic">Team</h1>
            </div>
            <button 
              onClick={() => { resetForm(); setEditingUser(null); setIsModalOpen(true); }}
              className="w-12 h-12 bg-primary-500 text-white rounded-full shadow-lg shadow-primary-500/20 active:scale-95 transition-all flex items-center justify-center relative group"
              title="Add staff"
            >
              <Users className="w-5 h-5" />
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-surface-bg flex items-center justify-center shadow-sm">
                <Plus className="w-3 h-3" />
              </div>
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by name or username..."
              className="input-field w-full pl-11 text-sm font-bold shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="p-0 md:p-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
         {loading && users.length === 0 ? (
            <div className="col-span-full py-40 flex flex-col items-center justify-center gap-4">
               <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
               <p className="text-[10px] font-black tracking-[0.3em] text-surface-text/20 uppercase">Retrieving Team Intelligence...</p>
            </div>
         ) : filteredUsers.length === 0 ? (
            <div className="col-span-full py-20 text-center text-surface-text/20 font-black text-xs tracking-widest">No team members found</div>
         ) : (
           filteredUsers.map(u => (
             <div key={u.id} className="p-8 group transition-all relative overflow-hidden border-b border-surface-border/50">
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
                   <button title="Edit User" onClick={() => handleEdit(u)} className="p-2 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-primary-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                   {u.status === 'ACTIVE' ? (
                     <>
                       <button title="Suspend User" onClick={() => setActionModal({ isOpen: true, type: 'SUSPEND', user: u, reason: '' })} className="p-2 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-orange-500 transition-colors"><Ban className="w-4 h-4" /></button>
                       <button title="Deactivate User" onClick={() => setActionModal({ isOpen: true, type: 'DEACTIVATE', user: u, reason: '' })} className="p-2 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-red-500 transition-colors"><UserX className="w-4 h-4" /></button>
                     </>
                   ) : (
                     <button title="Reactivate User" onClick={() => setActionModal({ isOpen: true, type: 'REACTIVATE', user: u, reason: '' })} className="p-2 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-emerald-500 transition-colors"><Power className="w-4 h-4" /></button>
                   )}
                   <button title="Soft Delete" onClick={() => setActionModal({ isOpen: true, type: 'DELETE', user: u, reason: '' })} className="p-2 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                   <button title="Hard Delete (Permanent)" onClick={() => setActionModal({ isOpen: true, type: 'HARD_DELETE', user: u, reason: '' })} className="p-2 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-black transition-colors"><Trash className="w-4 h-4" /></button>
                </div>

                <div className="flex flex-col items-center text-center">
                   <div className="w-24 h-24 bg-primary-600/10 text-primary-400 rounded-full flex items-center justify-center mb-6 border-2 border-primary-500/10 group-hover:border-primary-500/30 group-hover:scale-105 transition-all relative">
                      {u.role === 'SUPER_ADMIN' && (
                        <div className="absolute -top-1 -right-1 bg-emerald-500 text-white p-2 rounded-full border-4 border-surface-bg shadow-sm">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <UserIcon className="w-12 h-12" />
                   </div>
                   <h3 className="text-xl font-black tracking-tight">{u.fullname || 'New User'}</h3>
                   <p className="text-[10px] font-black text-surface-text/30 mb-4 tracking-[0.2em]">@{u.username}</p>
                   
                   <div className="flex gap-2 mb-6">
                      <div className="px-3 py-1 bg-primary-600/10 text-primary-400 border border-primary-500/20 rounded-full text-[8px] font-black tracking-widest">
                         {u.role}
                      </div>
                      {u.status !== 'ACTIVE' && (
                        <div className={`px-3 py-1 ${u.status === 'SUSPENDED' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} border rounded-full text-[8px] font-black tracking-widest`}>
                           {(u.status || 'ACTIVE').length > 0 ? (u.status || 'ACTIVE').charAt(0) + (u.status || 'ACTIVE').slice(1).toLowerCase() : ''}
                        </div>
                      )}
                      {u.isVerified && (
                        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[8px] font-black tracking-widest">
                           Verified
                        </div>
                      )}
                   </div>

                   <div className="w-full pt-6 border-t border-surface-border space-y-3">
                      <div className="flex items-center gap-3 text-surface-text/40">
                         <div className="w-8 h-8 bg-surface-bg border border-surface-border rounded-lg flex items-center justify-center">
                            <Store className="w-3.5 h-3.5" />
                         </div>
                         <span className="text-[10px] font-bold truncate">{u.branch_name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-surface-text/40">
                         <div className="w-8 h-8 bg-surface-bg border border-surface-border rounded-lg flex items-center justify-center">
                            <Mail className="w-3.5 h-3.5" />
                         </div>
                         <span className="text-[10px] font-bold truncate">{u.email || 'No email registered'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-surface-text/40">
                         <div className="w-8 h-8 bg-surface-bg border border-surface-border rounded-lg flex items-center justify-center">
                            <Phone className="w-3.5 h-3.5" />
                         </div>
                         <span className="text-[10px] font-bold">{u.phone || 'No phone registered'}</span>
                      </div>
                   </div>
                </div>
             </div>
           ))
         )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingUser ? 'Edit Staff' : 'New Staff'}
        maxWidth="max-w-xl"
      >
        {!tempPassword ? (
          <form onSubmit={handleSave} className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="username" className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">Username</label>
                <input id="username" required type="text" className="input-field w-full" placeholder="staff.user" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label htmlFor="fullname" className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">Full name</label>
                <input id="fullname" required type="text" className="input-field w-full" placeholder="John Doe" value={formData.fullname} onChange={(e) => setFormData({...formData, fullname: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label htmlFor="role" className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">Role</label>
                  <select id="role" title="Select User Role" className="input-field w-full appearance-none bg-surface-bg font-bold" value={formData.roleId} onChange={(e) => setFormData({...formData, roleId: Number(e.target.value)})}>
                     <option value={1}>SuperAdmin</option>
                     <option value={2}>Cashier</option>
                     <option value={3}>Admin</option>
                  </select>
               </div>
               <div className="space-y-1">
                  <label htmlFor="branch" className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">Branch</label>
                  <select id="branch" title="Select Branch" className="input-field w-full appearance-none bg-surface-bg font-bold" value={formData.branchId} onChange={(e) => setFormData({...formData, branchId: e.target.value})}>
                     <option value="">Select Branch</option>
                     {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label htmlFor="phone" className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">Phone</label>
                  <input id="phone" type="text" className="input-field w-full" placeholder="+265..." value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
               </div>
               <div className="space-y-1">
                  <label htmlFor="email" className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">Email address</label>
                  <input id="email" type="email" className="input-field w-full" placeholder="staff@example.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
               </div>
            </div>
            
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black tracking-widest">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 btn-primary !py-4 text-[10px] font-black tracking-widest shadow-lg shadow-primary-500/20">
                {loading ? <Loader2 className="animate-spin" /> : (editingUser ? 'Save Changes' : 'Create Account')}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-10 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black italic tracking-tighter text-emerald-500 mb-2">Account Ready</h2>
              <p className="text-surface-text/40 text-xs px-4">Provide these details to the user to complete their profile.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">Temporary Password</label>
                <div className="p-4 bg-surface-bg rounded-2xl border border-surface-border flex items-center justify-between">
                  <span className="font-black tracking-widest text-primary-500">{tempPassword}</span>
                  <button 
                    title="Copy Password"
                    aria-label="Copy Password"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPassword || '');
                      toast.success('Password copied');
                    }}
                    className="p-2 text-surface-text/20 hover:text-primary-500 transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {magicToken && (
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">Magic Invite Link</label>
                  <div className="p-4 bg-surface-bg rounded-2xl border border-surface-border flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold text-surface-text/50 truncate">
                      {window.location.origin}/onboarding?magicToken={magicToken}
                    </span>
                    <button 
                      title="Copy Magic Link"
                      aria-label="Copy Magic Link"
                      onClick={() => {
                        const link = `${window.location.origin}/onboarding?magicToken=${magicToken}`;
                        navigator.clipboard.writeText(link);
                        toast.success('Magic link copied');
                      }}
                      className="p-2 bg-primary-500 text-white rounded-xl hover:scale-110 transition-all shadow-lg shadow-primary-500/20"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[8px] font-bold text-emerald-500/60 mt-1">This link expires in 7 days and skips the login password.</p>
                </div>
              )}
            </div>

            <button 
              onClick={() => {
                setIsModalOpen(false);
                setTempPassword(null);
                setMagicToken(null);
              }}
              className="btn-primary w-full h-16 shadow-xl shadow-primary-500/20"
            >
              Done
              <Check className="w-5 h-5" />
            </button>
          </div>
        )}
      </Modal>

      {/* Action Confirmation Modal */}
      <Modal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ ...actionModal, isOpen: false })}
        title={actionModal.type?.replace('_', ' ') || 'Action'}
        maxWidth="max-w-md"
      >
        <div className="p-8 space-y-6">
          <div className="flex items-start gap-4 p-4 bg-primary-500/5 rounded-2xl border border-primary-500/10">
            <Info className="w-5 h-5 text-primary-500 mt-0.5" />
            <p className="text-[11px] font-bold text-surface-text/60 leading-relaxed">
              You are about to <strong>{actionModal.type?.toLowerCase().replace('_', ' ')}</strong> the account for <strong>{actionModal.user?.fullname}</strong>. 
              The user will receive an email notification with your reason.
            </p>
          </div>

          {actionModal.type !== 'REACTIVATE' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest text-surface-text/30 ml-1">Select Reason</label>
                <select 
                  title="Select Reason"
                  aria-label="Select Reason"
                  className="input-field w-full h-14 text-sm font-bold bg-surface-bg appearance-none"
                  value={PREDEFINED_REASONS[actionModal.type as keyof typeof PREDEFINED_REASONS]?.includes(actionModal.reason) ? actionModal.reason : "Other (Type manually)"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setActionModal({ ...actionModal, reason: val === "Other (Type manually)" ? "" : val });
                  }}
                >
                  <option value="" disabled>Choose a reason...</option>
                  {PREDEFINED_REASONS[actionModal.type as keyof typeof PREDEFINED_REASONS]?.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {(!PREDEFINED_REASONS[actionModal.type as keyof typeof PREDEFINED_REASONS]?.includes(actionModal.reason) || actionModal.reason === "") && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-surface-text/30 ml-1">Manual Reason</label>
                  <textarea 
                    className="input-field w-full min-h-[100px] py-4 text-sm font-bold resize-none"
                    placeholder="Type your custom reason here..."
                    value={actionModal.reason}
                    onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4">
            <button 
              onClick={() => setActionModal({ ...actionModal, isOpen: false })}
              className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black tracking-widest"
            >
              Cancel
            </button>
            <button 
              onClick={handleAction}
              disabled={loading}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest shadow-lg transition-all ${
                actionModal.type === 'REACTIVATE' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 
                actionModal.type === 'HARD_DELETE' ? 'bg-black text-white shadow-black/20' :
                'bg-red-500 text-white shadow-red-500/20'
              }`}
            >
              {loading ? <Loader2 className="animate-spin mx-auto" /> : `Confirm ${actionModal.type?.replace('_', ' ')}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UsersPage;
