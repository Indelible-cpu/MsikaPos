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
  Send
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import Modal from '../components/Modal';
import { type LocalProduct } from '../db/posDB';

interface Inquiry {
  id: number;
  status: string;
  items: string;
  notes?: string;
  customer?: { fullname: string; phone: string };
  createdAt: string;
}

const InquiriesPage: React.FC = () => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [companyPhone, setCompanyPhone] = useState('');

  // Response Modal State
  const [isResponseOpen, setIsResponseOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responsePrice, setResponsePrice] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);

  const fetchInquiries = useCallback(async () => {
    try {
      const res = await api.get('/inquiries');
      setInquiries(res.data.data);
    } catch {
      toast.error('Failed to fetch inquiries');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/public/settings');
      if (res.data?.data?.phone) {
        setCompanyPhone(res.data.data.phone);
      }
    } catch {
      console.error("Failed to fetch settings");
    }
  }, []);

  useEffect(() => {
    fetchInquiries();
    fetchSettings();
    const interval = setInterval(fetchInquiries, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchInquiries, fetchSettings]);

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      await api.put(`/inquiries/${id}`, { status: newStatus });
      toast.success(`Inquiry marked as ${newStatus}`);
      fetchInquiries();
    } catch {
      toast.error('Update failed');
    }
  };

  const handleSendResponse = async () => {
    if (!selectedInquiry || !responseText.trim()) {
      toast.error('Response message is required');
      return;
    }
    setSendingResponse(true);
    try {
      await api.put(`/inquiries/${selectedInquiry.id}`, { 
        status: 'RESPONDED',
        notes: `Response: ${responseText} | Price Quote: ${responsePrice || 'N/A'}`
      });
      toast.success('Response sent successfully');
      setIsResponseOpen(false);
      setResponseText('');
      setResponsePrice('');
      fetchInquiries();
    } catch {
      toast.error('Failed to send response');
    } finally {
      setSendingResponse(false);
    }
  };

  const openWhatsApp = (inquiry: Inquiry) => {
    const phone = companyPhone || '1234567890'; // fallback
    const items = JSON.parse(inquiry.items || '[]');
    const itemNames = items.map((i: LocalProduct) => i.name).join(', ');
    const text = `Hello! Regarding the inquiry for: ${itemNames}.`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encoded}`, '_blank');
  };

  const filtered = inquiries.filter(i => {
    const fullname = i.customer?.fullname || '';
    const username = i.customer?.user?.username || i.customer?.username || '';
    const matchesSearch = fullname.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter || 
                         (statusFilter === 'NEW' && i.status === 'PENDING');
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'NEW':
      case 'PENDING': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'VIEWED':
      case 'SEEN': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'RESPONDED': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'NEGOTIATING':
      case 'IN_PROGRESS': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'CLOSED':
      case 'COMPLETED': return 'bg-surface-text/10 text-surface-text border-surface-text/20';
      default: return 'bg-surface-text/10 text-surface-text border-surface-text/20';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all w-full">
      <div className="w-full px-0">
        <div className="p-6 md:px-12 flex flex-col md:flex-row gap-4 items-center bg-surface-card border-b border-surface-border">
          <div className="flex flex-wrap gap-2 flex-1">
            {['ALL', 'NEW', 'VIEWED', 'RESPONDED', 'NEGOTIATING', 'CLOSED'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-4 py-2 rounded-xl text-[9px] font-black tracking-widest transition-all border",
                  statusFilter === s 
                    ? "bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/20" 
                    : "bg-surface-bg border-surface-border text-surface-text/40 hover:bg-surface-border/50"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search customers..."
              className="w-full py-3 pl-12 pr-4 bg-surface-bg border border-surface-border rounded-xl outline-none focus:border-primary-500 font-bold text-xs shadow-inner transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <main className="w-full">
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
          <div className="space-y-0">
            {filtered.map(i => {
              const items = JSON.parse(i.items || '[]');
              const normalizedStatus = i.status === 'PENDING' ? 'NEW' : 
                                     i.status === 'SEEN' ? 'VIEWED' : 
                                     i.status === 'COMPLETED' ? 'CLOSED' : 
                                     i.status === 'IN_PROGRESS' ? 'NEGOTIATING' : i.status;
              
              return (
                <div key={i.id} className="bg-surface-card border-b border-surface-border px-6 md:px-12 py-8 hover:bg-primary-500/[0.02] transition-all relative group overflow-hidden flex flex-col gap-6">
                  <div className="flex flex-col lg:flex-row justify-between gap-8">
                    {/* Customer Info */}
                    <div className="flex items-start gap-6 lg:border-r border-surface-border/50 lg:pr-8 lg:w-1/3">
                      <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-500 border border-primary-500/20 shrink-0">
                        <User className="w-8 h-8" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-black tracking-tight truncate">{i.customer?.fullname || 'Unknown Customer'}</h3>
                        <p className="text-[10px] font-black text-surface-text/30 mb-3 tracking-widest uppercase">@{i.customer?.user?.username || i.customer?.username || 'user'}</p>
                        <div className={clsx("inline-flex px-3 py-1 rounded-full text-[8px] font-black tracking-widest border uppercase", getStatusColor(normalizedStatus))}>
                          {normalizedStatus}
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
                            <span className="text-xs font-black text-primary-500">MK {(item.price ?? 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      {i.notes && (
                        <div className="p-4 bg-surface-bg/50 border border-surface-border rounded-2xl">
                          <p className="text-xs text-surface-text/60 font-bold whitespace-pre-wrap">{i.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col justify-center gap-3 lg:w-48 shrink-0">
                      {(normalizedStatus === 'NEW') && (
                        <button onClick={() => updateStatus(i.id, 'VIEWED')} className="w-full py-3 bg-blue-500 text-white rounded-xl text-[9px] font-black tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all">
                          <Eye className="w-3.5 h-3.5" /> Mark as Viewed
                        </button>
                      )}
                      
                      {normalizedStatus !== 'CLOSED' && (
                        <button 
                          onClick={() => { setSelectedInquiry(i); setIsResponseOpen(true); }}
                          className="w-full py-3 bg-primary-500 text-white rounded-xl text-[9px] font-black tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all"
                        >
                          <Send className="w-3.5 h-3.5" /> Send Quote / Reply
                        </button>
                      )}

                      <button 
                        onClick={() => openWhatsApp(i)}
                        title="Contact on WhatsApp"
                        className="w-full py-3 bg-[#25D366] text-white rounded-xl flex items-center justify-center hover:scale-105 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </button>

                      {(normalizedStatus === 'RESPONDED' || normalizedStatus === 'VIEWED') && (
                        <button onClick={() => updateStatus(i.id, 'NEGOTIATING')} className="w-full py-3 bg-purple-500 text-white rounded-xl text-[9px] font-black tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all">
                          <Clock className="w-3.5 h-3.5" /> Negotiating
                        </button>
                      )}

                      {normalizedStatus !== 'CLOSED' && (
                        <button onClick={() => updateStatus(i.id, 'CLOSED')} className="w-full py-3 bg-surface-bg border border-surface-border text-surface-text/60 hover:text-surface-text rounded-xl text-[9px] font-black tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Close Inquiry
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none font-black text-[10px] uppercase">
                    {new Date(i.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Response Modal */}
      <Modal isOpen={isResponseOpen} onClose={() => setIsResponseOpen(false)} title="Send Response / Quote">
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">PRICE QUOTE (OPTIONAL)</label>
            <input 
              type="number" 
              className="w-full py-4 px-4 bg-surface-bg border border-surface-border rounded-2xl outline-none focus:border-primary-500 font-bold text-sm transition-all"
              placeholder="0.00"
              value={responsePrice}
              onChange={(e) => setResponsePrice(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">MESSAGE</label>
            <textarea 
              className="w-full py-4 px-4 bg-surface-bg border border-surface-border rounded-2xl outline-none focus:border-primary-500 font-bold text-sm transition-all min-h-[120px] resize-none"
              placeholder="Type your response here..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
            ></textarea>
          </div>
          <button 
            onClick={handleSendResponse}
            disabled={sendingResponse || !responseText.trim()}
            className="w-full py-4 bg-primary-500 text-white rounded-2xl font-black tracking-widest text-[11px] shadow-xl shadow-primary-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
          >
            {sendingResponse ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            SEND TO CUSTOMER
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default InquiriesPage;
