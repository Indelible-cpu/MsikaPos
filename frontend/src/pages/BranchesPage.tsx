import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import { 
  Store, 
  MapPin, 
  Phone, 
  Plus, 
  MoreVertical, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'framer-motion';

const BranchesPage: React.FC = () => {
  const branches = useLiveQuery(() => db.branches.toArray());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const stats = [
    { label: 'Total Branches', value: (branches?.length || 0).toString(), icon: Store, color: 'text-primary-500' },
    { label: 'Main HQ', value: 'Domasi', icon: ShieldCheck, color: 'text-emerald-500' },
    { label: 'Active Region', value: 'Zomba', icon: MapPin, color: 'text-amber-500' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <header className="px-0 py-0 md:px-6 md:py-6 bg-surface-card md:border-b border-surface-border sticky top-0 z-30">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="hidden md:block">
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">Branch Management</h1>
              <p className="text-[10px] text-surface-text/40 font-black uppercase tracking-widest mt-1">Configure and manage your business outlets</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn-primary !px-6 !py-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary-500/10 w-full md:w-auto justify-center"
            >
              <Plus className="w-4 h-4" /> Add Branch
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="bg-surface-bg border border-surface-border p-3 md:p-4 rounded-2xl md:rounded-3xl shadow-inner">
                <div className={`p-1.5 rounded-lg bg-surface-card border border-surface-border w-fit mb-2 ${stat.color}`}>
                  <stat.icon className="w-3.5 h-3.5" />
                </div>
                <div className="text-base md:text-lg font-black leading-none">{stat.value}</div>
                <div className="text-[7px] md:text-[9px] font-black text-surface-text/30 uppercase tracking-widest mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="p-0 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 md:gap-6">
        {branches?.map((branch, i) => (
          <motion.div
            key={branch.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-surface-card md:border border-surface-border md:rounded-3xl overflow-hidden group hover:border-primary-500/30 transition-all border-b border-surface-border/50"
          >
            <div className="h-28 bg-gradient-to-br from-primary-600/10 to-primary-900/40 relative">
               <div className="absolute -bottom-6 left-6 w-14 h-14 bg-surface-card border-2 border-primary-500/10 rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform group-hover:border-primary-500/30">
                  <Store className="w-7 h-7 text-primary-500" />
               </div>
               <button className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white backdrop-blur-md transition-all">
                  <MoreVertical className="w-4 h-4" />
               </button>
            </div>
            
            <div className="p-6 pt-12">
              <h3 className="text-xl font-black tracking-tight mb-1">{branch.name}</h3>
              <div className="flex items-center gap-2 text-surface-text/40 mb-6">
                 <MapPin className="w-3 h-3" />
                 <span className="text-[10px] font-black uppercase tracking-widest">{branch.address || 'Location not set'}</span>
              </div>
              
              <div className="space-y-4 pt-6 border-t border-surface-border">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 bg-surface-bg border border-surface-border rounded-lg flex items-center justify-center">
                          <Phone className="w-3.5 h-3.5 text-surface-text/20" />
                       </div>
                       <span className="text-[9px] font-black uppercase tracking-widest text-surface-text/60">Support Contact</span>
                    </div>
                    <span className="text-[10px] font-black tracking-widest">{branch.phone || 'N/A'}</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 bg-surface-bg border border-surface-border rounded-lg flex items-center justify-center">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/40" />
                       </div>
                       <span className="text-[9px] font-black uppercase tracking-widest text-surface-text/60">Operational Status</span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active</span>
                 </div>
              </div>

              <div className="flex gap-3 mt-8">
                 <button className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-500/5 transition-all active:scale-95 shadow-sm">
                    Settings
                 </button>
                 <button className="p-4 bg-primary-500 text-white rounded-2xl shadow-xl shadow-primary-500/20 active:scale-95 transition-all">
                    <ExternalLink className="w-5 h-5" />
                 </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {branches?.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-40">
           <div className="w-24 h-24 bg-surface-card border border-surface-border rounded-full flex items-center justify-center mb-6 shadow-inner">
             <Store className="w-10 h-10" />
           </div>
           <h2 className="text-xl font-black uppercase tracking-widest italic">No branches found</h2>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-2">Add your first business location to get started</p>
        </div>
      )}
    </div>
  );
};

export default BranchesPage;
