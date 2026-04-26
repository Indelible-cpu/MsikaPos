import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  Eye, 
  User, 
  Package, 
  Loader2, 
  Search,
  Filter
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const InquiriesPage: React.FC = () => {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchInquiries = useCallback(async () => {
    try {
      const res = await api.get('/inquiries');
      setInquiries(res.data.data);
    } catch (error) {
      toast.error('Failed to fetch inquiries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInquiries();
    const interval = setInterval(fetchInquiries, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchInquiries]);

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      await api.put(`/inquiries/${id}`, { status: newStatus });
      toast.success(`Inquiry marked as ${newStatus}`);
      fetchInquiries();
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const filtered = inquiries.filter(i => {
    const matchesSearch = i.customer?.fullname.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          i.customer?.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'SEEN': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'IN_PROGRESS': return 'bg-primary-500/10 text-primary-500 border-primary-500/20';
      case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-surface-text/10 text-surface-text border-surface-text/20';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all">
      <header className="p-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tighter italic flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-primary-500" />
              Customer Inquiries
            </h1>
            <p className="text-[10px] font-black tracking-[0.3em] text-surface-text/30 uppercase mt-1">Live Request Management</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {['ALL', 'PENDING', 'SEEN', 'IN_PROGRESS', 'COMPLETED'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-4 py-2 rounded-full text-[9px] font-black tracking-widest transition-all border",
                  statusFilter === s 
                    ? "bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/20" 
                    : "bg-surface-card border-surface-border text-surface-text/40 hover:bg-surface-border/50"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by customer name or username..."
            className="w-full py-4 pl-12 pr-4 bg-surface-card border border-surface-border rounded-2xl outline-none focus:border-primary-500 font-bold text-sm shadow-inner transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <main className="p-8 pt-4">
        {loading && inquiries.length === 0 ? (
          <div className="py-40 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            <p className="text-[10px] font-black tracking-[0.3em] text-surface-text/20 uppercase">Awaiting customer signals...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <MessageSquare className="w-16 h-16 text-surface-text/5 mb-4" />
            <p className="text-[10px] font-black tracking-widest text-surface-text/20 uppercase">No matching inquiries found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(i => {
              const items = JSON.parse(i.items || '[]');
              return (
                <div key={i.id} className="bg-surface-card border border-surface-border rounded-[2rem] p-8 hover:shadow-2xl transition-all relative group overflow-hidden">
                  <div className="flex flex-col lg:flex-row justify-between gap-8">
                    {/* Customer Info */}
                    <div className="flex items-start gap-6 lg:border-r border-surface-border/50 lg:pr-8 lg:w-1/3">
                      <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-500 border border-primary-500/20 shrink-0">
                        <User className="w-8 h-8" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-black tracking-tight truncate">{i.customer?.fullname}</h3>
                        <p className="text-[10px] font-black text-surface-text/30 mb-3 tracking-widest uppercase">@{i.customer?.username}</p>
                        <div className={clsx("inline-flex px-3 py-1 rounded-full text-[8px] font-black tracking-widest border uppercase", getStatusColor(i.status))}>
                          {i.status}
                        </div>
                      </div>
                    </div>

                    {/* Inquiry Details */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3 text-[10px] font-black tracking-[0.2em] text-surface-text/20 uppercase">
                        <Package className="w-4 h-4" />
                        Inquiry Items
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {items.map((item: any, idx: number) => (
                          <div key={idx} className="p-4 bg-surface-bg border border-surface-border rounded-2xl flex items-center justify-between">
                            <span className="font-bold text-sm">{item.name}</span>
                            <span className="text-xs font-black text-primary-500 italic">MK {item.price.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col justify-center gap-3 lg:w-48">
                      {i.status === 'PENDING' && (
                        <button onClick={() => updateStatus(i.id, 'SEEN')} className="w-full py-3 bg-blue-500 text-white rounded-xl text-[9px] font-black tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all">
                          <Eye className="w-3.5 h-3.5" /> MARK AS SEEN
                        </button>
                      )}
                      {(i.status === 'PENDING' || i.status === 'SEEN') && (
                        <button onClick={() => updateStatus(i.id, 'IN_PROGRESS')} className="w-full py-3 bg-primary-500 text-white rounded-xl text-[9px] font-black tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all">
                          <Clock className="w-3.5 h-3.5" /> START WORK
                        </button>
                      )}
                      {i.status !== 'COMPLETED' && (
                        <button onClick={() => updateStatus(i.id, 'COMPLETED')} className="w-full py-3 bg-emerald-500 text-white rounded-xl text-[9px] font-black tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all">
                          <CheckCircle2 className="w-3.5 h-3.5" /> COMPLETE
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none italic font-black text-[10px]">
                    {new Date(i.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default InquiriesPage;
