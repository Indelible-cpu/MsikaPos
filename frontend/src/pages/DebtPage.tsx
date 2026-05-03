import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../api/client';
import { db, type LocalCustomer, type LocalProduct, type LocalDebtPayment } from '../db/posDB';
import { useLocation } from 'react-router-dom';
import { 
  Search, 
  Users, 
  History as HistoryIcon,
  Camera,
  Fingerprint,
  Upload,
  CheckCircle2,
  Calendar,
  Trash2,
  Save,
  RotateCcw,
  ArrowLeft
} from 'lucide-react';

import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { restrictPhone } from '../utils/phoneUtils';

import Modal from '../components/Modal';
import { Receipt } from '../components/Receipt';
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

interface ReceiptData {
  items: { product: LocalProduct; quantity: number }[];
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  invoiceNo: string;
  date: string;
  mode: string;
  customerName?: string;
  paid: number;
  change: number;
}

const MALAWI_PHONE_REGEX = /^\d{10}$|^\d{13}$/;

const mockEncrypt = (data: string) => btoa(data);

const DebtPage: React.FC = () => {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<LocalCustomer | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ id: number, total: number } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [clearedReceipt, setClearedReceipt] = useState<ReceiptData | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [signature, setSignature] = useState<string | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);

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
    setCustForm({ name: '', phone: '', idNumber: '', village: '', livePhoto: '', fingerprintData: '' });
  };

  // Handle POS Redirect
  useEffect(() => {
    if (location.state?.creditSale) {
      resetForm();
      const timer = setTimeout(() => setIsAddModalOpen(true), 0);
      // Clean up state so it doesn't re-trigger on refresh
      window.history.replaceState({}, document.title);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const customers = useLiveQuery(
    async () => {
      const all = await db.customers.where('name').startsWithIgnoreCase(searchTerm).toArray();
      return all.filter(c => c.balance > 0);
    },
    [searchTerm]
  );

  const payments = useLiveQuery<LocalDebtPayment[]>(
    () => selectedCustomer ? db.debtPayments.where('customerId').equals(selectedCustomer.id).reverse().toArray() : Promise.resolve([] as LocalDebtPayment[]),
    [selectedCustomer]
  );

  const { data: allCredits, isLoading: loadingCredits } = useQuery({
    queryKey: ['credits'],
    queryFn: async () => {
      const res = await api.get('/credits');
      return res.data.data as Credit[];
    }
  });

  const payMutation = useMutation({
    mutationFn: async (data: { id: number, amount: number }) => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const cashierName = user.fullname || 'Unknown Cashier';
      const paymentId = crypto.randomUUID();
      
      if (!selectedCustomer) throw new Error('No customer selected');
      
      const newTotalPaid = (selectedCustomer.totalPaidAmount || 0) + data.amount;
      const newBalance = selectedCustomer.balance - data.amount;

      await db.debtPayments.add({
        id: paymentId,
        customerId: selectedCustomer.id,
        amount: data.amount,
        paymentMethod: 'Cash',
        cashierName,
        signature: signature || undefined,
        createdAt: new Date().toISOString(),
        synced: 0
      });

      await db.customers.update(selectedCustomer.id, {
        balance: newBalance,
        totalPaidAmount: newTotalPaid,
        updatedAt: new Date().toISOString(),
        synced: 0
      });

      void SyncService.pushSales();
      
      return { 
        success: true,
        receipt: {
          items: [{ product: { name: 'DEBT REPAYMENT', sellPrice: data.amount } as unknown as LocalProduct, quantity: 1 }],
          total: data.amount,
          subtotal: data.amount,
          tax: 0,
          discount: 0,
          invoiceNo: `REPAY-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          date: new Date().toISOString(),
          mode: 'Cash',
          customerName: selectedCustomer.name,
          paid: data.amount,
          change: 0,
          signature: signature || undefined
        }
      };
    },
    onSuccess: (data: { success: boolean; receipt: ReceiptData }) => {
      setPaymentModal(null);
      setPayAmount('');
      if (data.receipt) {
        setClearedReceipt(data.receipt);
        setTimeout(() => window.print(), 1000);
      }
      toast.success('Payment recorded! Printing receipt...');
      if (selectedCustomer && (selectedCustomer.balance - Number(payAmount)) <= 0) {
        setSelectedCustomer(null);
      }
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
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      toast.error('Camera access denied');
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
        setCustForm({ ...custForm, livePhoto: canvasRef.current.toDataURL('image/jpeg') });
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setUseCamera(false);
  };

  const startSignature = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y);
    const draw = (me: MouseEvent | TouchEvent) => {
      const mx = ('touches' in me) ? me.touches[0].clientX - rect.left : (me as MouseEvent).clientX - rect.left;
      const my = ('touches' in me) ? me.touches[0].clientY - rect.top : (me as MouseEvent).clientY - rect.top;
      ctx.lineTo(mx, my); ctx.stroke();
    };
    const stop = () => {
      window.removeEventListener('mousemove', draw as EventListener); window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', draw as EventListener); window.removeEventListener('touchend', stop);
      setSignature(canvas.toDataURL());
    };
    window.addEventListener('mousemove', draw as EventListener); window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', draw as EventListener, { passive: false }); window.addEventListener('touchend', stop);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustForm({ ...custForm, livePhoto: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const captureFingerprint = async () => {
    toast.loading('Scanning...', { id: 'fp' });
    setTimeout(() => {
      setCustForm({ ...custForm, fingerprintData: mockEncrypt("FP_" + Math.random().toString(36).substring(2)) });
      toast.success('Fingerprint captured', { id: 'fp' });
    }, 1000);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!MALAWI_PHONE_REGEX.test(custForm.phone)) return toast.error('Invalid Malawian phone format (10 or 13 digits)');
    if (!custForm.name || !custForm.village || !custForm.idNumber) return toast.error('Please fill all mandatory fields');
    
    try {
      const customerId = crypto.randomUUID();
      const creditSale = location.state?.creditSale;
      
      const newCustomer: LocalCustomer = {
        ...custForm,
        id: customerId,
        idNumber: custForm.idNumber.toUpperCase(),
        balance: creditSale ? creditSale.total : 0,
        totalCreditAmount: creditSale ? creditSale.total : 0,
        totalPaidAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: 0
      };

      await db.customers.add(newCustomer);

      if (creditSale) {
        // Log the initial sale
        const saleData = {
          ...creditSale,
          id: crypto.randomUUID(),
          customerId,
          paymentMode: 'Credit',
          synced: 0
        };
        await db.salesQueue.add(saleData);
        
        // Update product quantities
        for (const item of creditSale.items) {
          const product = await db.products.get(item.product.id);
          if (product && !product.isService) {
            await db.products.update(item.product.id, {
              quantity: Math.max(0, product.quantity - item.quantity),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      toast.success(creditSale ? 'Credit sale registered successfully' : 'Customer profile registered');
      setIsAddModalOpen(false);
      resetForm();
      
      if (creditSale) {
        setSelectedCustomer(newCustomer);
      }
    } catch (err) { 
      console.error(err);
      toast.error('Registration failed'); 
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (!MALAWI_PHONE_REGEX.test(custForm.phone)) return toast.error('Invalid phone format');
    
    try {
      await db.customers.update(selectedCustomer.id, {
        ...custForm,
        idNumber: custForm.idNumber.toUpperCase(),
        updatedAt: new Date().toISOString(),
        synced: 0
      });
      
      const updated = await db.customers.get(selectedCustomer.id);
      if (updated) setSelectedCustomer(updated);
      
      toast.success('Profile updated');
      setIsEditing(false);
    } catch { toast.error('Update failed'); }
  };

  return (
    <div className="flex flex-col w-full bg-background transition-all pb-24 md:pb-0 relative">
      <div className="fixed inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />
      <header className="glass-panel border-b border-border/50 px-6 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-black uppercase tracking-widest text-primary">Credit Center</h1>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden relative">
        <aside className={clsx(
          "w-full md:w-80 lg:w-96 border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col shrink-0 transition-transform duration-300",
          selectedCustomer && "hidden md:flex"
        )}>
          <div className="p-4 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
              <input title="Search Customers" aria-label="Search Customers" placeholder="Search names..." className="input-field w-full pl-9 text-[10px] py-2.5 font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar stagger-children">
            {customers?.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground/20 font-black text-[9px] uppercase">No active credit accounts</div>
            ) : (
              <div className="divide-y divide-border/30">
                {customers?.map(c => (
                  <div key={c.id} className={clsx("p-4 flex items-center justify-between transition-all border-l-4 btn-press cursor-pointer", selectedCustomer?.id === c.id ? "bg-primary/5 border-l-primary" : "border-l-transparent hover:bg-muted/5")}>
                    <div className="flex-1 min-w-0"><h3 className="text-[12px] font-black uppercase truncate">{c.name}</h3></div>
                    <button type="button" title={`View profile for ${c.name}`} aria-label={`View profile for ${c.name}`} onClick={() => { setSelectedCustomer(c); setIsProfileModalOpen(true); }} className="px-4 py-1.5 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase tracking-widest btn-press">View Profile</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className={clsx(
          "flex-1 bg-background overflow-y-auto custom-scrollbar transition-all duration-300 relative",
          !selectedCustomer && "hidden md:block"
        )}>
          {selectedCustomer ? (
            <div className="p-4 md:p-10 space-y-6 md:space-y-10 animate-slide-in stagger-children">
              {/* Mobile Back Button */}
              <button 
                type="button" 
                onClick={() => setSelectedCustomer(null)}
                className="md:hidden flex items-center gap-2 mb-4 text-primary font-black text-[10px] uppercase tracking-widest btn-press"
              >
                <ArrowLeft className="w-4 h-4" /> Back to list
              </button>

              <div className="glass-panel p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-border/50 shadow-xl flex flex-col xl:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-6 w-full xl:w-auto">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary shrink-0"><HistoryIcon className="w-8 h-8 md:w-10 md:h-10" /></div>
                  <div>
                    <h2 className="text-xl md:text-3xl font-black tracking-tighter uppercase truncate max-w-[200px] md:max-w-none">{selectedCustomer.name}</h2>
                    <p className="text-[8px] md:text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase mt-1">Outstanding Ledger Account</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 md:gap-12 text-right w-full xl:w-auto border-t xl:border-t-0 border-border/50 pt-6 xl:pt-0">
                  <div>
                    <div className="text-[8px] md:text-[9px] font-black text-muted-foreground uppercase mb-1 tracking-widest">Total Credit</div>
                    <div className="text-sm md:text-xl font-black tracking-tighter text-foreground">MK {(selectedCustomer.totalCreditAmount || selectedCustomer.balance).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[8px] md:text-[9px] font-black text-muted-foreground uppercase mb-1 tracking-widest">Total Paid</div>
                    <div className="text-sm md:text-xl font-black text-success tracking-tighter">MK {(selectedCustomer.totalPaidAmount || 0).toLocaleString()}</div>
                  </div>
                  <div className="col-span-2 lg:col-span-1 border-t lg:border-t-0 border-border/50 pt-4 lg:pt-0">
                    <div className="text-[8px] md:text-[9px] font-black text-destructive/40 uppercase mb-1 tracking-widest">Balance Due</div>
                    <div className="text-3xl md:text-5xl font-black text-destructive tracking-tighter leading-none">MK {selectedCustomer.balance.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-surface-border pb-4">
                  <h3 className="text-lg font-black tracking-tighter flex items-center gap-3"><HistoryIcon className="w-5 h-5 text-primary-500" /> Ledger Details</h3>
                  <button type="button" title="Open Full Profile" aria-label="Open Full Profile" onClick={() => setIsProfileModalOpen(true)} className="text-[10px] font-black text-primary-500 uppercase tracking-widest underline">Re-verify Profile</button>
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
                          <th className="px-8 py-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border/50">
                        {loadingCredits ? (
                          <tr><td colSpan={5} className="p-20 text-center text-[10px] font-bold text-surface-text/20 animate-pulse">Awaiting data...</td></tr>
                        ) : filteredCredits.length === 0 ? (
                          <tr><td colSpan={5} className="p-20 text-center text-[10px] font-bold text-surface-text/20 uppercase">No active credit invoices</td></tr>
                        ) : (
                          filteredCredits.map(credit => (
                            <tr key={credit.id} className="hover:bg-primary-500/[0.01]">
                              <td className="px-8 py-6"><span className="text-[11px] font-black font-mono">#{credit.invoice_no}</span></td>
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 opacity-20" /><span className="text-[11px] font-black">{credit.due_date}</span></div>
                              </td>
                              <td className="px-8 py-6 text-right text-[11px] font-black">MK {credit.original_amount.toLocaleString()}</td>
                              <td className="px-8 py-6 text-right"><div className="text-sm font-black text-rose-500">MK {(credit.current_total - credit.paid_amount).toLocaleString()}</div></td>
                              <td className="px-8 py-6 text-right">
                                {credit.status !== 'Paid' && (
                                  <button type="button" title="Pay This Invoice" aria-label="Pay This Invoice" onClick={() => { setPaymentModal({ id: credit.id, total: credit.current_total - credit.paid_amount }); setPayAmount(String(credit.current_total - credit.paid_amount)); }} className="px-6 py-2.5 bg-primary-500 text-white rounded-xl text-[9px] font-black uppercase">Pay balance</button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-6 pt-10">
                  <h3 className="text-lg font-black tracking-tighter flex items-center gap-3"><HistoryIcon className="w-5 h-5 text-emerald-500" /> Repayment History</h3>
                  <div className="bg-surface-card rounded-3xl border border-surface-border overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr className="bg-surface-bg/50 text-[9px] font-black text-surface-text/40 tracking-widest border-b border-surface-border">
                            <th className="px-8 py-5">Date</th>
                            <th className="px-8 py-5">Cashier</th>
                            <th className="px-8 py-5 text-right">Amount Paid</th>
                            <th className="px-8 py-5 text-right">Method</th>
                            <th className="px-8 py-5 text-center">Verification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border/50">
                          {payments?.length === 0 ? (
                            <tr><td colSpan={5} className="p-10 text-center text-[10px] font-bold text-surface-text/20 uppercase">No payment history</td></tr>
                          ) : (
                            payments?.map(p => (
                              <tr key={p.id} className="hover:bg-emerald-500/[0.01]">
                                <td className="px-8 py-5"><span className="text-[11px] font-black">{new Date(p.createdAt).toLocaleDateString()}</span></td>
                                <td className="px-8 py-5"><span className="text-[11px] font-black uppercase">{p.cashierName || 'System'}</span></td>
                                <td className="px-8 py-5 text-right font-black text-emerald-500">MK {p.amount.toLocaleString()}</td>
                                <td className="px-8 py-5 text-right text-[11px] font-black uppercase opacity-40">{p.paymentMethod}</td>
                                <td className="px-8 py-5 text-center">
                                  {p.signature ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-rose-500 font-black text-[8px]">NO SIGN</span>}
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
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-20 text-center opacity-30">
              <Users className="w-16 h-16 mb-4" />
              <h2 className="text-xl font-black uppercase">No account selected</h2>
            </div>
          )}
        </main>
      </div>

      {paymentModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-zinc-900/60 backdrop-blur-md p-6" onClick={() => { setPaymentModal(null); setSignature(null); }}>
          <div className="bg-surface-card w-full max-w-md rounded-[2.5rem] overflow-hidden border border-surface-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-10 space-y-8">
              <h3 className="text-xl font-black uppercase tracking-tighter">Record Payment</h3>
              <div className="space-y-4">
                <label className="text-[10px] font-black opacity-30 uppercase tracking-widest ml-1">Amount (MK)</label>
                <input title="Payment Amount" aria-label="Payment Amount" placeholder="0.00" type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field !text-2xl !py-6 w-full font-black" />
              </div>

              <div className="space-y-4 pt-4 border-t border-surface-border/30">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black opacity-30 uppercase tracking-widest ml-1">Authorized Signature</label>
                  <button type="button" title="Clear Signature" aria-label="Clear Signature" onClick={() => { const c = sigCanvasRef.current; if (c) { c.getContext('2d')?.clearRect(0,0,c.width,c.height); setSignature(null); } }} className="text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg transition-colors"><RotateCcw className="w-4 h-4" /></button>
                </div>
                <div className="bg-white border-2 border-surface-border rounded-2xl h-32 relative overflow-hidden group">
                  <canvas ref={sigCanvasRef} width={800} height={240} onMouseDown={startSignature} onTouchStart={startSignature} className="w-full h-full cursor-crosshair touch-none" />
                  {!signature && <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none uppercase font-black text-[10px] tracking-[0.3em]">Sign here to confirm</div>}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setPaymentModal(null); setSignature(null); }} className="flex-1 py-5 bg-surface-bg border border-surface-border rounded-2xl font-black text-[10px] uppercase">Discard</button>
                <button
                  type="button"
                  disabled={!signature || !payAmount || Number(payAmount) <= 0}
                  onClick={() => {
                    const amount = Number(payAmount);
                    if (amount > (selectedCustomer?.balance || 0)) return toast.error('Overpayment not allowed');
                    
                    toast(
                      (t) => (
                        <div className="flex flex-col gap-3">
                          <p className="text-sm font-bold">Confirm payment of <span className="text-emerald-500">MK {amount.toLocaleString()}</span>?</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { toast.dismiss(t.id); payMutation.mutate({ id: paymentModal.id, amount }); }}
                              className="flex-1 py-2 bg-primary-500 text-white rounded-lg text-xs font-black"
                            >Yes, Confirm</button>
                            <button
                              type="button"
                              onClick={() => toast.dismiss(t.id)}
                              className="flex-1 py-2 bg-surface-bg border border-surface-border rounded-lg text-xs font-black"
                            >Cancel</button>
                          </div>
                        </div>
                      ),
                      { duration: 8000 }
                    );
                  }}
                  className={clsx("flex-[2] py-5 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg", (!signature || !payAmount) ? "bg-surface-bg border border-surface-border opacity-50 cursor-not-allowed" : "bg-primary-500 text-white shadow-primary-500/20 active:scale-95")}
                >Complete Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Full customer profile" maxWidth="max-w-2xl">
        {selectedCustomer && (
          <div className="p-10 space-y-10">
            {isEditing ? (
              <form onSubmit={handleUpdateCustomer} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black opacity-30 uppercase ml-1">Full Name</label>
                      <input required placeholder="Name" className="input-field w-full" value={custForm.name} onChange={e => setCustForm({...custForm, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black opacity-30 uppercase ml-1">Phone</label>
                      <input required placeholder="Phone" className="input-field w-full" value={custForm.phone} onChange={e => setCustForm({...custForm, phone: restrictPhone(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black opacity-30 uppercase ml-1">National ID</label>
                      <input placeholder="National ID" className="input-field w-full uppercase" value={custForm.idNumber} onChange={e => setCustForm({...custForm, idNumber: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black opacity-30 uppercase ml-1">Location/Village</label>
                      <input placeholder="Location" className="input-field w-full" value={custForm.village} onChange={e => setCustForm({...custForm, village: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="aspect-square bg-surface-bg rounded-3xl border border-surface-border flex flex-col items-center justify-center overflow-hidden group relative">
                      {custForm.livePhoto ? <img src={custForm.livePhoto} alt="" className="w-full h-full object-cover" /> : useCamera ? <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" /> : <Camera className="w-10 h-10 opacity-10" />}
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-black/40 backdrop-blur-md flex gap-2">
                        {!useCamera ? (
                          <button type="button" title="Start Camera" aria-label="Start Camera" onClick={startCamera} className="flex-1 bg-white p-2 rounded-xl"><Camera className="w-4 h-4 mx-auto" /></button>
                        ) : (
                          <button type="button" title="Capture Photo" aria-label="Capture Photo" onClick={capturePhoto} className="flex-1 bg-emerald-500 text-white p-2 rounded-xl"><CheckCircle2 className="w-4 h-4 mx-auto" /></button>
                        )}
                        <label className="flex-1 bg-white p-2 rounded-xl cursor-pointer"><Upload className="w-4 h-4 mx-auto" /><input type="file" title="Upload Photo" aria-label="Upload Photo" className="hidden" onChange={handleFileUpload} /></label>
                      </div>
                    </div>
                    <button type="button" onClick={captureFingerprint} className={clsx("w-full py-4 rounded-2xl border flex items-center justify-center gap-3", custForm.fingerprintData ? "bg-emerald-500/10 text-emerald-500" : "bg-surface-bg")}>
                      <Fingerprint className="w-5 h-5" /> <span className="text-[10px] font-black uppercase">{custForm.fingerprintData ? 'Update Biometrics' : 'Scan Finger'}</span>
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 pt-6 border-t border-surface-border">
                   <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-4 bg-surface-bg rounded-2xl font-black text-[10px] uppercase">Cancel</button>
                   <button type="submit" className="flex-[2] btn-primary !py-4 text-[10px] font-black uppercase flex items-center justify-center gap-3"><Save className="w-4 h-4" /> Save Changes</button>
                </div>
              </form>
            ) : (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row gap-10 items-center md:items-start">
                  <div className="w-48 h-48 rounded-[3rem] bg-surface-bg border border-surface-border overflow-hidden shadow-2xl shrink-0">
                    {selectedCustomer.livePhoto ? <img src={selectedCustomer.livePhoto} alt="" className="w-full h-full object-cover" /> : <Users className="w-20 h-20 opacity-10 mx-auto mt-12" />}
                  </div>
                  <div className="flex-1 space-y-6">
                    <div><h3 className="text-3xl font-black uppercase">{selectedCustomer.name}</h3><p className="text-primary-500 text-[10px] font-black uppercase">Registered {new Date(selectedCustomer.createdAt).toLocaleDateString()}</p></div>
                    <div className="grid grid-cols-2 gap-4">
                      {[ {label: 'Phone', val: selectedCustomer.phone}, {label: 'ID Number', val: selectedCustomer.idNumber || 'N/A'}, {label: 'Location', val: selectedCustomer.village || 'N/A'}, {label: 'Biometrics', val: selectedCustomer.fingerprintData ? 'VERIFIED' : 'NOT ENROLLED'} ].map((item, i) => (
                        <div key={i} className="bg-surface-bg p-5 rounded-2xl border border-surface-border">
                          <div className="text-[8px] font-black opacity-30 uppercase mb-1">{item.label}</div>
                          <div className="text-sm font-black">{item.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-6 border-t border-surface-border">
                  <button type="button" onClick={() => { setCustForm({ ...selectedCustomer } as typeof custForm); setIsEditing(true); }} className="px-8 py-3 bg-primary-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary-500/20">Edit Details</button>
                  <button
                    type="button"
                    onClick={() => {
                      toast(
                        (t) => (
                          <div className="flex flex-col gap-3">
                            <p className="text-sm font-bold">Permanently delete <span className="text-red-500">{selectedCustomer.name}</span>? This cannot be undone.</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={async () => { toast.dismiss(t.id); await db.customers.delete(selectedCustomer.id); setSelectedCustomer(null); setIsProfileModalOpen(false); toast.success('Profile removed'); }}
                                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-black"
                              >Yes, delete</button>
                              <button
                                type="button"
                                onClick={() => toast.dismiss(t.id)}
                                className="flex-1 py-2 bg-surface-bg border border-surface-border rounded-lg text-xs font-black"
                              >Cancel</button>
                            </div>
                          </div>
                        ),
                        { duration: 8000 }
                      );
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500/5 text-red-500/40 hover:text-red-500 rounded-xl text-[9px] font-black uppercase transition-colors"
                  ><Trash2 className="w-4 h-4" /> Delete Profile</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register profile">
        <form onSubmit={handleAddCustomer} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <input required title="Full Name" aria-label="Full Name" placeholder="Name" className="input-field w-full py-4" value={custForm.name} onChange={e => setCustForm({...custForm, name: e.target.value})} />
              <input required title="Phone Number" aria-label="Phone Number" placeholder="Phone" className="input-field w-full py-4" value={custForm.phone} onChange={e => setCustForm({...custForm, phone: restrictPhone(e.target.value)})} />
              <input title="National ID" aria-label="National ID" placeholder="National ID" className="input-field w-full py-4 uppercase" value={custForm.idNumber} onChange={e => setCustForm({...custForm, idNumber: e.target.value})} />
              <input title="Location/Village" aria-label="Location/Village" placeholder="Location" className="input-field w-full py-4" value={custForm.village} onChange={e => setCustForm({...custForm, village: e.target.value})} />
            </div>
            <div className="space-y-4">
               <div className="aspect-square bg-surface-bg rounded-3xl border border-surface-border flex flex-col items-center justify-center overflow-hidden">
                 {custForm.livePhoto ? <img src={custForm.livePhoto} alt="" className="w-full h-full object-cover" /> : useCamera ? <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" /> : <Camera className="w-10 h-10 opacity-10" />}
                 <div className="flex gap-2 p-2 w-full bg-black/5">
                   {!useCamera ? (
                     <button type="button" title="Start Camera" aria-label="Start Camera" onClick={startCamera} className="flex-1 bg-white p-2 rounded-xl"><Camera className="w-4 h-4 mx-auto" /></button>
                   ) : (
                     <button type="button" title="Capture Photo" aria-label="Capture Photo" onClick={capturePhoto} className="flex-1 bg-emerald-500 text-white p-2 rounded-xl"><CheckCircle2 className="w-4 h-4 mx-auto" /></button>
                   )}
                   <label title="Upload Photo" aria-label="Upload Photo" className="flex-1 bg-white p-2 rounded-xl cursor-pointer">
                     <Upload className="w-4 h-4 mx-auto" />
                     <input title="Select Photo File" aria-label="Select Photo File" type="file" className="hidden" onChange={handleFileUpload} />
                   </label>
                 </div>
               </div>
               <button type="button" title="Scan Fingerprint" aria-label="Scan Fingerprint" onClick={captureFingerprint} className={clsx("w-full py-4 rounded-2xl border flex items-center justify-center gap-3", custForm.fingerprintData ? "bg-emerald-500/10 text-emerald-500" : "bg-surface-bg")}>
                 <Fingerprint className="w-5 h-5" /> <span className="text-[10px] font-black uppercase">{custForm.fingerprintData ? 'Biometric Verified' : 'Scan Finger'}</span>
               </button>
            </div>
          </div>
          <div className="pt-6 flex gap-4">
            <button type="button" title="Discard Changes" aria-label="Discard Changes" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-surface-bg rounded-2xl font-black text-[10px] uppercase">Discard</button>
            <button type="submit" title="Register Customer" aria-label="Register Customer" className="flex-[2] btn-primary !py-4 text-[10px] font-black uppercase">Register</button>
          </div>
        </form>
        <canvas ref={canvasRef} className="hidden" />
      </Modal>

      <Modal isOpen={!!clearedReceipt} onClose={() => setClearedReceipt(null)} title="Payment receipt">
        {clearedReceipt && (
          <div className="p-6 flex flex-col items-center gap-6">
            <div className="bg-white p-6 w-full" id="printable-receipt"><Receipt {...clearedReceipt} /></div>
            <button type="button" title="Close Receipt View" aria-label="Close Receipt View" onClick={() => setClearedReceipt(null)} className="w-full py-4 btn-primary font-black text-[10px] uppercase">Close</button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DebtPage;
