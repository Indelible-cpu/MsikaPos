import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import type { LocalProduct, LocalSale, LocalSaleItem } from '../db/posDB';
import { toSentenceCase } from '../utils/stringUtils';
import { calculateEffectiveDiscount } from '../utils/discountUtils';
import { 
  Search, 
  ShoppingCart, 
  RefreshCw, 
  Users, 
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
  RotateCcw,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { SyncService } from '../services/SyncService';
import { soundService } from '../services/SoundService';
import clsx from 'clsx';
import * as h2i from 'html-to-image';

import { Receipt } from '../components/Receipt';
import { useNavigate } from 'react-router-dom';
import BarcodeScanner from '../components/BarcodeScanner';

const generateInvoiceNo = () => `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

interface TaxConfig {
  rate: number;
  inclusive: boolean;
}

const POSPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'Momo' | 'Credit'>('Cash');
  const [cart, setCart] = useState<{ product: LocalProduct; quantity: number }[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
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
    
    if (paymentMode === 'Credit') {
      // Navigate to Credit Center with transaction data
      navigate('/staff/debt', { 
        state: { 
          creditSale: {
            items: cart,
            subtotal: cartSubtotal,
            discount,
            tax: taxAmount,
            total: finalTotal,
            invoiceNo: generateInvoiceNo(),
            date: new Date().toISOString()
          } 
        } 
      });
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
        customerId: undefined
      };

      await db.salesQueue.add(saleData);


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
        customerName: undefined,
        paid,
        change: changeDue,
        bankName,
        accountNumber,
        customerId: undefined,
        signature: signature || undefined
      });

      setCart([]);
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


  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden relative">
      <div className="fixed inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />
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


        {showReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="glass-panel max-w-lg w-full p-8 rounded-3xl flex flex-col items-center border border-border/50">
              <div className="w-16 h-16 bg-success/20 text-success rounded-full flex items-center justify-center mb-6 border-2 border-success/20"><CheckCircle2 className="w-8 h-8" /></div>
              <h2 className="text-2xl font-black mb-2 uppercase">Success</h2>
              <p className="text-[10px] font-black opacity-40 uppercase mb-8">Ref: {showReceipt.invoiceNo}</p>
              <div id="print-container" className="w-full bg-white rounded-2xl overflow-hidden mb-8 p-4 max-h-[40vh] overflow-y-auto flex justify-center border border-zinc-100 shadow-inner">
                <div id="receipt-content">
                  <Receipt {...showReceipt} />
                </div>
              </div>
              <div className="flex gap-3 w-full">
                <button type="button" title="Print Receipt" aria-label="Print Receipt" onClick={() => window.print()} className="flex-1 py-4 bg-muted/20 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 border border-border/50 uppercase btn-press"><Printer className="w-4 h-4" /> Print</button>
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
                  className="px-6 py-4 bg-[#25D366] text-white rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 uppercase btn-press"
                ><Send className="w-4 h-4" /> Share</button>
              </div>
              <button type="button" title="New Sale" aria-label="New Sale" onClick={() => setShowReceipt(null)} className="w-full mt-4 btn-primary !py-5 font-black uppercase text-[10px] btn-press">New Sale</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col bg-background overflow-hidden">
        <header className="px-4 md:px-8 py-6 border-b border-border/50 glass-panel sticky top-0 z-40">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input title="Search Inventory" aria-label="Search Inventory" placeholder="Search Products..." className="input-field w-full pl-14 h-16 font-black" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button type="button" title="Scan Barcode" aria-label="Scan Barcode" onClick={() => setShowScanner(true)} className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shrink-0 btn-press shadow-lg shadow-primary/20"><Scan className="w-6 h-6" /></button>
            <button type="button" title="Sync Offline Data" aria-label="Sync Offline Data" onClick={async () => { setIsSyncing(true); await SyncService.pushSales(); setIsSyncing(false); toast.success('Synced'); }} className={clsx("w-16 h-16 bg-card/50 border border-border/50 rounded-2xl text-primary flex items-center justify-center shrink-0 btn-press", isSyncing && "animate-spin")}><RefreshCw className="w-6 h-6" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar stagger-children">
          {searchTerm.length >= 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence>
                {products?.map(p => (
                  <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} key={p.id} onClick={() => addToCart(p)} className="p-4 cursor-pointer glass-card border border-border/50 rounded-3xl flex flex-col gap-4 hover:border-primary/20 shadow-sm transition-all group hover-lift active:scale-95">
                    <div className="w-full aspect-square bg-muted/20 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 border border-border/50">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <PackageSearch className="text-muted-foreground/20 w-10 h-10" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="font-black uppercase text-[11px] leading-tight line-clamp-2 min-h-[2.4em]">{toSentenceCase(p.name)}</div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Retail Price</span>
                        <span className="font-black text-primary text-lg leading-none">MK {p.sellPrice.toLocaleString()}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Cart Sidebar / Bottom Area */}
      <aside className="w-full lg:w-[450px] bg-card/80 backdrop-blur-2xl border-l border-border/50 flex flex-col h-[50vh] lg:h-full shrink-0 shadow-2xl relative z-50">
        <header className="p-8 border-b border-border/50 flex justify-between items-center bg-transparent">
          <h2 className="text-xl font-black uppercase flex items-center gap-3"><ShoppingCart className="w-6 h-6 text-primary" /> Cart <span className="bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded-lg ml-2">{cart.reduce((a, b) => a + b.quantity, 0)}</span></h2>
          {cart.length > 0 && <button onClick={() => setCart([])} className="text-[10px] font-black uppercase text-destructive opacity-40 hover:opacity-100 transition-opacity">Clear All</button>}
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10 uppercase font-black text-[10px] tracking-[0.3em] gap-6">
              <ShoppingCart className="w-20 h-20" />
              Cart is empty
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <AnimatePresence>
                  {cart.map(item => (
                    <motion.div layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key={item.product.id} className="p-4 bg-surface-bg border border-surface-border rounded-2xl flex flex-col gap-4 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-surface-card rounded-xl flex items-center justify-center overflow-hidden shrink-0">{item.product.imageUrl ? <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" /> : <PackageSearch className="opacity-10 w-5 h-5" />}</div>
                           <div>
                             <div className="font-black uppercase text-[10px] truncate w-32">{toSentenceCase(item.product.name)}</div>
                             <div className="text-[9px] font-black opacity-40">MK {item.product.sellPrice.toLocaleString()} × {item.quantity}</div>
                           </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] font-black opacity-30 uppercase">Subtotal</div>
                          <div className="text-sm font-black text-primary-500 leading-none">MK {(item.product.sellPrice * item.quantity).toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-surface-border/30">
                        <div className="flex items-center bg-surface-card rounded-lg border border-surface-border">
                          <button type="button" title="Decrease Quantity" aria-label="Decrease Quantity" onClick={() => setCart(prev => prev.map(i => i.product.id === item.product.id ? {...i, quantity: Math.max(1, i.quantity - 1)} : i))} className="w-8 h-8 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"><Minus className="w-3 h-3" /></button>
                          <span className="font-black text-xs w-6 text-center">{item.quantity}</span>
                          <button type="button" title="Increase Quantity" aria-label="Increase Quantity" onClick={() => addToCart(item.product)} className="w-8 h-8 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"><Plus className="w-3 h-3" /></button>
                        </div>
                        <button type="button" title="Remove Item" aria-label="Remove Item" onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))} className="text-rose-500 opacity-60 hover:opacity-100 transition-opacity flex items-center gap-2 text-[8px] font-black uppercase">
                          <X className="w-4 h-4" /> Remove
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="pt-8 space-y-4 border-t border-surface-border/50">
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
                    <span>Tax ({taxConfig.rate}%)</span>
                    <span>MK {taxAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 border-t border-border/50">
                  <span className="text-[10px] font-black uppercase opacity-40">Total</span>
                  <span className="text-3xl font-black text-primary tracking-tighter">MK {finalTotal.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="space-y-6 pt-8 border-t border-surface-border/50">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase opacity-40">Payment Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Cash', 'Card', 'Momo', 'Credit'] as const).map(id => {
                      const m = { Cash: { icon: Wallet, label: 'Cash' }, Card: { icon: CreditCard, label: 'Bank' }, Momo: { icon: Smartphone, label: 'MoMo' }, Credit: { icon: Users, label: 'Credit' } }[id];
                      return (
                        <button key={id} onClick={() => setPaymentMode(id)} className={clsx("p-4 rounded-xl border flex items-center gap-3 transition-all btn-press", paymentMode === id ? "bg-primary text-primary-foreground border-transparent shadow-lg shadow-primary/20" : "bg-muted/10 border-border/50 opacity-40 hover:opacity-100")}>
                          <m.icon className="w-4 h-4" /> <span className="text-[9px] font-black uppercase">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {paymentMode === 'Cash' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase opacity-40">Cash Received (MK)</label>
                    <input title="Cash Received" className="input-field w-full text-xl font-black" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} />
                  </div>
                ) : (paymentMode === 'Card' || paymentMode === 'Momo') ? (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase opacity-40">{paymentMode === 'Card' ? 'Bank' : 'Provider'}</label>
                      <select title={paymentMode === 'Card' ? 'Select Bank' : 'Select Provider'} className="input-field w-full font-black uppercase" value={bankName} onChange={e => setBankName(e.target.value)}>
                        <option value="">Choose...</option>
                        {(paymentMode === 'Card' ? paymentConfig.bank : paymentConfig.momo).split(',').map(p => <option key={p.trim()} value={p.trim()}>{p.trim()}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase opacity-40">Ref #</label>
                      <input title="Reference Number" placeholder="Enter Ref #" className="input-field w-full font-black uppercase" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase opacity-40">Signature</label>
                    <button type="button" title="Reset Signature" aria-label="Reset Signature" onClick={() => { const c = sigCanvasRef.current; if (c) { c.getContext('2d')?.clearRect(0,0,c.width,c.height); setSignature(null); } }} className="text-rose-500 hover:rotate-180 transition-transform duration-500"><RotateCcw className="w-4 h-4" /></button>
                  </div>
                  <div className="bg-white border border-surface-border rounded-2xl h-24 relative overflow-hidden">
                    <canvas ref={sigCanvasRef} width={800} height={200} onMouseDown={startSignature} onTouchStart={startSignature} className="w-full h-full cursor-crosshair touch-none" />
                    {!signature && <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none uppercase font-black text-[8px] tracking-[0.3em]">Sign to confirm</div>}
                  </div>
                </div>

                <div className="flex items-center gap-4 py-4 px-6 bg-surface-bg border border-surface-border rounded-2xl">
                  <input type="checkbox" id="printReceipt" checked={printReceipt} onChange={e => setPrintReceipt(e.target.checked)} className="w-5 h-5 rounded-lg border-surface-border text-primary-500 focus:ring-primary-500" />
                  <label htmlFor="printReceipt" className="text-[10px] font-black uppercase cursor-pointer opacity-60">Print Receipt Automatically</label>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-8 border-t border-border/50 bg-card/50">
          <button 
            disabled={cart.length === 0}
            onClick={handleCheckout} 
            className={clsx(
              "w-full h-16 rounded-2xl font-black text-sm uppercase shadow-xl transition-all btn-press flex items-center justify-center gap-3",
              paymentMode === 'Credit' ? "bg-amber-500 text-white shadow-amber-500/20" : "bg-primary text-primary-foreground shadow-lg shadow-primary/20",
              cart.length === 0 && "opacity-50 grayscale cursor-not-allowed"
            )}
          >
            {paymentMode === 'Credit' ? 'Add To Customer' : 'Complete Sale'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </div>
  );
};

export default POSPage;
