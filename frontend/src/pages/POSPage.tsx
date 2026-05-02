import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import type { LocalProduct, LocalSale, LocalCustomer, LocalSaleItem } from '../db/posDB';
import { toSentenceCase } from '../utils/stringUtils';
import { calculateEffectiveDiscount } from '../utils/discountUtils';
import { restrictPhone } from '../utils/phoneUtils';
import { 
  Search, 
  ShoppingCart, 
  RefreshCw, 
  Users, 
  ChevronRight, 
  Plus, 
  Minus, 
  PackageSearch, 
  Scan, 
  CreditCard, 
  Smartphone, 
  Wallet,
  Printer,
  Send,
  CheckCircle2,
  X,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { SyncService } from '../services/SyncService';
import { soundService } from '../services/SoundService';
import clsx from 'clsx';
import * as h2i from 'html-to-image';

import { Receipt } from '../components/Receipt';
import BarcodeScanner from '../components/BarcodeScanner';

const generateInvoiceNo = () => `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

interface TaxConfig {
  rate: number;
  inclusive: boolean;
}

const POSPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'Momo' | 'Credit'>('Cash');
  const [cart, setCart] = useState<{ product: LocalProduct; quantity: number }[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  
  const [custForm, setCustForm] = useState({ 
    name: '', 
    phone: '',
    idNumber: '',
    village: '',
    livePhoto: '',
    fingerprintData: ''
  });

  const [showScanner, setShowScanner] = useState(false);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [signature, setSignature] = useState<string | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [taxConfig, setTaxConfig] = useState<TaxConfig>({ rate: 0, inclusive: true });
  const [paymentConfig, setPaymentConfig] = useState({ momo: 'TNM Mpamba, Airtel Money', bank: 'National Bank, NBS Bank, Standard Bank' });
  const [printReceipt, setPrintReceipt] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const [showReceipt, setShowReceipt] = useState<{
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
    bankName?: string;
    accountNumber?: string;
    customerId?: string;
    signature?: string;
  } | null>(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #print-container, #print-container * { visibility: visible !important; }
        #print-container {
          position: fixed;
          left: 0;
          top: 0;
          width: 80mm;
          margin: 0;
          padding: 0;
          display: flex !important;
          justify-content: center !important;
          background: white;
        }
        @page {
          size: 80mm auto;
          margin: 0;
        }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const tax = await db.settings.get('tax_config');
      if (tax?.value) setTaxConfig(tax.value as TaxConfig);
      const payment = await db.settings.get('payment_config');
      if (payment?.value) setPaymentConfig(payment.value as { momo: string; bank: string });
    };
    loadSettings();
  }, []);

  const products = useLiveQuery(
    () => searchTerm.length >= 2 
      ? db.products.where('name').startsWithIgnoreCase(searchTerm).toArray()
      : Promise.resolve([] as LocalProduct[]),
    [searchTerm]
  );
  
  const customers = useLiveQuery(
    () => db.customers.where('name').startsWithIgnoreCase(custSearch).toArray(),
    [custSearch]
  );

  const addToCart = useCallback((product: LocalProduct) => {
    soundService.playBeep();
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearchTerm('');
    toast.success(`${product.name} added`, { id: 'scan-success', duration: 1000 });
  }, []);

  const cartSubtotal = cart.reduce((sum, item) => {
    const { finalPrice } = calculateEffectiveDiscount(item.product);
    return sum + (finalPrice * item.quantity);
  }, 0);
  const discountedSubtotal = Math.max(0, cartSubtotal - discount);
  let finalTotal = discountedSubtotal;
  let taxAmount = 0;

  if (taxConfig.rate > 0) {
    if (taxConfig.inclusive) {
      taxAmount = discountedSubtotal - (discountedSubtotal / (1 + (taxConfig.rate / 100)));
    } else {
      taxAmount = discountedSubtotal * (taxConfig.rate / 100);
      finalTotal = discountedSubtotal + taxAmount;
    }
  }

  const changeDue = Math.max(0, (parseFloat(amountReceived) || 0) - finalTotal);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (paymentMode === 'Credit' && !selectedCustomerId) {
      toast.error('Customer required for credit sale');
      setIsAddingCustomer(true);
      setShowCustomerSelector(true);
      return;
    }

    const paid = paymentMode === 'Cash' ? (parseFloat(amountReceived) || finalTotal) : finalTotal;
    
    try {
      const invoiceNo = generateInvoiceNo();
      const itemsCount = cart.reduce((s, i) => s + i.quantity, 0);
      const saleItems: LocalSaleItem[] = cart.map(item => {
        const { finalPrice } = calculateEffectiveDiscount(item.product);
        return {
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.sellPrice,
          discount: 0,
          lineTotal: finalPrice * item.quantity,
          profit: (finalPrice - (item.product.costPrice || 0)) * item.quantity
        };
      });

      const saleData: LocalSale = {
        id: crypto.randomUUID(),
        invoiceNo,
        items: saleItems,
        subtotal: cartSubtotal,
        discount,
        tax: taxAmount,
        total: finalTotal,
        paid,
        changeDue,
        paymentMode,
        itemsCount,
        createdAt: new Date().toISOString(),
        synced: 0,
        bankName,
        accountNumber,
        amountReceived: parseFloat(amountReceived) || paid,
        customerId: selectedCustomerId || undefined
      };

      await db.salesQueue.add(saleData);

      let customerName = undefined;
      if (selectedCustomerId) {
        const customer = await db.customers.get(selectedCustomerId);
        if (customer) {
          customerName = customer.name;
          await db.customers.update(selectedCustomerId, {
            balance: customer.balance + (paymentMode === 'Credit' ? finalTotal : 0),
            updatedAt: new Date().toISOString(),
            synced: 0
          });
        }
      }

      soundService.playSaleComplete();
      
      setShowReceipt({
        items: cart,
        total: finalTotal,
        subtotal: cartSubtotal,
        discount,
        tax: taxAmount,
        invoiceNo,
        date: new Date().toISOString(),
        mode: paymentMode,
        customerName,
        paid,
        change: changeDue,
        bankName,
        accountNumber,
        customerId: selectedCustomerId || undefined,
        signature: signature || undefined
      });

      setCart([]);
      setSelectedCustomerId(null);
      setAmountReceived('');
      setBankName('');
      setAccountNumber('');
      setDiscount(0);
      setSignature(null);
      toast.success('Sale Completed!');
      
      if (printReceipt) setTimeout(() => window.print(), 800);
    } catch (err) {
      console.error(err);
      toast.error('Checkout failed');
    }
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

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name || !custForm.phone) return;
    try {
      const id = crypto.randomUUID();
      const newCustomer: LocalCustomer = {
        ...custForm,
        id,
        idNumber: custForm.idNumber.toUpperCase(),
        balance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: 0
      };
      await db.customers.add(newCustomer);
      setSelectedCustomerId(id);
      setIsAddingCustomer(false);
      setCustForm({ name: '', phone: '', idNumber: '', village: '', livePhoto: '', fingerprintData: '' });
      toast.success('Customer added');
    } catch { toast.error('Failed to add customer'); }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-surface-bg overflow-hidden relative">
      <AnimatePresence>
        {showScanner && (
          <BarcodeScanner 
            onScan={async (sku) => {
              const p = await db.products.where('sku').equals(sku).first();
              if (p) { addToCart(p); setShowScanner(false); }
              else toast.error('SKU Not Found');
            }}
            onClose={() => setShowScanner(false)}
          />
        )}

        {showCustomerSelector && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col border border-surface-border overflow-hidden">
              <div className="p-8 border-b border-surface-border">
                <h3 className="text-xl font-black uppercase mb-4">Attach Customer</h3>
                {!isAddingCustomer ? (
                  <div className="space-y-4">
                    <input title="Search Customers" aria-label="Search Customers" placeholder="Search..." className="input-field w-full" value={custSearch} onChange={e => setCustSearch(e.target.value)} />
                    <button type="button" title="Add New Customer" aria-label="Add New Customer" onClick={() => setIsAddingCustomer(true)} className="w-full py-4 bg-primary-500/10 text-primary-500 rounded-2xl font-black uppercase">New Customer</button>
                  </div>
                ) : (
                  <button type="button" title="Go Back" aria-label="Go Back" onClick={() => setIsAddingCustomer(false)} className="text-xs font-black uppercase text-primary-500">← Back</button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {isAddingCustomer ? (
                  <form onSubmit={handleQuickAddCustomer} className="space-y-4">
                    <input required title="Full Name" aria-label="Full Name" placeholder="Name" className="input-field w-full" value={custForm.name} onChange={e => setCustForm({...custForm, name: e.target.value})} />
                    <input required title="Phone Number" aria-label="Phone Number" placeholder="Phone" className="input-field w-full" value={custForm.phone} onChange={e => setCustForm({...custForm, phone: restrictPhone(e.target.value)})} />
                    <button type="submit" title="Save Customer Profile" aria-label="Save Customer Profile" className="w-full btn-primary !py-4">Save Profile</button>
                  </form>
                ) : (
                  <div className="space-y-2">
                    {customers?.map(c => (
                      <button key={c.id} type="button" title={`Select ${c.name}`} aria-label={`Select ${c.name}`} onClick={() => { setSelectedCustomerId(c.id); setShowCustomerSelector(false); }} className="w-full p-4 flex justify-between items-center border border-surface-border rounded-xl">
                        <span className="font-bold uppercase">{c.name}</span>
                        <ChevronRight className="w-4 h-4 opacity-20" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" title="Close Selector" aria-label="Close Selector" onClick={() => setShowCustomerSelector(false)} className="p-4 uppercase font-black text-[10px]">Close</button>
            </motion.div>
          </motion.div>
        )}

        {showReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card max-w-lg w-full p-8 rounded-3xl flex flex-col items-center border border-surface-border">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-6 border-2 border-emerald-500/20"><CheckCircle2 className="w-8 h-8" /></div>
              <h2 className="text-2xl font-black mb-2 uppercase">Success</h2>
              <p className="text-[10px] font-black opacity-40 uppercase mb-8">Ref: {showReceipt.invoiceNo}</p>
              <div id="print-container" className="w-full bg-white rounded-2xl overflow-hidden mb-8 p-4 max-h-[40vh] overflow-y-auto flex justify-center border border-zinc-100">
                <div id="receipt-content">
                  <Receipt {...showReceipt} />
                </div>
              </div>
              <div className="flex gap-3 w-full">
                <button type="button" title="Print Receipt" aria-label="Print Receipt" onClick={() => window.print()} className="flex-1 py-4 bg-surface-bg rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 border border-surface-border uppercase"><Printer className="w-4 h-4" /> Print</button>
                <button 
                  type="button"
                  title="Share Transaction"
                  aria-label="Share Transaction"
                  onClick={async () => {
                    toast.loading('Sharing...', { id: 'share' });
                    const el = document.getElementById('receipt-content');
                    if (el) {
                      try {
                        const dataUrl = await h2i.toPng(el, { backgroundColor: '#fff', pixelRatio: 2 });
                        const blob = await (await fetch(dataUrl)).blob();
                        const file = new File([blob], `Receipt.png`, { type: 'image/png' });
                        if (navigator.share && navigator.canShare({ files: [file] })) {
                          await navigator.share({ files: [file], title: 'Receipt' });
                        } else {
                          const a = document.createElement('a'); a.download = 'Receipt.png'; a.href = dataUrl; a.click();
                        }
                        toast.success('Ready!', { id: 'share' });
                      } catch { toast.error('Share failed'); }
                    }
                  }} 
                  className="px-6 py-4 bg-[#25D366] text-white rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 uppercase"
                ><Send className="w-4 h-4" /> Share</button>
              </div>
              <button type="button" title="New Sale" aria-label="New Sale" onClick={() => setShowReceipt(null)} className="w-full mt-4 btn-primary !py-5 font-black uppercase text-[10px]">New Sale</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col bg-surface-bg overflow-y-auto custom-scrollbar">
        <header className="px-4 md:px-8 py-6 border-b border-surface-border bg-surface-card sticky top-0 z-40">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20 w-5 h-5" />
              <input title="Search Inventory" aria-label="Search Inventory" placeholder="Search Products..." className="input-field w-full pl-14 h-16 font-black uppercase" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button type="button" title="Scan Barcode" aria-label="Scan Barcode" onClick={() => setShowScanner(true)} className="w-16 h-16 bg-primary-500 text-white rounded-2xl flex items-center justify-center"><Scan className="w-6 h-6" /></button>
            <button type="button" title="Sync Offline Data" aria-label="Sync Offline Data" onClick={async () => { setIsSyncing(true); await SyncService.pushSales(); setIsSyncing(false); toast.success('Synced'); }} className={clsx("w-16 h-16 bg-surface-card border border-surface-border rounded-2xl text-primary-500 flex items-center justify-center", isSyncing && "animate-spin")}><RefreshCw className="w-6 h-6" /></button>
          </div>
        </header>

        <main className="p-4 md:p-8 space-y-8 overflow-x-hidden">
          {searchTerm.length >= 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence>
                {products?.map(p => (
                  <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} key={p.id} onClick={() => addToCart(p)} className="p-6 cursor-pointer bg-surface-card border border-surface-border rounded-3xl flex flex-col gap-3 hover:border-primary-500/20 shadow-sm transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-surface-bg rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">{p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <PackageSearch className="opacity-10" />}</div>
                      <div className="font-black uppercase text-sm leading-tight">{toSentenceCase(p.name)}</div>
                    </div>
                    <div className="pt-3 border-t border-surface-border/30">
                      <div className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-1">Retail Price</div>
                      <div className="font-black text-primary-500 text-lg">MK {p.sellPrice.toLocaleString()}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <div className="pb-40">
            <h2 className="text-xl font-black uppercase flex items-center gap-3 mb-8"><ShoppingCart className="w-6 h-6 text-primary-500" /> Cart</h2>
            {cart.length === 0 ? (
              <div className="py-32 flex flex-col items-center border-2 border-dashed border-surface-border rounded-[3rem] opacity-20 uppercase font-black text-[10px]">Cart is empty</div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {cart.map(item => (
                    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} key={item.product.id} className="p-4 md:p-6 bg-surface-card border border-surface-border rounded-[2rem] flex items-center justify-between">
                      <div className="flex items-center gap-6">
                         <div className="w-16 h-16 bg-surface-bg rounded-2xl flex items-center justify-center">{item.product.imageUrl ? <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover rounded-2xl" /> : <PackageSearch className="opacity-10" />}</div>
                         <div className="font-black uppercase">{toSentenceCase(item.product.name)}</div>
                      </div>
                      <div className="flex items-center gap-8">
                         <div className="flex items-center gap-4">
                           <button type="button" title="Decrease Quantity" aria-label="Decrease Quantity" onClick={() => setCart(prev => prev.map(i => i.product.id === item.product.id ? {...i, quantity: Math.max(1, i.quantity - 1)} : i))} className="w-10 h-10 border border-surface-border rounded-xl flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                           <span className="font-black text-xl">{item.quantity}</span>
                           <button type="button" title="Increase Quantity" aria-label="Increase Quantity" onClick={() => addToCart(item.product)} className="w-10 h-10 border border-surface-border rounded-xl flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                         </div>
                         <div className="text-right w-32 font-black text-xl text-primary-500">MK {(item.product.sellPrice * item.quantity).toLocaleString()}</div>
                         <button type="button" title="Remove Item" aria-label="Remove Item" onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))} className="text-red-500"><X className="w-6 h-6" /></button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <div className="mt-8 p-6 md:p-10 bg-surface-card border border-surface-border rounded-[3rem] space-y-8 shadow-xl">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase opacity-40">Payment Method</label>
                    <div className="flex flex-wrap gap-2">
                      {(['Cash', 'Card', 'Momo', 'Credit'] as const).map(id => {
                        const m = {
                          Cash: { icon: Wallet, label: 'Cash' },
                          Card: { icon: CreditCard, label: 'Bank' },
                          Momo: { icon: Smartphone, label: 'MoMo' },
                          Credit: { icon: Users, label: 'Credit' }
                        }[id];
                        return (
                          <button key={id} type="button" title={`Pay via ${m.label}`} aria-label={`Pay via ${m.label}`} onClick={() => setPaymentMode(id)} className={clsx("px-6 py-3 rounded-xl border flex items-center gap-3 transition-all", paymentMode === id ? "bg-primary-500 text-white border-transparent" : "bg-surface-bg border-surface-border opacity-40")}>
                            <m.icon className="w-4 h-4" /> <span className="text-[9px] font-black uppercase">{m.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-surface-border/30">
                    {paymentMode === 'Cash' ? (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-40">Cash Received (MK)</label>
                        <input title="Amount Received" aria-label="Amount Received" type="number" className="input-field w-full text-2xl h-16 px-6 font-black" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} />
                      </div>
                    ) : (paymentMode === 'Card' || paymentMode === 'Momo') ? (
                      <>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase opacity-40">{paymentMode === 'Card' ? 'Select Bank' : 'Select Provider'}</label>
                          <select title="Payment Provider" aria-label="Payment Provider" className="input-field w-full h-16 px-6 font-black uppercase" value={bankName} onChange={e => setBankName(e.target.value)}>
                            <option value="">Choose...</option>
                            {(paymentMode === 'Card' ? paymentConfig.bank : paymentConfig.momo).split(',').map(p => (
                              <option key={p.trim()} value={p.trim()}>{p.trim()}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase opacity-40">Ref #</label>
                          <input title="Reference Number" aria-label="Reference Number" className="input-field w-full h-16 px-6 font-black uppercase" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="pt-8 border-t border-surface-border/30">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-[10px] font-black uppercase opacity-40">Authorization Signature</label>
                      <button type="button" title="Reset Signature" aria-label="Reset Signature" onClick={() => { const c = sigCanvasRef.current; if (c) { c.getContext('2d')?.clearRect(0,0,c.width,c.height); setSignature(null); } }} className="text-red-500"><RotateCcw className="w-4 h-4" /></button>
                    </div>
                    <div className="bg-white border-2 border-surface-border rounded-2xl h-32 relative">
                      <canvas ref={sigCanvasRef} width={800} height={200} onMouseDown={startSignature} onTouchStart={startSignature} className="w-full h-full cursor-crosshair touch-none" />
                      {!signature && <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none uppercase font-black text-xs">Sign here</div>}
                    </div>
                  </div>

                    <div className="pt-8 space-y-4 border-t border-surface-border/30">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-40">
                        <span>Subtotal</span>
                        <span>MK {cartSubtotal.toLocaleString()}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-rose-500">
                          <span>Discount</span>
                          <span>- MK {discount.toLocaleString()}</span>
                        </div>
                      )}
                      {taxConfig.rate > 0 && (
                        <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-40">
                          <span>Tax ({taxConfig.rate}% {taxConfig.inclusive ? 'Incl.' : 'Excl.'})</span>
                          <span>MK {taxAmount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-8 border-t border-surface-border/30">
                      <div className="flex items-center gap-8">
                         <div className="flex flex-col"><span className="text-[10px] font-black opacity-30 uppercase">Total Payable</span><span className="text-4xl font-black text-primary-500">MK {finalTotal.toLocaleString()}</span></div>
                       <div className="flex items-center gap-3 bg-surface-bg/50 px-4 py-2 rounded-xl border border-surface-border/50">
                        <input type="checkbox" id="printReceipt" checked={printReceipt} onChange={e => setPrintReceipt(e.target.checked)} className="w-5 h-5 text-primary-500" />
                        <label htmlFor="printReceipt" className="text-[10px] font-black uppercase cursor-pointer">Print Receipt</label>
                      </div>
                    </div>
                     <button 
                       type="button" 
                       title="Finalize Sale" 
                       aria-label="Finalize Sale" 
                       onClick={handleCheckout} 
                       className={clsx(
                         "w-full md:w-80 h-16 rounded-2xl font-black text-lg uppercase shadow-xl transition-all active:scale-95",
                         paymentMode === 'Credit' 
                           ? "bg-amber-500 text-white shadow-amber-500/20" 
                           : "bg-primary-500 text-white shadow-primary-500/20"
                       )}
                     >
                       {paymentMode === 'Credit' && !selectedCustomerId ? 'Add Customer Detail' : 'Complete Sale'}
                     </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default POSPage;
