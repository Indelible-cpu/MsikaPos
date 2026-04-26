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
  Key,
  Copy,
  Check,
  Loader2
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
    fetchUsers();
    fetchBranches();
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
      const error = err as any;
      toast.error(error.response?.data?.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this user account?')) {
      try {
        await api.delete(`/users/${id}`);
        toast.success('User deleted');
        fetchUsers();
      } catch {
        toast.error('Failed to delete user');
      }
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
    u.fullname?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <header className="px-0 py-0 md:px-6 md:py-6 bg-surface-card md:border-b border-surface-border sticky top-0 z-30">
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
              className="btn-primary !px-6 !py-4 text-[10px] font-black tracking-widest shadow-xl shadow-primary-500/10 flex items-center gap-2 w-full md:w-auto justify-center"
            >
              <UserPlus className="w-4 h-4 mr-1" /> Add staff
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

      <div className="p-0 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 md:gap-6">
         {filteredUsers.length === 0 ? (
            <div className="col-span-full py-20 text-center text-surface-text/20 font-black text-xs tracking-widest">No team members found</div>
         ) : (
           filteredUsers.map(u => (
             <div key={u.id} className="bg-surface-card md:border border-surface-border p-8 md:rounded-3xl group hover:border-primary-500/30 transition-all relative overflow-hidden border-b border-surface-border/50">
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                   <button title="Edit User" onClick={() => handleEdit(u)} className="p-2 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-primary-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                   <button title="Delete User" onClick={() => handleDelete(u.id)} className="p-2 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>

                <div className="flex flex-col items-center text-center">
                   <div className="w-24 h-24 bg-primary-600/10 text-primary-400 rounded-3xl flex items-center justify-center mb-6 border-2 border-primary-500/10 group-hover:border-primary-500/30 group-hover:scale-105 transition-all shadow-xl shadow-primary-500/5 relative">
                      {u.role === 'SUPER_ADMIN' && (
                        <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg border-4 border-surface-card">
                          <ShieldCheck className="w-3 h-3" />
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
                      {u.isVerified && (
                        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[8px] font-black tracking-widest">
                           VERIFIED
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
                <label htmlFor="username" className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1 uppercase">Username</label>
                <input id="username" required type="text" className="input-field w-full" placeholder="staff.user" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label htmlFor="fullname" className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1 uppercase">Full name</label>
                <input id="fullname" required type="text" className="input-field w-full" placeholder="John Doe" value={formData.fullname} onChange={(e) => setFormData({...formData, fullname: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label htmlFor="role" className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1 uppercase">Role</label>
                  <select id="role" title="Select User Role" className="input-field w-full appearance-none bg-surface-bg font-bold" value={formData.roleId} onChange={(e) => setFormData({...formData, roleId: Number(e.target.value)})}>
                     <option value={1}>SuperAdmin</option>
                     <option value={2}>Cashier</option>
                     <option value={3}>Admin</option>
                  </select>
               </div>
               <div className="space-y-1">
                  <label htmlFor="branch" className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1 uppercase">Branch</label>
                  <select id="branch" title="Select Branch" className="input-field w-full appearance-none bg-surface-bg font-bold" value={formData.branchId} onChange={(e) => setFormData({...formData, branchId: e.target.value})}>
                     <option value="">Select Branch</option>
                     {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label htmlFor="phone" className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1 uppercase">Phone</label>
                  <input id="phone" type="text" className="input-field w-full" placeholder="+265..." value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
               </div>
               <div className="space-y-1">
                  <label htmlFor="email" className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1 uppercase">Email address</label>
                  <input id="email" type="email" className="input-field w-full" placeholder="staff@example.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
               </div>
            </div>
            
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black tracking-widest uppercase">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 btn-primary !py-4 text-[10px] font-black tracking-widest uppercase shadow-lg shadow-primary-500/20">
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
                <label className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1 uppercase">Temporary Password</label>
                <div className="p-4 bg-surface-bg rounded-2xl border border-surface-border flex items-center justify-between">
                  <span className="font-black tracking-widest text-primary-500">{tempPassword}</span>
                  <button 
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
                  <label className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1 uppercase">Magic Invite Link</label>
                  <div className="p-4 bg-surface-bg rounded-2xl border border-surface-border flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold text-surface-text/50 truncate">
                      {window.location.origin}/onboarding?magicToken={magicToken}
                    </span>
                    <button 
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
    </div>
  );
};

export default UsersPage;
