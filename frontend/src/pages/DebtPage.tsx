import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../api/client';
import { db, type LocalCustomer, type LocalProduct, type LocalDebtPayment, type LocalSale } from '../db/posDB';
import { useLocation } from 'react-router-dom';
import { toBlob } from 'html-to-image';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { Receipt } from '../components/Receipt';
import { SyncService } from '../services/SyncService';
import { isValidMalawianPhone, restrictPhone } from '../utils/phoneUtils';
import { generateUUID } from '../utils/cryptoUtils';
import { 
  Search, 
  Users, 
  Camera,
  CheckCircle2,
  Calendar,
  Trash2,
  Save,
  RotateCcw,
  ArrowLeft,
  Upload,
  MessageSquare,
  MessageCircle as WhatsAppIcon, 
  Shield 
} from 'lucide-react';
import Modal from '../components/Modal';

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





import { useAuthStore } from '../hooks/useAuth';

const DebtPage: React.FC = () => {
  const currentUser = useAuthStore(state => state.user);
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<LocalCustomer | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ id: string, total: number } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [clearedReceipt, setClearedReceipt] = useState<ReceiptData | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [signature, setSignature] = useState<string | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);

  interface CustomerForm {
    name: string;
    phone: string;
    idNumber: string;
    village: string;
    witnessPhone: string;
    livePhoto: string;
  }

  const [custForm, setCustForm] = useState<CustomerForm>({ 
    name: '', 
    phone: '',
    idNumber: '',
    village: '',
    witnessPhone: '',
    livePhoto: ''
  });

  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resetForm = () => {
    setCustForm({ name: '', phone: '', idNumber: '', village: '', witnessPhone: '', livePhoto: '' });
  };

  // Handle POS Redirect
  useEffect(() => {
    if (location.state?.creditSale) {
      requestAnimationFrame(() => {
        resetForm();
        setIsAddModalOpen(true);
      });
      window.history.replaceState({}, document.title);
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
    mutationFn: async (data: { id: string, amount: number }) => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const cashierName = user.fullname || 'Unknown Cashier';
      const paymentId = generateUUID();
      
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

      // If id is numeric string, it's a remote credit, so notify server
      if (!isNaN(Number(data.id))) {
        await api.post(`/credits/${data.id}/pay`, { amount: data.amount });
      }

      void SyncService.pushSales();
      
      return { 
        success: true,
        receipt: {
          items: [{ product: { name: `PAYMENT TOWARDS ACCOUNT`, sellPrice: data.amount } as unknown as LocalProduct, quantity: 1 }],
          total: data.amount,
          subtotal: data.amount,
          tax: 0,
          discount: 0,
          invoiceNo: (filteredCredits.find(c => String(c.id) === String(data.id))?.invoice_no) || `PAY-${Date.now().toString(36).toUpperCase()}`,
          date: new Date().toISOString(),
          mode: 'Cash',
          customerName: selectedCustomer.name,
          customerId: selectedCustomer.id,
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

  const localCredits = useLiveQuery(
    () => selectedCustomer ? db.salesQueue.where('customerId').equals(selectedCustomer.id).toArray() : Promise.resolve([] as LocalSale[]),
    [selectedCustomer]
  ) || [];

  const filteredCredits = useMemo(() => {
    if (!selectedCustomer) return [];
    
    const creditsFromLocal = (localCredits || []).map(s => ({
      id: String(s.id),
      invoice_no: s.invoiceNo,
      original_amount: s.total,
      paid_amount: s.paid,
      due_date: s.dueDate || 'N/A',
      current_total: s.total,
      status: s.status === 'COMPLETED' ? 'Paid' : 'Pending'
    }));

    const fromApi = (allCredits || []).filter(c => 
      c.customer_phone === selectedCustomer.phone || 
      c.customer_name.toLowerCase() === selectedCustomer.name.toLowerCase()
    ).map(c => ({
      ...c,
      id: String(c.id)
    }));

    const combined = [...creditsFromLocal];
    fromApi.forEach(apiCredit => {
      if (!combined.find(l => l.invoice_no === apiCredit.invoice_no)) {
        combined.push(apiCredit);
      }
    });

    return combined;
  }, [allCredits, selectedCustomer, localCredits]);

  // Camera cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setUseCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
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
      videoRef.current.srcObject = null;
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

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidMalawianPhone(custForm.phone)) return toast.error('Phone number must be 10 digits (starting with 0) or 13 digits (starting with +265)');
    if (custForm.witnessPhone && !isValidMalawianPhone(custForm.witnessPhone)) return toast.error('Witness phone number invalid');
    if (!custForm.name || !custForm.village || !custForm.idNumber) return toast.error('Please fill all mandatory fields');
    
    try {
      const existing = await db.customers.where('phone').equals(custForm.phone).first();
      if (existing) return toast.error(`Customer with phone ${custForm.phone} already exists (${existing.name})`);

      const customerId = generateUUID();
      const creditSale = location.state?.creditSale;
      const initialPaid = creditSale ? creditSale.paid : 0;
      const totalAmt = creditSale ? creditSale.total : 0;
      
      const newCustomer: LocalCustomer = {
        ...custForm,
        id: customerId,
        idNumber: custForm.idNumber.toUpperCase(),
        balance: Math.max(0, totalAmt - initialPaid),
        totalCreditAmount: totalAmt,
        totalPaidAmount: initialPaid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: 0
      };

      await db.customers.add(newCustomer);

      if (creditSale) {
        // Log the initial sale
        const saleData = {
          ...creditSale,
          id: generateUUID(),
          customerId,
          paymentMode: 'Credit',
          itemsCount: creditSale.items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0),
          createdAt: creditSale.date || new Date().toISOString(),
          synced: 0,
          status: 'PENDING'
        };
        await db.salesQueue.add(saleData);

        // Record initial deposit in history if any
        if (initialPaid > 0) {
          await db.debtPayments.add({
            id: generateUUID(),
            customerId,
            amount: initialPaid,
            paymentMethod: creditSale.paymentMode || 'Cash',
            cashierName: saleData.sellerName || 'System',
            createdAt: new Date().toISOString(),
            synced: 0,
            reference: 'INITIAL DEPOSIT'
          });
        }
        
        // Update product quantities
        for (const item of creditSale.items) {
          const product = await db.products.get(item.productId);
          if (product && !product.isService) {
            await db.products.update(item.productId, {
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
    if (!isValidMalawianPhone(custForm.phone)) return toast.error('Phone number must be 10 digits (starting with 0) or 13 digits (starting with +265)');
    if (custForm.witnessPhone && !isValidMalawianPhone(custForm.witnessPhone)) return toast.error('Witness phone number invalid');
    
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
    <div className="flex flex-col w-full transition-all relative stagger-children">

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden relative">
        <aside className={clsx(
          "w-full md:w-80 lg:w-96 border-r border-border/50 bg-card/30 backdrop-blur-xl flex flex-col shrink-0 transition-transform duration-300",
          selectedCustomer && "hidden md:flex"
        )}>
          <div className="p-6 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input title="Search Customers" aria-label="Search Customers" placeholder="Search customers..." className="input-field w-full pl-10 text-[10px] py-3 font-bold capitalize tracking-widest" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar stagger-children">
            {customers?.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground/20 font-bold text-[9px] capitalize">No active credit accounts</div>
            ) : (
              <div className="divide-y divide-border/30">
                {customers?.map(c => (
                  <div key={c.id} onClick={() => { setSelectedCustomer(c); }} className={clsx("p-6 flex items-center justify-between transition-all border-l-4 btn-press cursor-pointer", selectedCustomer?.id === c.id ? "bg-primary/10 border-l-primary" : "border-l-transparent hover:bg-muted/10")}>
                    <div className="flex-1 min-w-0"><h3 className="text-[12px] font-bold capitalize tracking-tighter truncate">{c.name}</h3><p className="text-[8px] font-bold text-muted-foreground/50 capitalize tracking-widest">{c.phone}</p></div>
                    <div className="text-right">
                       <p className="text-[11px] font-bold text-destructive">MK {Number(c.balance || 0).toLocaleString()}</p>
                    </div>
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
              {/* Header Actions */}
              <div className="flex items-center justify-between mb-4">
                <button 
                  type="button" 
                  onClick={() => setSelectedCustomer(null)}
                  className="flex items-center gap-2 text-primary font-bold text-[10px] md:text-[12px] capitalize tracking-widest btn-press hover:opacity-80"
                >
                  <ArrowLeft className="w-4 h-4" /> <span className="md:hidden">Back</span><span className="hidden md:inline">Cancel / Go Back</span>
                </button>

                {currentUser?.role === 'ADMIN' && (
                  <button 
                    type="button"
                    onClick={() => {
                      if (!selectedCustomer) return;
                      toast(
                        (t) => (
                          <div className="p-4 flex flex-col gap-4">
                            <div className="font-bold text-sm tracking-tighter">Delete Profile?</div>
                            <p className="text-[10px] text-muted-foreground/80 font-bold uppercase leading-relaxed">This will permanently delete {selectedCustomer.name} and all their credit history.</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  toast.dismiss(t.id);
                                  try {
                                    await db.customers.delete(selectedCustomer.id);
                                    setSelectedCustomer(null);
                                    toast.success('Profile deleted');
                                  } catch { toast.error('Failed to delete'); }
                                }}
                                className="flex-1 py-2 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all"
                              >Yes, delete</button>
                              <button
                                type="button"
                                onClick={() => toast.dismiss(t.id)}
                                className="flex-1 py-2 btn-cancel text-[10px]"
                              >Cancel</button>
                            </div>
                          </div>
                        ),
                        { duration: 8000 }
                      );
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-[9px] md:text-[10px] font-black uppercase transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Profile
                  </button>
                )}
              </div>

              <div className="glass-panel p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-border/50 shadow-xl flex flex-col xl:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-6 w-full xl:w-auto">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-primary/10 rounded-[2.5rem] border-2 border-primary/20 overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                    {selectedCustomer.livePhoto ? (
                      <img src={selectedCustomer.livePhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-10 h-10 md:w-12 md:h-12 text-primary" />
                    )}
                  </div>
                  <div>
                     <h2 className="text-xl md:text-3xl font-bold tracking-tighter capitalize truncate max-w-[200px] md:max-w-none">{selectedCustomer.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <WhatsAppIcon className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                      <p className="text-[10px] md:text-[12px] font-bold text-muted-foreground tracking-tight">{selectedCustomer.phone}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 md:gap-12 text-right w-full xl:w-auto border-t xl:border-t-0 border-border/50 pt-6 xl:pt-0">
                  <div>
                    <div className="text-[8px] md:text-[9px] font-bold text-muted-foreground capitalize mb-1 tracking-widest">Total Credit</div>
                    <div className="text-sm md:text-xl font-bold tracking-tighter text-foreground">MK {Number(selectedCustomer.totalCreditAmount || selectedCustomer.balance || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[8px] md:text-[9px] font-bold text-muted-foreground capitalize mb-1 tracking-widest">Total Paid</div>
                    <div className="text-sm md:text-xl font-bold text-success tracking-tighter">MK {Number(selectedCustomer.totalPaidAmount || 0).toLocaleString()}</div>
                  </div>
                  <div className="col-span-2 lg:col-span-1 border-t lg:border-t-0 border-border/50 pt-4 lg:pt-0">
                    <div className="text-[8px] md:text-[9px] font-bold text-destructive/40 capitalize mb-1 tracking-widest">Balance Due</div>
                    <div className="text-3xl md:text-5xl font-bold text-destructive tracking-tighter leading-none">MK {Number(selectedCustomer.balance || 0).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                 <div className="flex items-center justify-between border-b border-surface-border pb-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold tracking-tighter flex items-center gap-3"><Shield className="w-5 h-5 text-primary-500" /> Credit Details</h3>
                    <button 
                      onClick={() => {
                        window.location.href = '/staff/pos'; // Redirect to staff POS
                      }}
                      className="px-4 py-1.5 bg-primary/10 text-primary rounded-xl text-[9px] font-bold capitalize tracking-widest border border-primary/20 hover:bg-primary/20 transition-all btn-press"
                    >
                      + Top Up Debt
                    </button>
                  </div>
                  <button type="button" title="Open Full Profile" aria-label="Open Full Profile" onClick={() => setIsProfileModalOpen(true)} className="text-[10px] font-bold text-primary-500 capitalize tracking-widest underline">View Profile</button>
                </div>
                <div className="bg-surface-card rounded-3xl border border-surface-border overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-full md:min-w-[800px]">
                      <thead>
                        <tr className="bg-surface-bg/50 text-[8px] md:text-[9px] font-bold text-surface-text/40 tracking-widest border-b border-surface-border capitalize">
                          <th className="px-2 md:px-8 py-3 md:py-5">Invoice #</th>
                          <th className="px-2 md:px-8 py-3 md:py-5">Due date</th>
                          <th className="px-2 md:px-8 py-3 md:py-5 text-right">Original amount</th>
                          <th className="px-2 md:px-8 py-3 md:py-5 text-right">Current balance</th>
                          <th className="px-2 md:px-8 py-3 md:py-5 text-right">Actions</th>
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
                              <td className="px-2 md:px-8 py-4 md:py-6"><span className="text-[10px] md:text-[11px] font-black font-mono">#{credit.invoice_no}</span></td>
                              <td className="px-2 md:px-8 py-4 md:py-6">
                                <div className="flex items-center gap-1 md:gap-2"><Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 opacity-20" /><span className="text-[10px] md:text-[11px] font-black">{credit.due_date}</span></div>
                              </td>
                              <td className="px-2 md:px-8 py-4 md:py-6 text-right text-[10px] md:text-[11px] font-black">MK {Number(credit.original_amount || 0).toLocaleString()}</td>
                              <td className="px-2 md:px-8 py-4 md:py-6 text-right"><div className="text-xs md:text-sm font-black text-rose-500">MK {(Number(credit.current_total || 0) - Number(credit.paid_amount || 0)).toLocaleString()}</div></td>
                              <td className="px-2 md:px-8 py-4 md:py-6 text-right">
                                {credit.status !== 'Paid' && (
                                  <button type="button" title="Pay This Invoice" aria-label="Pay This Invoice" onClick={() => { setPaymentModal({ id: String(credit.id), total: Number(credit.current_total) - Number(credit.paid_amount) }); setPayAmount(String(Number(credit.current_total) - Number(credit.paid_amount))); }} className="px-6 py-2.5 bg-primary-500 text-white rounded-xl text-[9px] font-black uppercase">Pay balance</button>
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
                  <h3 className="text-lg font-bold tracking-tighter flex items-center gap-3"><RotateCcw className="w-5 h-5 text-emerald-500" /> Repayment History</h3>
                  <div className="bg-surface-card rounded-3xl border border-surface-border overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-full md:min-w-[800px]">
                        <thead>
                          <tr className="bg-surface-bg/50 text-[8px] md:text-[9px] font-bold text-surface-text/40 tracking-widest border-b border-surface-border capitalize">
                            <th className="px-2 md:px-8 py-3 md:py-5">Date</th>
                            <th className="px-2 md:px-8 py-3 md:py-5">Cashier</th>
                            <th className="px-2 md:px-8 py-3 md:py-5 text-right">Amount paid</th>
                            <th className="px-2 md:px-8 py-3 md:py-5 text-right">Method</th>
                            <th className="px-2 md:px-8 py-3 md:py-5 text-center">Verification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border/50">
                          {payments?.length === 0 ? (
                            <tr><td colSpan={5} className="p-10 text-center text-[10px] font-bold text-surface-text/20 uppercase">No payment history</td></tr>
                          ) : (
                            payments?.map(p => (
                              <tr key={p.id} className="hover:bg-emerald-500/[0.01]">
                                <td className="px-2 md:px-8 py-4 md:py-5"><span className="text-[10px] md:text-[11px] font-black">{new Date(p.createdAt).toLocaleDateString()}</span></td>
                                <td className="px-2 md:px-8 py-4 md:py-5"><span className="text-[10px] md:text-[11px] font-black uppercase">{p.cashierName || 'System'}</span></td>
                                <td className="px-2 md:px-8 py-4 md:py-5 text-right text-[10px] md:text-[11px] font-black text-emerald-500">MK {Number(p.amount || 0).toLocaleString()}</td>
                                <td className="px-2 md:px-8 py-4 md:py-5 text-right text-[10px] md:text-[11px] font-black uppercase opacity-40">{p.paymentMethod}</td>
                                <td className="px-2 md:px-8 py-4 md:py-5 text-center">
                                  {p.reference === 'INITIAL DEPOSIT' ? <span className="text-[8px] md:text-[9px] font-black text-primary px-2 md:px-3 py-1 bg-primary/10 rounded-full">DEPOSIT</span> : p.signature ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-rose-500 font-black text-[8px]">NO SIGN</span>}
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
              <h3 className="text-xl font-bold capitalize tracking-tighter">Record payment</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest ml-1">Payment amount (MK)</label>
                  <button 
                    type="button"
                    onClick={() => setPayAmount(String(paymentModal.total))}
                    className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
                  >
                    Pay Full Balance
                  </button>
                </div>
                <input title="Payment Amount" aria-label="Payment Amount" placeholder="0.00" type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field !text-2xl !py-6 w-full font-bold" />
              </div>

              <div className="space-y-4 pt-4 border-t border-surface-border/30">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest ml-1">Authorized Signature</label>
                  <button type="button" title="Clear Signature" aria-label="Clear Signature" onClick={() => { const c = sigCanvasRef.current; if (c) { c.getContext('2d')?.clearRect(0,0,c.width,c.height); setSignature(null); } }} className="text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg transition-colors"><RotateCcw className="w-4 h-4" /></button>
                </div>
                <div className="bg-white border-2 border-surface-border rounded-2xl h-32 relative overflow-hidden group">
                  <canvas ref={sigCanvasRef} width={800} height={240} onMouseDown={startSignature} onTouchStart={startSignature} className="w-full h-full cursor-crosshair touch-none" />
                  {!signature && <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none uppercase font-black text-[10px] tracking-[0.3em]">Sign here to confirm</div>}
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <div className="flex gap-4">
                  <button
                    type="button"
                    disabled={!signature || !payAmount || Number(payAmount) <= 0}
                    onClick={() => {
                      const amount = Number(payAmount);
                      if (amount > (selectedCustomer?.balance || 0)) return toast.error('Overpayment not allowed');
                      
                      toast(
                        (t) => (
                          <div className="flex flex-col gap-3">
                            <p className="text-sm font-bold">Record partial payment of <span className="text-emerald-500">MK {amount.toLocaleString()}</span>?</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => { toast.dismiss(t.id); payMutation.mutate({ id: paymentModal.id, amount }); }}
                                className="flex-1 py-2 bg-zinc-900 text-white rounded-lg text-xs font-black"
                              >Yes, Update</button>
                              <button
                                type="button"
                                onClick={() => toast.dismiss(t.id)}
                                className="flex-1 py-2 btn-cancel text-[10px]"
                              >Cancel</button>
                            </div>
                          </div>
                        ),
                        { duration: 8000 }
                      );
                    }}
                    className={clsx("flex-1 py-5 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg", (!signature || !payAmount) ? "bg-surface-bg border border-surface-border opacity-50 cursor-not-allowed" : "bg-zinc-900 text-white shadow-xl active:scale-95")}
                  >Update Balance</button>

                  <button
                    type="button"
                    disabled={!signature}
                    onClick={() => {
                      const amount = paymentModal.total;
                      setPayAmount(String(amount));
                      
                      toast(
                        (t) => (
                          <div className="flex flex-col gap-3">
                            <p className="text-sm font-bold">Clear full balance of <span className="text-primary-500">MK {amount.toLocaleString()}</span>?</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => { toast.dismiss(t.id); payMutation.mutate({ id: paymentModal.id, amount }); }}
                                className="flex-1 py-2 bg-primary-500 text-white rounded-lg text-xs font-black"
                              >Yes, Clear All</button>
                              <button
                                type="button"
                                onClick={() => toast.dismiss(t.id)}
                                className="flex-1 py-2 btn-cancel text-[10px]"
                              >Cancel</button>
                            </div>
                          </div>
                        ),
                        { duration: 8000 }
                      );
                    }}
                    className={clsx("flex-1 py-5 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg", (!signature) ? "bg-surface-bg border border-surface-border opacity-50 cursor-not-allowed" : "bg-primary-500 text-white shadow-primary-500/20 active:scale-95")}
                  >Complete Payment</button>
                </div>
                <button type="button" onClick={() => { setPaymentModal(null); setSignature(null); }} className="w-full py-4 text-muted-foreground font-bold text-[9px] uppercase tracking-widest hover:text-foreground transition-colors">Discard Transaction</button>
              </div>
            </div>
          </div>
        </div>
      )}

       <Modal isOpen={isProfileModalOpen} onClose={() => { setIsProfileModalOpen(false); setIsEditing(false); }} title="Customer Profile" maxWidth="max-w-2xl">
        {selectedCustomer && (
          <div className="p-10 space-y-10">
            {isEditing ? (
              <form onSubmit={handleUpdateCustomer} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="aspect-square bg-muted/20 rounded-[3rem] border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden group relative transition-all hover:border-primary/50">
                      {custForm.livePhoto ? <img src={custForm.livePhoto} alt="" className="w-full h-full object-cover" /> : useCamera ? <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" /> : <Camera className="w-16 h-16 opacity-10" />}
                      <div className="absolute inset-x-0 bottom-0 p-4 bg-background/80 backdrop-blur-md flex gap-3 translate-y-full group-hover:translate-y-0 transition-transform">
                        {!useCamera ? (
                          <button type="button" title="Start Camera" aria-label="Start Camera" onClick={startCamera} className="flex-1 bg-primary text-primary-foreground p-3 rounded-2xl shadow-lg active:scale-95 transition-all"><Camera className="w-5 h-5 mx-auto" /></button>
                        ) : (
                          <button type="button" title="Capture Photo" aria-label="Capture Photo" onClick={capturePhoto} className="flex-1 bg-success text-white p-3 rounded-2xl shadow-lg active:scale-95 transition-all"><CheckCircle2 className="w-5 h-5 mx-auto" /></button>
                        )}
                        <label className="flex-1 bg-card border border-border p-3 rounded-2xl cursor-pointer shadow-lg active:scale-95 transition-all hover:bg-muted/50"><Upload className="w-5 h-5 mx-auto text-foreground" /><input type="file" title="Upload Photo" aria-label="Upload Photo" className="hidden" onChange={handleFileUpload} /></label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest ml-1">Full Name</label>
                      <input required placeholder="ENTER NAME" className="input-field w-full !py-4 font-bold uppercase" value={custForm.name} onChange={e => setCustForm({...custForm, name: e.target.value.toUpperCase()})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest ml-1">Phone Number</label>
                      <input required placeholder="0..." className="input-field w-full !py-4 font-bold" value={custForm.phone} onChange={e => setCustForm({...custForm, phone: restrictPhone(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest ml-1">Witness Phone</label>
                      <input placeholder="WITNESS PHONE" className="input-field w-full !py-4 font-bold" value={custForm.witnessPhone} onChange={e => setCustForm({...custForm, witnessPhone: restrictPhone(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest ml-1">National ID Number</label>
                      <input placeholder="ID NUMBER" maxLength={8} className="input-field w-full !py-4 uppercase font-bold" value={custForm.idNumber} onChange={e => setCustForm({...custForm, idNumber: e.target.value.toUpperCase().substring(0, 8)})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest ml-1">Location / Village</label>
                      <input placeholder="LOCATION" className="input-field w-full !py-4 font-bold uppercase" value={custForm.village} onChange={e => setCustForm({...custForm, village: e.target.value.toUpperCase()})} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-10 border-t border-border/50">
                   <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-5 btn-cancel text-[10px]">Cancel edit</button>
                   <button type="submit" className="flex-[2] py-5 bg-primary text-primary-foreground rounded-[2rem] font-bold text-[10px] capitalize tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-primary/20 btn-press"><Save className="w-5 h-5" /> Save changes</button>
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
                    <div className="grid grid-cols-2 gap-5">
                      {[ 
                        {label: 'Phone Number', val: selectedCustomer.phone}, 
                        {label: 'Witness Phone', val: selectedCustomer.witnessPhone || 'N/A'},
                        {label: 'National ID', val: selectedCustomer.idNumber || 'N/A'}, 
                        {label: 'Location / Village', val: selectedCustomer.village || 'N/A'}, 
                        {label: 'Total Paid', val: `MK ${(selectedCustomer.totalPaidAmount || 0).toLocaleString()}`} 
                      ].map((item, i) => (
                        <div key={i} className="bg-muted/10 p-5 rounded-3xl border border-border/50">
                          <div className="text-[9px] font-black text-muted-foreground uppercase mb-1 tracking-widest">{item.label}</div>
                          <div className="text-[11px] font-black text-foreground">{item.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-6 border-t border-surface-border">
                  <button type="button" onClick={() => { 
                    setCustForm({ 
                      name: selectedCustomer.name,
                      phone: selectedCustomer.phone,
                      idNumber: selectedCustomer.idNumber || '',
                      village: selectedCustomer.village || '',
                      witnessPhone: selectedCustomer.witnessPhone || '',
                      livePhoto: selectedCustomer.livePhoto || ''
                    }); 
                    setIsEditing(true); 
                  }} className="px-8 py-3 bg-primary-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary-500/20">Edit Details</button>
                  {currentUser?.role === 'ADMIN' && (
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
                                  onClick={async () => {
                                    toast.dismiss(t.id);
                                    try {
                                      if (!navigator.onLine) {
                                        toast.error('You must be online to delete a customer.');
                                        return;
                                      }
                                      await api.delete(`/customers/${selectedCustomer.id}`);
                                      await db.customers.delete(selectedCustomer.id);
                                      setSelectedCustomer(null);
                                      setIsProfileModalOpen(false);
                                      toast.success('Profile removed');
                                    } catch (e) {
                                      toast.error('Failed to remove profile');
                                    }
                                  }}
                                  className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-black"
                                >Yes, delete</button>
                                <button
                                  type="button"
                                  onClick={() => toast.dismiss(t.id)}
                                  className="flex-1 py-2 btn-cancel text-[10px]"
                                >Cancel</button>
                              </div>
                            </div>
                          ),
                          { duration: 8000 }
                        );
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-red-500/5 text-red-500/40 hover:text-red-500 rounded-xl text-[9px] font-black uppercase transition-colors"
                    ><Trash2 className="w-4 h-4" /> Delete Profile</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); resetForm(); }} title="Register Credit Profile" maxWidth="max-w-2xl">
        <form onSubmit={handleAddCustomer} className="p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
               <div className="aspect-square bg-muted/20 rounded-[3rem] border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden group relative transition-all hover:border-primary/50">
                 {custForm.livePhoto ? <img src={custForm.livePhoto} alt="" className="w-full h-full object-cover" /> : useCamera ? <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" /> : <Camera className="w-16 h-16 opacity-10" />}
                 <div className="absolute inset-x-0 bottom-0 p-4 bg-background/80 backdrop-blur-md flex gap-3 translate-y-full group-hover:translate-y-0 transition-transform">
                   {!useCamera ? (
                     <button type="button" title="Start Camera" aria-label="Start Camera" onClick={startCamera} className="flex-1 bg-primary text-primary-foreground p-3 rounded-2xl shadow-lg active:scale-95 transition-all"><Camera className="w-5 h-5 mx-auto" /></button>
                   ) : (
                     <button type="button" title="Capture Photo" aria-label="Capture Photo" onClick={capturePhoto} className="flex-1 bg-success text-white p-3 rounded-2xl shadow-lg active:scale-95 transition-all"><CheckCircle2 className="w-5 h-5 mx-auto" /></button>
                   )}
                   <label title="Upload Photo" aria-label="Upload Photo" className="flex-1 bg-card border border-border p-3 rounded-2xl cursor-pointer shadow-lg active:scale-95 transition-all hover:bg-muted/50">
                     <Upload className="w-5 h-5 mx-auto text-foreground" />
                     <input title="Select Photo File" aria-label="Select Photo File" type="file" className="hidden" onChange={handleFileUpload} />
                   </label>
                 </div>
               </div>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest ml-1">Full Name</label>
                <input required title="Full Name" aria-label="Full Name" placeholder="ENTER NAME" className="input-field w-full !py-4 font-bold uppercase" value={custForm.name} onChange={e => setCustForm({...custForm, name: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest ml-1">Phone Number</label>
                <div className="relative">
                  <WhatsAppIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  <input required title="Phone Number" aria-label="Phone Number" placeholder="0..." className="input-field w-full !py-4 pl-12 font-bold" value={custForm.phone} onChange={e => setCustForm({...custForm, phone: restrictPhone(e.target.value)})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest ml-1">Witness Phone</label>
                <input title="Witness Phone" aria-label="Witness Phone" placeholder="WITNESS PHONE" className="input-field w-full !py-4 font-bold" value={custForm.witnessPhone} onChange={e => setCustForm({...custForm, witnessPhone: restrictPhone(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest ml-1">National ID Number</label>
                <input title="National ID" aria-label="National ID" maxLength={8} placeholder="ID NUMBER" className="input-field w-full !py-4 uppercase font-bold" value={custForm.idNumber} onChange={e => setCustForm({...custForm, idNumber: e.target.value.toUpperCase().substring(0, 8)})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest ml-1">Location / Village</label>
                <input title="Location/Village" aria-label="Location/Village" placeholder="LOCATION" className="input-field w-full !py-4 font-bold uppercase" value={custForm.village} onChange={e => setCustForm({...custForm, village: e.target.value.toUpperCase()})} />
              </div>
            </div>
          </div>
          <div className="pt-10 flex gap-4 border-t border-border/50">
            <button type="button" title="Discard Changes" aria-label="Discard Changes" onClick={() => { setIsAddModalOpen(false); resetForm(); }} className="flex-1 py-5 bg-muted/20 rounded-[2rem] font-bold text-[10px] capitalize tracking-widest btn-press">Discard</button>
            <button type="submit" title="Register Customer" aria-label="Register Customer" className="flex-[2] py-5 bg-primary text-primary-foreground rounded-[2rem] font-bold text-[10px] capitalize tracking-[0.2em] shadow-xl shadow-primary/20 btn-press">Register Profile</button>
          </div>
        </form>
        <canvas ref={canvasRef} className="hidden" />
      </Modal>

      <Modal isOpen={!!clearedReceipt} onClose={() => setClearedReceipt(null)} title="Payment receipt" maxWidth="max-w-md">
        {clearedReceipt && (
          <div className="p-6 flex flex-col items-center gap-6">
            <div className="bg-white p-6 w-full" id="printable-repayment-receipt"><Receipt {...clearedReceipt} /></div>
            <div className="flex gap-4 w-full">
              <button 
                onClick={async () => {
                  const el = document.getElementById('printable-repayment-receipt');
                  if (!el) return;
                  toast.loading('Preparing receipt...', { id: 'share' });
                  try {
                    const blob = await toBlob(el, {
                        pixelRatio: 3,
                        backgroundColor: '#ffffff',
                        width: 360,
                        skipFonts: true
                      });
                    if (blob) {
                      const file = new File([blob], `receipt-${clearedReceipt.invoiceNo}.png`, { type: 'image/png' });
                      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'Payment Receipt', text: `Repayment from ${clearedReceipt.customerName}` });
                        toast.success('Shared successfully', { id: 'share' });
                      } else {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `receipt-${clearedReceipt.invoiceNo}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        const text = encodeURIComponent(`Payment Receipt\nAmount: MK ${clearedReceipt.total.toLocaleString()}\nDate: ${new Date(clearedReceipt.date).toLocaleString()}\n(Image saved — attach it to this WhatsApp chat)`);
                        setTimeout(() => window.open(`https://wa.me/?text=${text}`, '_blank'), 600);
                        toast.success('Image saved! Attach it to WhatsApp.', { id: 'share', duration: 5000 });
                      }
                    }
                  } catch (err: any) { 
                    console.error('Share error:', err);
                    if (err?.name === 'AbortError') {
                      toast.dismiss('share');
                    } else {
                      toast.error('Failed to share', { id: 'share' });
                    }
                  }
                }}
                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 uppercase"
              >
                <MessageSquare className="w-4 h-4" /> Share WhatsApp
              </button>
              <button type="button" title="Close Receipt View" aria-label="Close Receipt View" onClick={() => setClearedReceipt(null)} className="flex-1 py-4 btn-primary font-black text-[10px] uppercase">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DebtPage;
