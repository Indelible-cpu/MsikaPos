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
  Send,
  Phone
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import Modal from '../components/Modal';

const InquiriesPage: React.FC = () => {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [companyPhone, setCompanyPhone] = useState('');

  // Response Modal State
  const [isResponseOpen, setIsResponseOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [responseText, setResponseText] = useState('');
  const [responsePrice, setResponsePrice] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);

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

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/public/settings');
      if (res.data?.data?.phone) {
        setCompanyPhone(res.data.data.phone);
      }
    } catch (error) {
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
    } catch (error) {
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
      // Assuming a generic update to the inquiry, maybe storing response in a new field or just updating status.
      // We will append to notes or add a response field. For now, we'll update status to RESPONDED.
      // If the backend supports a "response" or "quotePrice" field we can pass it.
      await api.put(`/inquiries/${selectedInquiry.id}`, { 
        status: 'RESPONDED',
        notes: `Response: ${responseText} | Price Quote: ${responsePrice || 'N/A'}`
      });
      toast.success('Response sent successfully');
      setIsResponseOpen(false);
      setResponseText('');
      setResponsePrice('');
      fetchInquiries();
    } catch (error) {
      toast.error('Failed to send response');
    } finally {
      setSendingResponse(false);
    }
  };

  const openWhatsApp = (inquiry: any) => {
    const phone = companyPhone || '1234567890'; // fallback
    const items = JSON.parse(inquiry.items || '[]');
    const itemNames = items.map((i: any) => i.name).join(', ');
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
                         (statusFilter === 'NEW' && i.status === 'PENDING'); // Handle legacy PENDING as NEW
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
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all">
      <header className="p-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tighter italic flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-primary-500" />
              Customer Inquiries
            </h1>
            <p className="text-[10px] font-black tracking-[0.3em] text-surface-text/30 italic mt-1">Live Request Management</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {['ALL', 'NEW', 'VIEWED', 'RESPONDED', 'NEGOTIATING', 'CLOSED'].map(s => (
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
            <p className="text-[10px] font-black tracking-[0.3em] text-surface-text/20 italic">Awaiting customer signals...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <MessageSquare className="w-16 h-16 text-surface-text/5 mb-4" />
            <p className="text-[10px] font-black tracking-widest text-surface-text/20 italic">No matching inquiries found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(i => {
              const items = JSON.parse(i.items || '[]');
              const normalizedStatus = i.status === 'PENDING' ? 'NEW' : 
                                     i.status === 'SEEN' ? 'VIEWED' : 
                                     i.status === 'COMPLETED' ? 'CLOSED' : 
                                     i.status === 'IN_PROGRESS' ? 'NEGOTIATING' : i.status;
              
              return (
                <div key={i.id} className="bg-surface-card border border-surface-border rounded-[2rem] p-8 hover:shadow-2xl transition-all relative group overflow-hidden flex flex-col gap-6">
                  <div className="flex flex-col lg:flex-row justify-between gap-8">
                    {/* Customer Info */}
                    <div className="flex items-start gap-6 lg:border-r border-surface-border/50 lg:pr-8 lg:w-1/3">
                      <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-500 border border-primary-500/20 shrink-0">
                        <User className="w-8 h-8" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-black tracking-tight truncate">{i.customer?.fullname || 'Unknown Customer'}</h3>
                        <p className="text-[10px] font-black text-surface-text/30 mb-3 tracking-widest italic">@{i.customer?.user?.username || i.customer?.username || 'user'}</p>
                        <div className={clsx("inline-flex px-3 py-1 rounded-full text-[8px] font-black tracking-widest border italic", getStatusColor(normalizedStatus))}>
                          {normalizedStatus}
                        </div>
                      </div>
                    </div>

                    {/* Inquiry Details */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3 text-[10px] font-black tracking-[0.2em] text-surface-text/20 italic">
                        <Package className="w-4 h-4" />
                        Inquiry Items
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {items.map((item: any, idx: number) => (
                          <div key={idx} className="p-4 bg-surface-bg border border-surface-border rounded-2xl flex items-center justify-between">
                            <span className="font-bold text-sm">{item.name}</span>
                            <span className="text-xs font-black text-primary-500 italic">MK {(item.price ?? 0).toLocaleString()}</span>
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
                        className="w-full py-3 bg-[#25D366] text-white rounded-xl text-[9px] font-black tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all"
                      >
                        <Phone className="w-3.5 h-3.5" /> WhatsApp
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
                  
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none italic font-black text-[10px]">
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
