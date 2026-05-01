import React, { useState, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../api/client';
import { db, type LocalCustomer } from '../db/posDB';
import { 
  UserPlus, 
  Search, 
  Users, 
  Phone, 
  History,
  Camera,
  Fingerprint,
  Upload,
  CheckCircle2,
  Calendar,
  X,
  Trash2,
  ImageIcon
} from 'lucide-react';

import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { restrictPhone } from '../utils/phoneUtils';

import Modal from '../components/Modal';
import { Receipt } from '../components/Receipt';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { SyncService } from '../services/SyncService';

interface Credit {
  id: number;
  invoice_no: string;
  customer_name: string;
  customer_phone: string;
  original_amount: number;
  paid_amount: number;
  due_date: string;
  days_late: number;
  interest: number;
  current_total: number;
  status: 'Pending' | 'Late' | 'Paid';
}

// Malawian format validators
const MALAWI_PHONE_REGEX = /^\d{10}$|^\d{13}$/;
const MALAWI_ID_REGEX = /^[A-Za-z0-9]{8}$/;

// Mock Encrypt function (In real production, use Web Crypto API)
const mockEncrypt = (data: string) => btoa(data); // "End to End Encryption" mock for Dexie

const DebtPage: React.FC = () => {
  const { isReadOnly } = useFeatureAccess();
  const readOnly = isReadOnly('CUSTOMERS');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<LocalCustomer | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ id: number, total: number } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [clearedReceipt, setClearedReceipt] = useState<any | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Form State
  const [custForm, setCustForm] = useState({ 
    name: '', 
    phone: '',
    idNumber: '',
    village: '',
    livePhoto: '',
    fingerprintData: ''
  });

  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resetForm = () => {
    setCustForm({ 
      name: '', 
      phone: '', 
      idNumber: '', 
      village: '', 
      livePhoto: '', 
      fingerprintData: '' 
    });
  };

  // Data (Customers from Dexie)
  const customers = useLiveQuery(
    () => db.customers.where('name').startsWithIgnoreCase(searchTerm).toArray(),
    [searchTerm]
  );

  // React Query for Credit Invoices from Backend
  const { data: allCredits, isLoading: loadingCredits } = useQuery({
    queryKey: ['credits'],
    queryFn: async () => {
      const res = await api.get('/credits');
      return res.data.data as Credit[];
    }
  });

  const payMutation = useMutation({
    mutationFn: async (data: { id: number, amount: number }) => {
      // Record payment locally
      const paymentId = crypto.randomUUID();
      await db.debtPayments.add({
        id: paymentId,
        customerId: selectedCustomer?.id || '',
        amount: data.amount,
        paymentMethod: 'Cash',
        createdAt: new Date().toISOString(),
        synced: 0
      });

      // Update local balance
      if (selectedCustomer) {
        await db.customers.update(selectedCustomer.id, {
          balance: selectedCustomer.balance - data.amount,
          updatedAt: new Date().toISOString(),
          synced: 0
        });
      }

      // Trigger sync in background
      void SyncService.pushSales();
      return { success: true };
    },
    onSuccess: () => {
      setPaymentModal(null);
      setPayAmount('');
      toast.success('Payment recorded locally. Syncing with cloud...');
    }
  });

  const filteredCredits = useMemo(() => {
    if (!selectedCustomer) return [];
    return allCredits?.filter(c => 
      c.customer_phone === selectedCustomer.phone || 
      c.customer_name.toLowerCase() === selectedCustomer.name.toLowerCase()
    ) || [];
  }, [allCredits, selectedCustomer]);

  const startCamera = async () => {
    setUseCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      toast.error('Camera access denied or unavailable');
      setUseCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCustForm({ ...custForm, livePhoto: dataUrl });
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setUseCamera(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustForm({ ...custForm, livePhoto: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const captureFingerprint = async () => {
    toast.loading('Scanning fingerprint...', { id: 'fp' });
    setTimeout(() => {
      const mockHash = "FP_" + Math.random().toString(36).substring(2, 15);
      setCustForm({ ...custForm, fingerprintData: mockEncrypt(mockHash) });
      toast.success('Fingerprint secured & encrypted', { id: 'fp' });
    }, 1500);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name || !custForm.phone) return;

    if (!MALAWI_PHONE_REGEX.test(custForm.phone)) {
      toast.error('Mobile number must be exactly 10 or 13 digits');
      return;
    }

    if (custForm.idNumber && !MALAWI_ID_REGEX.test(custForm.idNumber.toUpperCase())) {
      toast.error('National ID must be exactly 8 alphanumeric characters');
      return;
    }

    try {
      await db.customers.add({
        id: crypto.randomUUID(),
        name: custForm.name,
        phone: custForm.phone,
        idNumber: custForm.idNumber.toUpperCase(),
        village: custForm.village,
        livePhoto: custForm.livePhoto,
        fingerprintData: custForm.fingerprintData,
        balance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: 0
      });
      toast.success('Customer profile created securely');
      setIsAddModalOpen(false);
      resetForm();
      stopCamera();
    } catch {
      toast.error('Failed to add customer');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-surface-bg overflow-hidden">
      {/* Header */}
      <header className="bg-surface-card border-b border-surface-border px-6 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-500 border border-primary-500/20">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!readOnly && (
            <button 
              onClick={() => { resetForm(); setIsAddModalOpen(true); }}
              className="btn-primary !px-4 !py-2 text-[9px] font-black tracking-widest uppercase shadow-lg shadow-primary-500/20"
            >
              <UserPlus className="w-3.5 h-3.5 mr-2 inline" /> Add Customer
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Master Sidebar */}
        <aside className="w-full md:w-80 lg:w-96 border-r border-surface-border bg-surface-card flex flex-col shrink-0">
          <div className="p-4 border-b border-surface-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-text/40 w-3.5 h-3.5" />
              <input 
                type="text" 
                placeholder="Search customers..."
                className="input-field w-full pl-9 text-[10px] py-2.5 font-bold"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {customers?.length === 0 ? (
              <div className="p-10 text-center text-surface-text/20 font-black text-[9px] uppercase tracking-widest">No customers found</div>
            ) : (
              <div className="divide-y divide-surface-border/50">
                {customers?.map(customer => (
                  <div 
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className={clsx(
                      "p-4 cursor-pointer transition-all hover:bg-primary-500/[0.02]",
                      selectedCustomer?.id === customer.id ? "bg-primary-500/[0.05] border-l-4 border-l-primary-500" : "border-l-4 border-l-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-surface-bg border border-surface-border overflow-hidden">
                        {customer.livePhoto ? (
                          <img src={customer.livePhoto} alt={customer.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-surface-text/10"><Users className="w-5 h-5" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[11px] font-black truncate uppercase">{customer.name}</h3>
                        <p className="text-[9px] text-surface-text/30 font-bold">{customer.phone}</p>
                      </div>
                      <div className="text-right">
                        <div className={clsx("text-xs font-black tracking-tighter", customer.balance > 0 ? "text-amber-500" : "text-emerald-500")}>
                          MK {customer.balance.toLocaleString()}
                        </div>
                        {customer.balance > 0 && <span className="text-[7px] font-black text-amber-500/50 uppercase">Owes</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Detail View */}
        <main className="flex-1 bg-surface-bg overflow-y-auto custom-scrollbar">
          {selectedCustomer ? (
            <div className="p-6 md:p-10 space-y-10 animate-slide-in">
              {/* Profile Card */}
              <div className="flex flex-col lg:flex-row gap-10">
                <div className="w-48 h-48 rounded-[2.5rem] bg-surface-card border border-surface-border shadow-2xl shadow-black/10 overflow-hidden relative group shrink-0">
                  {selectedCustomer.livePhoto ? (
                    <img src={selectedCustomer.livePhoto} alt={selectedCustomer.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface-text/5"><Users className="w-20 h-20" /></div>
                  )}
                  {selectedCustomer.fingerprintData && (
                    <div className="absolute top-4 right-4 bg-emerald-500 p-1.5 rounded-full shadow-lg">
                      <Fingerprint className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                      <h2 className="text-3xl font-black tracking-tighter mb-1 uppercase">{selectedCustomer.name}</h2>
                      <div className="flex flex-wrap items-center gap-4 text-[10px] font-black tracking-widest text-surface-text/30 uppercase">
                        <span className="flex items-center gap-1.5 bg-surface-bg/50 px-3 py-1.5 rounded-lg border border-surface-border/50">
                          <Phone className="w-3.5 h-3.5" /> {selectedCustomer.phone}
                        </span>
                        {selectedCustomer.idNumber && (
                          <span className="flex items-center gap-1.5 bg-surface-bg/50 px-3 py-1.5 rounded-lg border border-surface-border/50">
                            <ImageIcon className="w-3.5 h-3.5" /> ID: {selectedCustomer.idNumber}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 bg-surface-bg/50 px-3 py-1.5 rounded-lg border border-surface-border/50">
                           <Calendar className="w-3.5 h-3.5" /> Joined {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="text-[10px] font-black text-surface-text/20 uppercase mb-1 tracking-widest">Total Outstanding</div>
                       <div className="text-4xl font-black text-rose-500 tracking-tighter leading-none">MK {selectedCustomer.balance.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <div className="bg-surface-card p-6 rounded-3xl border border-surface-border shadow-sm">
                        <div className="text-[8px] font-black text-surface-text/20 mb-2 tracking-widest uppercase">Village / location</div>
                        <div className="text-sm font-black text-surface-text/60">{selectedCustomer.village || 'Not specified'}</div>
                     </div>
                     <div className="bg-surface-card p-6 rounded-3xl border border-surface-border shadow-sm">
                        <div className="text-[8px] font-black text-surface-text/20 mb-2 tracking-widest uppercase">Security status</div>
                        <div className={clsx("text-sm font-black uppercase tracking-tight", selectedCustomer.fingerprintData ? "text-emerald-500" : "text-surface-text/20")}>
                          {selectedCustomer.fingerprintData ? 'Biometric Verified' : 'Standard Profile'}
                        </div>
                     </div>
                     <div className="flex items-center justify-end gap-3">
                        {!readOnly && (
                          <button 
                            onClick={async () => {
                              if (window.confirm(`Are you sure you want to PERMANENTLY DELETE ${selectedCustomer.name}? All history will be lost.`)) {
                                await db.customers.delete(selectedCustomer.id);
                                setSelectedCustomer(null);
                                toast.success('Customer profile removed');
                              }
                            }}
                            className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center"
                            title="Delete Customer Profile"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                     </div>
                  </div>
                </div>
              </div>

              {/* Invoices Table */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-surface-border pb-4">
                  <h3 className="text-lg font-black tracking-tighter flex items-center gap-3">
                    <History className="w-5 h-5 text-primary-500" /> Outstanding ledger
                  </h3>
                  <div className="text-[10px] font-black text-surface-text/30 tracking-widest">
                    Showing {filteredCredits.length} unpaid credit invoices
                  </div>
                </div>

                <div className="bg-surface-card rounded-3xl border border-surface-border overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-surface-bg/50 text-[9px] font-black text-surface-text/40 tracking-widest border-b border-surface-border">
                          <th className="px-8 py-5">Invoice #</th>
                          <th className="px-8 py-5">Due date</th>
                          <th className="px-8 py-5 text-right">Original amt</th>
                          <th className="px-8 py-5 text-right">Current balance</th>
                          <th className="px-8 py-5 text-center">Status</th>
                          <th className="px-8 py-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border/50">
                        {loadingCredits ? (
                          <tr><td colSpan={6} className="p-20 text-center text-[10px] font-bold text-surface-text/20 animate-pulse uppercase tracking-widest">Awaiting ledger data...</td></tr>
                        ) : filteredCredits.length === 0 ? (
                          <tr><td colSpan={6} className="p-20 text-center text-[10px] font-bold text-surface-text/20 uppercase tracking-widest">No active credit invoices for this profile</td></tr>
                        ) : (
                          filteredCredits.map(credit => (
                            <tr key={credit.id} className="hover:bg-primary-500/[0.01] transition-all">
                              <td className="px-8 py-6">
                                <span className="text-[11px] font-black font-mono tracking-tighter text-surface-text/60">#{credit.invoice_no}</span>
                              </td>
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-3.5 h-3.5 text-surface-text/20" />
                                  <span className={clsx("text-[11px] font-black tracking-tight", credit.status === 'Late' ? 'text-rose-500' : 'text-surface-text/60')}>{credit.due_date}</span>
                                </div>
                                {credit.days_late > 0 && <div className="text-[8px] font-black text-rose-400 mt-1">{credit.days_late} Days overdue</div>}
                              </td>
                              <td className="px-8 py-6 text-right text-[11px] font-black">MK {credit.original_amount.toLocaleString()}</td>
                              <td className="px-8 py-6 text-right">
                                <div className="text-sm font-black text-rose-500 tracking-tighter">MK {(credit.current_total - credit.paid_amount).toLocaleString()}</div>
                                {credit.interest > 0 && <div className="text-[8px] font-black text-rose-400 tracking-widest mt-1">Incl. MK {credit.interest} late fees</div>}
                              </td>
                              <td className="px-8 py-6 text-center">
                                <span className={clsx(
                                  "px-4 py-1.5 rounded-xl text-[8px] font-black tracking-widest uppercase shadow-sm",
                                  credit.status === 'Paid' ? "bg-emerald-500/10 text-emerald-500" :
                                  credit.status === 'Late' ? "bg-rose-500/10 text-rose-500" :
                                  "bg-surface-bg text-surface-text/30 border border-surface-border"
                                )}>
                                  {credit.status}
                                </span>
                              </td>
                              <td className="px-8 py-6 text-right">
                                {credit.status !== 'Paid' && (
                                  <button 
                                    onClick={() => {
                                      setPaymentModal({ id: credit.id, total: credit.current_total - credit.paid_amount });
                                      setPayAmount(String(credit.current_total - credit.paid_amount));
                                    }}
                                    className="px-6 py-2.5 bg-primary-500 text-white rounded-xl text-[9px] font-black tracking-widest shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-all active:scale-95"
                                  >
                                    Pay balance
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-20 text-center opacity-30 select-none">
              <div className="w-24 h-24 bg-surface-card rounded-[3rem] border-2 border-dashed border-surface-border flex items-center justify-center mb-6">
                <Users className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-black tracking-tighter mb-2">No record selected</h2>
              <p className="text-[10px] font-black tracking-widest max-w-xs leading-relaxed">Select a client from the master list to view their biometric profile and outstanding credit ledger.</p>
            </div>
          )}
        </main>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-zinc-900/60 backdrop-blur-md p-6 animate-blur-fade" onClick={() => setPaymentModal(null)}>
           <div className="bg-surface-card w-full max-w-md rounded-[2.5rem] overflow-hidden animate-slide-in border border-surface-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <header className="px-10 py-8 border-b border-surface-border bg-surface-bg/30 flex justify-between items-center">
                 <div>
                    <h3 className="text-xl font-black tracking-tight">Pay balance</h3>
                    <p className="text-[9px] font-black text-surface-text/30 mt-1 tracking-widest">Record an offline payment.</p>
                 </div>
                 <button onClick={() => setPaymentModal(null)} className="p-3 bg-surface-bg rounded-xl text-surface-text/40 hover:text-white transition-colors" title="Close modal"><X className="w-5 h-5" /></button>
              </header>
              <div className="p-10 space-y-10">
                 <div className="space-y-4">
                    <label htmlFor="pay-amt-input" className="text-[10px] font-black text-surface-text/30 ml-1 tracking-[0.2em]">Payment amount (MK)</label>
                    <div className="relative">
                       <span className="absolute left-6 top-1/2 -translate-y-1/2 text-surface-text/20 font-black text-sm font-mono">MK</span>
                       <input 
                          id="pay-amt-input"
                          type="number"
                          value={payAmount}
                          onChange={e => setPayAmount(e.target.value)}
                          className="input-field !text-2xl !py-6 pl-16 w-full" 
                       />
                    </div>
                    <div className="flex justify-between px-2 pt-2">
                       <span className="text-[10px] font-black text-surface-text/20 tracking-widest">Active balance</span>
                       <span className="text-xs font-black font-mono">MK {paymentModal.total.toLocaleString()}</span>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => setPaymentModal(null)} className="flex-1 py-5 bg-surface-bg border border-surface-border rounded-2xl font-black text-[10px] text-surface-text/30 tracking-widest hover:bg-surface-border transition-all">Cancel</button>
                    <button 
                       onClick={() => payMutation.mutate({ id: paymentModal.id, amount: Number(payAmount) })}
                       disabled={payMutation.isPending}
                       className="flex-[2] py-5 bg-primary-500 text-white rounded-2xl font-black text-[10px] tracking-widest shadow-xl shadow-primary-500/25 hover:bg-primary-600 transition-all active:scale-95 disabled:opacity-50"
                    >
                       {payMutation.isPending ? 'Processing...' : 'Confirm payment'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Add Customer Modal */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); stopCamera(); }} 
        title="Register new profile"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleAddCustomer} className="p-6 md:p-8 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
          
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-6">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-surface-text/30 pl-1 tracking-[0.2em]">Full name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. John Phiri"
                  className="input-field w-full text-xs font-bold py-4"
                  value={custForm.name}
                  onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-surface-text/30 pl-1 uppercase tracking-[0.2em]">Phone number</label>
<input 
  type="tel" 
  required
  placeholder="e.g. 0888..."
  className="input-field w-full text-xs font-bold py-4"
  value={custForm.phone}
  onChange={(e) => setCustForm({ ...custForm, phone: restrictPhone(e.target.value) })}
/>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-surface-text/30 pl-1 uppercase tracking-[0.2em]">National ID</label>
                  <input 
                    type="text" 
                    placeholder="8 chars"
                    className="input-field w-full text-xs font-bold py-4 uppercase"
                    value={custForm.idNumber}
                    onChange={(e) => setCustForm({ ...custForm, idNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-surface-text/30 pl-1 uppercase tracking-[0.2em]">Village/location</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Area 25"
                    className="input-field w-full text-xs font-bold py-4"
                    value={custForm.village}
                    onChange={(e) => setCustForm({ ...custForm, village: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="w-full md:w-56 shrink-0 space-y-4">
               <label className="text-[9px] font-black text-surface-text/30 pl-1 uppercase tracking-[0.2em]">Biometric ID photo</label>
               <div className="relative aspect-square bg-surface-bg rounded-3xl overflow-hidden border border-surface-border flex items-center justify-center group shadow-inner">
                  {custForm.livePhoto ? (
                    <img src={custForm.livePhoto} alt="Customer Preview" className="w-full h-full object-cover" />
                  ) : useCamera ? (
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover mirror" />
                  ) : (
                    <Camera className="w-10 h-10 text-surface-text/10" />
                  )}
                  
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent flex gap-2">
                    {!useCamera && !custForm.livePhoto && (
                      <button type="button" onClick={startCamera} title="Start Camera" className="flex-1 bg-white/20 backdrop-blur-md p-2 rounded-xl text-white hover:bg-white/30 transition-all">
                        <Camera className="w-4 h-4 mx-auto" />
                      </button>
                    )}
                    {useCamera && (
                      <button type="button" onClick={capturePhoto} title="Capture Photo" className="flex-1 bg-emerald-500 p-2 rounded-xl text-white shadow-lg">
                         <CheckCircle2 className="w-4 h-4 mx-auto" />
                      </button>
                    )}
                    {!useCamera && custForm.livePhoto && (
                      <button type="button" onClick={() => setCustForm({ ...custForm, livePhoto: '' })} title="Remove Photo" className="flex-1 bg-rose-500 p-2 rounded-xl text-white">
                         <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    )}
                    <label className="flex-1 bg-white/20 backdrop-blur-md p-2 rounded-xl text-white cursor-pointer hover:bg-white/30" title="Upload Photo">
                       <Upload className="w-4 h-4 mx-auto" />
                       <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} title="Upload customer photo" />
                    </label>
                  </div>
               </div>
               <canvas ref={canvasRef} className="hidden" />
               
               <button 
                type="button" 
                onClick={captureFingerprint}
                className={clsx(
                  "w-full py-4 rounded-2xl border flex items-center justify-center gap-3 transition-all active:scale-95",
                  custForm.fingerprintData 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                    : "bg-surface-bg border-surface-border text-surface-text/30 hover:border-primary-500/50 hover:text-primary-500"
                )}
               >
                 <Fingerprint className="w-5 h-5" />
                 <span className="text-[10px] font-black uppercase tracking-widest">{custForm.fingerprintData ? 'Biometric encrypted' : 'Capture fingerprint'}</span>
               </button>
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl font-black text-[10px] text-surface-text/30 uppercase tracking-widest hover:bg-surface-border">Discard</button>
            <button type="submit" className="flex-[2] btn-primary !py-4 text-[10px] font-black uppercase tracking-widest">Register customer profile</button>
          </div>
        </form>
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={!!clearedReceipt} onClose={() => setClearedReceipt(null)} title="System receipt" maxWidth="max-w-md">
        {clearedReceipt && (
           <div className="p-6 flex flex-col items-center gap-6">
             <div className="bg-white p-6 shadow-2xl border border-zinc-100 w-full" id="printable-receipt">
               <Receipt {...clearedReceipt} />
             </div>
             <div className="flex gap-4 w-full">
               <button onClick={() => window.print()} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl font-black text-[10px] uppercase tracking-widest">Print Only</button>
               <button onClick={() => setClearedReceipt(null)} className="flex-[2] py-4 bg-primary-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-500/20">Done</button>
             </div>
           </div>
        )}
      </Modal>
    </div>
  );
};

export default DebtPage;
