import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalUser } from '../db/posDB';
import { 
  Users, 
  UserPlus, 
  Edit2, 
  Shield, 
  Mail, 
  Phone, 
  Search, 
  X, 
  Trash2, 
  AlertCircle,
  User as UserIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

const UsersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<LocalUser | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    fullname: '',
    email: '',
    phone: '',
    role: 'Staff',
    roleId: 2
  });

  const users = useLiveQuery(
    () => db.users
      .filter(u => u.fullname.toLowerCase().includes(searchTerm.toLowerCase()) || u.username.toLowerCase().includes(searchTerm.toLowerCase()))
      .toArray(),
    [searchTerm]
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await db.users.update(editingUser.id, formData);
        toast.success('User updated');
      } else {
        await db.users.add({
          ...formData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        });
        toast.success('User created');
      }
      setIsModalOpen(false);
      setEditingUser(null);
      resetForm();
    } catch {
      toast.error('Failed to save user');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this user account?')) {
      await db.users.delete(id);
      toast.success('User deleted');
    }
  };

  const handleEdit = (user: LocalUser) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      fullname: user.fullname,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      roleId: user.roleId
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      fullname: '',
      email: '',
      phone: '',
      role: 'Staff',
      roleId: 2
    });
  };

  const roles = [
    { id: 1, name: 'SuperAdmin' },
    { id: 2, name: 'Staff' },
    { id: 3, name: 'Manager' }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <header className="p-6 bg-surface-card border-b border-surface-border sticky top-0 z-30">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase">Team</h1>
          </div>
          <button 
            onClick={() => { resetForm(); setEditingUser(null); setIsModalOpen(true); }}
            className="btn-primary !px-4 !py-2 text-[10px] font-black uppercase tracking-widest"
          >
            <UserPlus className="w-4 h-4 mr-1" /> Add Staff
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by name or username..."
            className="input-field w-full pl-11 text-sm h-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {users?.length === 0 ? (
           <div className="col-span-full py-20 text-center text-surface-text/20 uppercase font-black text-xs tracking-widest">No team members found</div>
         ) : (
           users?.map(u => (
             <div key={u.id} className="bg-surface-card border border-surface-border p-8 rounded-3xl group hover:border-primary-500/30 transition-all relative overflow-hidden">
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                   <button onClick={() => handleEdit(u)} className="p-2 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-primary-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                   <button onClick={() => handleDelete(u.id)} className="p-2 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>

                <div className="flex flex-col items-center text-center">
                   <div className="w-20 h-20 bg-primary-600/10 text-primary-400 rounded-2xl flex items-center justify-center mb-6 border border-primary-500/20 group-hover:scale-105 transition-transform">
                      <UserIcon className="w-10 h-10" />
                   </div>
                   <h3 className="text-lg font-black uppercase tracking-tight">{u.fullname}</h3>
                   <p className="text-[10px] font-black text-surface-text/30 uppercase tracking-widest mb-6">@{u.username}</p>
                   
                   <div className="px-4 py-1 bg-primary-600/10 text-primary-400 border border-primary-500/20 rounded-full text-[9px] font-black uppercase tracking-widest mb-8">
                      {u.role}
                   </div>

                   <div className="w-full pt-6 border-t border-surface-border space-y-4">
                      <div className="flex items-center gap-3 text-surface-text/40">
                         <Mail className="w-3 h-3" />
                         <span className="text-[10px] font-bold truncate">{u.email || 'No email'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-surface-text/40">
                         <Phone className="w-3 h-3" />
                         <span className="text-[10px] font-bold">{u.phone || 'No phone'}</span>
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
      >
        <form onSubmit={handleSave} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/30 ml-1">Username</label>
              <input required type="text" className="input-field w-full" placeholder="staff.user" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/30 ml-1">Full Name</label>
              <input required type="text" className="input-field w-full" placeholder="John Doe" value={formData.fullname} onChange={(e) => setFormData({...formData, fullname: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/30 ml-1">Role</label>
                <select className="input-field w-full appearance-none bg-surface-bg" value={formData.roleId} onChange={(e) => {
                   const r = roles.find(rl => rl.id === Number(e.target.value));
                   setFormData({...formData, roleId: r!.id, role: r!.name});
                }}>
                   {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/30 ml-1">Phone</label>
                <input type="text" className="input-field w-full" placeholder="+265..." value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
             </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/30 ml-1">Email (Optional)</label>
            <input type="email" className="input-field w-full" placeholder="staff@example.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black uppercase tracking-widest">Cancel</button>
            <button type="submit" className="flex-1 btn-primary !py-4 text-[10px] font-black uppercase tracking-widest">Save Staff</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default UsersPage;
