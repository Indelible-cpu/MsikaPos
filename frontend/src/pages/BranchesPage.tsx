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
    { label: 'Total Branches', value: (branches?.length || 0).toString(), icon: Store, color: 'text-primary-500' },
    { label: 'Main HQ', value: branches?.[0]?.name || 'N/A', icon: ShieldCheck, color: 'text-emerald-500' },
    { label: 'Network', value: 'Active', icon: MapPin, color: 'text-amber-500' },
  ];

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$|^\d{13}$/.test(formData.phone)) {
      toast.error('Branch contact number must be exactly 10 or 13 digits');
      return;
    }
    setLoading(true);
    try {
      await api.post('/branches', formData);
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
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <header className="px-0 py-0 md:px-6 md:py-6 bg-transparent md:border-b border-surface-border sticky top-0 z-30">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="hidden md:block">
              <h1 className="text-2xl font-black tracking-tighter  italic">Branch Management</h1>
              <p className="text-[10px] text-surface-text/40 font-black  tracking-widest mt-1">Configure and manage your business outlets</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn-primary !px-6 !py-4 flex items-center gap-2 text-[10px] font-black  tracking-widest shadow-xl shadow-primary-500/10 w-full md:w-auto justify-center"
            >
              <Plus className="w-4 h-4" /> Add Branch
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 md:gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="p-3 md:p-4 border-r border-surface-border/50">
                <div className={`p-1.5 rounded-lg bg-surface-card border border-surface-border w-fit mb-2 ${stat.color}`}>
                  <stat.icon className="w-3.5 h-3.5" />
                </div>
                <div className="text-base md:text-lg font-black leading-none">{stat.value}</div>
                <div className="text-[7px] md:text-[9px] font-black text-surface-text/30  tracking-widest mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="p-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
        {loading && branches.length === 0 ? (
          <div className="col-span-full py-40 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            <p className="text-[10px] font-black tracking-[0.3em] text-surface-text/20 italic">Loading branches...</p>
          </div>
        ) : branches?.map((branch, i) => (
          <motion.div
            key={branch.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="overflow-hidden group transition-all border-b border-surface-border/50"
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
              <h3 className="text-xl font-black tracking-tight mb-1">{branch.name}</h3>
              {branch.slogan && <p className="text-[9px] text-surface-text/40 font-black italic mb-4">"{branch.slogan}"</p>}
              <div className="flex items-center gap-2 text-surface-text/40 mb-6">
                 <MapPin className="w-3 h-3" />
                 <span className="text-[10px] font-black  tracking-widest">{branch.address || 'Location not set'}</span>
              </div>
              
              <div className="space-y-4 pt-6 border-t border-surface-border">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 bg-surface-bg border border-surface-border rounded-lg flex items-center justify-center">
                          <Phone className="w-3.5 h-3.5 text-surface-text/20" />
                       </div>
                       <span className="text-[9px] font-black  tracking-widest text-surface-text/60">Contact</span>
                    </div>
                    <span className="text-[10px] font-black tracking-widest">{branch.phone || 'N/A'}</span>
                 </div>
                 {branch.email && (
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-surface-bg border border-surface-border rounded-lg flex items-center justify-center">
                            <Plus className="w-3.5 h-3.5 text-primary-500/40" />
                         </div>
                         <span className="text-[9px] font-black  tracking-widest text-surface-text/60">Email</span>
                      </div>
                      <span className="text-[10px] font-black tracking-widest lowercase">{branch.email}</span>
                   </div>
                 )}
              </div>

              <div className="flex gap-3 mt-8">
                 <button className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black  tracking-widest hover:bg-primary-500/5 transition-all active:scale-95 shadow-sm">
                    Configure
                 </button>
                  <button 
                    onClick={() => {
                      localStorage.setItem('currentBranch', JSON.stringify(branch));
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
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-40">
           <a href="https://www.facebook.com/JEFInvestment" target="_blank" rel="noreferrer noopener" title="Facebook Support" aria-label="Facebook Support" className="w-24 h-24 bg-surface-card border border-surface-border rounded-none flex items-center justify-center mb-6 shadow-inner">
             <Store className="w-10 h-10" />
           </a>
           <h2 className="text-xl font-black  tracking-widest italic">No branches found</h2>
           <p className="text-[10px] font-black  tracking-[0.2em] mt-2">Add your first business location to get started</p>
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card border border-surface-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-surface-border flex justify-between items-center bg-surface-bg/30">
                <h3 className="text-xl font-black tracking-tighter  italic">New branch registration</h3>
              </div>
              <form onSubmit={handleAddBranch} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black  tracking-widest text-surface-text/40 ml-1">Branch name *</label>
                      <input required className="input-field w-full" placeholder="eg. Domasi Branch" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black  tracking-widest text-surface-text/40 ml-1">Location address *</label>
                      <input required className="input-field w-full" placeholder="eg. Zomba Main Road" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black  tracking-widest text-surface-text/40 ml-1">Phone contact *</label>
                      <input required className="input-field w-full" placeholder="eg. +265..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black  tracking-widest text-surface-text/40 ml-1">Email address</label>
                      <input type="email" className="input-field w-full" placeholder="eg. branch@msikapos.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black tracking-widest text-surface-text/40 ml-1">Facebook Page (Optional)</label>
                      <input className="input-field w-full" placeholder="eg. facebook.com/msikapos" value={formData.facebook} onChange={e => setFormData({...formData, facebook: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black  tracking-widest text-surface-text/40 ml-1">Branch slogan</label>
                      <input className="input-field w-full" placeholder="eg. Excellence in Service" value={formData.slogan} onChange={e => setFormData({...formData, slogan: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black  tracking-widest text-surface-text/40 ml-1">Branch logo</label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-surface-bg border border-surface-border flex items-center justify-center overflow-hidden shrink-0">
                          {formData.logo ? (
                            <img src={formData.logo} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <Store className="w-6 h-6 text-surface-text/10" />
                          )}
                        </div>
                        <label className="btn-primary !px-4 !py-2 text-[8px] font-black tracking-widest cursor-pointer">
                          Choose image
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 mt-6">
                  <button type="submit" className="w-full btn-primary h-16 font-black tracking-widest shadow-2xl shadow-primary-500/20">Register branch office</button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full h-14 bg-surface-bg text-[10px] font-black tracking-widest hover:bg-surface-border/50 transition-all border border-surface-border rounded-2xl"
                  >
                    Close window
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
