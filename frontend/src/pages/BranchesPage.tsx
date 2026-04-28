import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { 
  Store, 
  MapPin, 
  Phone, 
  Plus, 
  ExternalLink,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { AuditService } from '../services/AuditService';

interface Branch {
  id: number;
  name: string;
  address: string;
  phone: string;
  email?: string;
  facebook?: string;
  slogan?: string;
  logo?: string;
}

const BranchesPage: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    address: '', 
    phone: '', 
    email: '', 
    facebook: '', 
    slogan: '', 
    logo: '' 
  });

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/branches');
      setBranches(res.data.data);
    } catch {
      toast.error('Failed to fetch branches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (active) await fetchBranches();
    };
    load();
    return () => { active = false; };
  }, [fetchBranches]);

  const stats = [
    { label: 'TOTAL BRANCHES', value: (branches?.length || 0).toString(), icon: Store, color: 'text-primary-500' },
    { label: 'MAIN HQ', value: branches?.[0]?.name || 'N/A', icon: ShieldCheck, color: 'text-emerald-500' },
    { label: 'NETWORK STATUS', value: 'Active', icon: MapPin, color: 'text-amber-500' },
  ];

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast.error('Access Denied: Only Super Admins can add branches');
      return;
    }
    if (!/^\d{10}$|^\d{13}$/.test(formData.phone)) {
      toast.error('Branch contact number must be exactly 10 or 13 digits');
      return;
    }
    setLoading(true);
    try {
      await api.post('/branches', formData);
      await AuditService.log('BRANCH_ADD', `Added new branch: ${formData.name} at ${formData.address}`);
      toast.success('Branch added successfully');
      setIsModalOpen(false);
      setFormData({ name: '', address: '', phone: '', email: '', facebook: '', slogan: '', logo: '' });
      fetchBranches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add branch');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0 px-0">
      <header className="bg-surface-card border-b border-surface-border px-6 md:px-12 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 sticky top-0 z-30">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black tracking-tighter uppercase">Branch Management</h1>
          <p className="text-[10px] font-black text-surface-text/40 tracking-widest uppercase">Configure and manage your business outlets</p>
        </div>
        {isSuperAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary !px-8 !py-4 flex items-center gap-2 text-[10px] font-black tracking-widest shadow-xl shadow-primary-500/20 uppercase"
          >
            <Plus className="w-4 h-4" /> Add Branch
          </button>
        )}
      </header>

      <div className="px-6 md:px-12 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 bg-surface-card border border-surface-border rounded-3xl overflow-hidden mb-12">
          {stats.map((stat, i) => (
            <div key={i} className={clsx("p-8 bg-surface-card", i < stats.length - 1 && "md:border-r border-surface-border/50")}>
              <div className={`p-2 rounded-xl bg-surface-bg border border-surface-border w-fit mb-4 ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div className="text-xl md:text-2xl font-black tracking-tighter uppercase leading-none">{stat.value}</div>
              <div className="text-[9px] font-black text-surface-text/30 tracking-widest uppercase mt-2">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading && branches.length === 0 ? (
            <div className="col-span-full py-40 flex flex-col items-center justify-center gap-4 bg-surface-card border border-dashed border-surface-border rounded-3xl">
              <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
              <p className="text-[10px] font-black tracking-widest text-surface-text/20 uppercase">Loading branches...</p>
            </div>
          ) : branches?.map((branch, i) => (
            <motion.div
              key={branch.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="overflow-hidden group transition-all bg-surface-card border border-surface-border rounded-3xl hover:border-primary-500/20 shadow-sm"
            >
              <div className="h-28 bg-gradient-to-br from-primary-600/10 to-primary-900/40 relative">
                 <div className="absolute -bottom-6 left-6 w-14 h-14 bg-surface-card border-2 border-primary-500/10 rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform group-hover:border-primary-500/30 overflow-hidden">
                    {branch.logo ? (
                      <img src={branch.logo} alt="Branch Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-7 h-7 text-primary-500" />
                    )}
                 </div>
              </div>
              
              <div className="p-6 pt-12">
                <h3 className="text-xl font-black tracking-tight mb-1 uppercase">{branch.name}</h3>
                {branch.slogan && <p className="text-[9px] text-surface-text/40 font-black mb-4 uppercase">"{branch.slogan}"</p>}
                <div className="flex items-center gap-2 text-surface-text/40 mb-6">
                   <MapPin className="w-3 h-3" />
                   <span className="text-[10px] font-black tracking-widest uppercase">{branch.address || 'Location not set'}</span>
                </div>
                
                <div className="space-y-4 pt-6 border-t border-surface-border">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-surface-bg border border-surface-border rounded-lg flex items-center justify-center">
                            <Phone className="w-3.5 h-3.5 text-surface-text/20" />
                         </div>
                         <span className="text-[9px] font-black tracking-widest text-surface-text/60 uppercase">Contact</span>
                      </div>
                      <span className="text-[10px] font-black tracking-widest uppercase">{branch.phone || 'N/A'}</span>
                   </div>
                   {branch.email && (
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 bg-surface-bg border border-surface-border rounded-lg flex items-center justify-center">
                              <Plus className="w-3.5 h-3.5 text-primary-500/40" />
                           </div>
                           <span className="text-[9px] font-black tracking-widest text-surface-text/60 uppercase">Email</span>
                        </div>
                        <span className="text-[10px] font-black tracking-widest lowercase">{branch.email}</span>
                     </div>
                   )}
                </div>

                <div className="flex gap-3 mt-8">
                   {isSuperAdmin && (
                     <button className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black tracking-widest hover:bg-primary-500/5 transition-all active:scale-95 shadow-sm uppercase">
                        Configure
                     </button>
                   )}
                    <button 
                      onClick={async () => {
                        localStorage.setItem('currentBranch', JSON.stringify(branch));
                        await AuditService.log('BRANCH_SWITCH', `Administrator switched context to branch: ${branch.name}`);
                        toast.success(`Switched to ${branch.name}`);
                      }}
                      className="p-4 bg-primary-500 text-white rounded-2xl shadow-xl shadow-primary-500/20 active:scale-95 transition-all"
                      title="Switch to this branch"
                      aria-label={`Switch to ${branch.name}`}
                    >
                      <ExternalLink className="w-5 h-5" />
                   </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {!loading && branches?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-surface-card border border-dashed border-surface-border rounded-3xl opacity-60">
             <Store className="w-16 h-16 text-surface-text/10 mb-6" />
             <h2 className="text-xl font-black tracking-widest uppercase">No branches found</h2>
             <p className="text-[10px] font-black tracking-widest mt-2 uppercase text-surface-text/30">Add your first business location to get started</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card border border-surface-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-8 border-b border-surface-border flex justify-between items-center bg-surface-bg/30">
                <h3 className="text-xl font-black tracking-tighter uppercase">New Branch Registration</h3>
              </div>
              <form onSubmit={handleAddBranch} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black tracking-widest text-surface-text/40 ml-1 uppercase">Branch name *</label>
                      <input required className="input-field w-full py-3 px-4 font-black" placeholder="eg. Domasi Branch" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black tracking-widest text-surface-text/40 ml-1 uppercase">Location address *</label>
                      <input required className="input-field w-full py-3 px-4 font-black" placeholder="eg. Zomba Main Road" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black tracking-widest text-surface-text/40 ml-1 uppercase">Phone contact *</label>
                      <input required className="input-field w-full py-3 px-4 font-black" placeholder="eg. +265..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black tracking-widest text-surface-text/40 ml-1 uppercase">Email address</label>
                      <input type="email" className="input-field w-full py-3 px-4 font-black" placeholder="eg. branch@msikapos.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black tracking-widest text-surface-text/40 ml-1 uppercase">Facebook Page (Optional)</label>
                      <input className="input-field w-full py-3 px-4 font-black" placeholder="eg. facebook.com/msikapos" value={formData.facebook} onChange={e => setFormData({...formData, facebook: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black tracking-widest text-surface-text/40 ml-1 uppercase">Branch slogan</label>
                      <input className="input-field w-full py-3 px-4 font-black" placeholder="eg. Excellence in Service" value={formData.slogan} onChange={e => setFormData({...formData, slogan: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black tracking-widest text-surface-text/40 ml-1 uppercase">Branch logo</label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-surface-bg border border-surface-border flex items-center justify-center overflow-hidden shrink-0">
                          {formData.logo ? (
                            <img src={formData.logo} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <Store className="w-6 h-6 text-surface-text/10" />
                          )}
                        </div>
                        <label className="btn-primary !px-4 !py-2 text-[8px] font-black tracking-widest cursor-pointer uppercase">
                          Choose image
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 mt-8">
                  <button type="submit" className="w-full btn-primary h-16 font-black tracking-widest shadow-2xl shadow-primary-500/20 uppercase">Register Branch Office</button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full h-14 bg-surface-bg text-[10px] font-black tracking-widest hover:bg-surface-border/50 transition-all border border-surface-border rounded-2xl uppercase"
                  >
                    Close Window
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BranchesPage;
