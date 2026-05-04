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
  Plus, 
  Minus, 
  PackageSearch, 
  Scan, 
  Printer,
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
  const [showSigPad, setShowSigPad] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [taxConfig, setTaxConfig] = useState<TaxConfig>({ rate: 0, inclusive: true });
  const [paymentConfig, setPaymentConfig] = useState({ momo: 'TNM Mpamba, Airtel Money', bank: 'National Bank, NBS Bank, Standard Bank' });
  const [printReceipt, setPrintReceipt] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const currentInvoiceNo = React.useMemo(() => generateInvoiceNo(), [cart.length === 0]);

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
      const invoiceNo = currentInvoiceNo;
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
      setShowSigPad(false);
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
    
    ctx.lineWidth = 3; 
    ctx.lineCap = 'round'; 
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const getPos = (ev: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
      const clientX = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const clientY = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const pos = getPos(e);
    ctx.beginPath(); 
    ctx.moveTo(pos.x, pos.y);

    const draw = (me: MouseEvent | TouchEvent) => {
      if ('touches' in me) me.preventDefault();
      const mPos = getPos(me);
      ctx.lineTo(mPos.x, mPos.y); 
      ctx.stroke();
    };

    const stop = () => {
      window.removeEventListener('mousemove', draw as EventListener); 
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', draw as EventListener); 
      window.removeEventListener('touchend', stop);
      setSignature(canvas.toDataURL());
    };

    window.addEventListener('mousemove', draw as EventListener); 
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', draw as EventListener, { passive: false }); 
    window.addEventListener('touchend', stop);
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
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="glass-panel max-w-sm w-full p-0 rounded-3xl overflow-hidden flex flex-col border border-border/50">
              <div className="p-6 pb-2 flex flex-col items-center">
                <div className="w-12 h-12 bg-success/20 text-success rounded-full flex items-center justify-center mb-3 border-2 border-success/20"><CheckCircle2 className="w-6 h-6" /></div>
                <h2 className="text-lg font-black uppercase">Success</h2>
                <p className="text-[8px] font-black opacity-40 uppercase tracking-[0.2em]">Ref: {showReceipt.invoiceNo}</p>
              </div>

              <div id="print-container" className="w-full bg-white max-h-[50vh] overflow-y-auto flex justify-center border-y border-border/50">
                <div id="receipt-content">
                  <Receipt {...showReceipt} />
                </div>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center px-2">
                  <button type="button" onClick={() => window.print()} className="text-[10px] font-black uppercase text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors"><Printer className="w-3 h-3" /> Print</button>
                  <button 
                    type="button"
                    onClick={async () => {
                      toast.loading('Sharing...', { id: 'share' });
                      const el = document.getElementById('receipt-content');
                      if (el) {
                        try {
                          const dataUrl = await h2i.toPng(el, { 
                            backgroundColor: '#fff', 
                            pixelRatio: 3,
                            style: { padding: '20px', margin: '0' }
                          });
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
                    className="text-[10px] font-black uppercase text-[#25D366] flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp Share
                  </button>
                </div>
                <button type="button" onClick={() => setShowReceipt(null)} className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase text-[10px] btn-press shadow-lg shadow-primary/20">New Sale</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col bg-background overflow-hidden">
        <header className="px-4 md:px-8 py-4 border-b border-border/50 glass-panel sticky top-0 z-40">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input title="search inventory" aria-label="search inventory" placeholder="search products..." className="input-field w-full pl-12 h-12 text-sm font-black lowercase" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button type="button" title="scan barcode" aria-label="scan barcode" onClick={() => setShowScanner(true)} className="w-12 h-12 flex items-center justify-center shrink-0 btn-press text-primary hover:bg-primary/10 rounded-xl transition-colors"><Scan className="w-6 h-6" /></button>
            <button type="button" title="sync offline data" aria-label="sync offline data" onClick={async () => { setIsSyncing(true); await SyncService.pushSales(); setIsSyncing(false); toast.success('synced'); }} className="w-12 h-12 bg-card/50 border border-border/50 rounded-xl text-primary flex items-center justify-center shrink-0 btn-press transition-colors hover:bg-card/80">
              <RefreshCw className={clsx("w-5 h-5", isSyncing && "animate-spin")} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar stagger-children">
          {searchTerm.length >= 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence>
                {products?.map(p => (
                  <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} key={p.id} onClick={() => addToCart(p)} className="p-4 cursor-pointer glass-card border border-border/50 rounded-3xl flex flex-row md:flex-col items-center md:items-stretch gap-4 hover:border-primary/20 shadow-sm transition-all group hover-lift active:scale-95">
                    <div className="w-20 h-20 md:w-full md:h-auto md:aspect-square bg-muted/20 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 border border-border/50">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <PackageSearch className="text-muted-foreground/20 w-8 h-8 md:w-10 md:h-10" />
                      )}
                    </div>
                    <div className="space-y-1 md:space-y-2 flex-1">
                      <div className="font-black lowercase text-[11px] leading-tight line-clamp-2 min-h-[2.4em]">{toSentenceCase(p.name)}</div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-muted-foreground lowercase tracking-widest">retail price</span>
                        <span className="font-black text-primary text-base md:text-lg leading-none">mk {p.sellPrice.toLocaleString()}</span>
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
      <aside className={clsx(
        "w-full lg:w-[450px] bg-card/80 backdrop-blur-2xl border-l border-border/50 flex flex-col shrink-0 shadow-2xl relative z-50 transition-all duration-500 ease-in-out",
        cart.length > 0 ? "h-[85vh]" : "h-[50vh]",
        "lg:h-full"
      )}>
        <header className="p-8 border-b border-border/50 flex justify-between items-center bg-transparent">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-black lowercase flex items-center gap-3"><ShoppingCart className="w-6 h-6 text-primary" /> cart <span className="bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded-lg ml-2">{cart.reduce((a, b) => a + b.quantity, 0)}</span></h2>
            <p className="text-[8px] font-black opacity-30 lowercase tracking-widest">transaction # {currentInvoiceNo}</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              type="button"
              title="Expand Cart"
              aria-label="Expand Cart"
              onClick={() => {
                const aside = document.querySelector('aside');
                if (aside) {
                  if (aside.classList.contains('h-[85vh]')) {
                    aside.classList.remove('h-[85vh]');
                    aside.classList.add('h-[100vh]');
                  } else if (aside.classList.contains('h-[100vh]')) {
                    aside.classList.remove('h-[100vh]');
                    aside.classList.add('h-[50vh]');
                  } else {
                    aside.classList.remove('h-[50vh]');
                    aside.classList.add('h-[85vh]');
                  }
                }
              }} 
              className="lg:hidden p-2 bg-primary/10 text-primary rounded-lg btn-press"
            >
              <RotateCcw className="w-4 h-4 rotate-90" />
            </button>
            {cart.length > 0 && <button onClick={() => setCart([])} className="text-[10px] font-black uppercase text-destructive opacity-40 hover:opacity-100 transition-opacity">Clear All</button>}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10 lowercase font-black text-[10px] tracking-[0.3em] gap-6">
              <ShoppingCart className="w-20 h-20" />
              cart is empty
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
                             <div className="font-black lowercase text-[10px] truncate w-32">{toSentenceCase(item.product.name)}</div>
                             <div className="text-[9px] font-black opacity-40">mk {item.product.sellPrice.toLocaleString()} × {item.quantity}</div>
                           </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] font-black opacity-30 lowercase">subtotal</div>
                          <div className="text-sm font-black text-primary-500 leading-none">mk {(item.product.sellPrice * item.quantity).toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-surface-border/30">
                        <div className="flex items-center bg-surface-card rounded-lg border border-surface-border">
                          <button type="button" title="decrease quantity" aria-label="decrease quantity" onClick={() => setCart(prev => prev.map(i => i.product.id === item.product.id ? {...i, quantity: Math.max(1, i.quantity - 1)} : i))} className="w-8 h-8 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"><Minus className="w-3 h-3" /></button>
                          <span className="font-black text-xs w-6 text-center">{item.quantity}</span>
                          <button type="button" title="increase quantity" aria-label="increase quantity" onClick={() => addToCart(item.product)} className="w-8 h-8 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"><Plus className="w-3 h-3" /></button>
                        </div>
                        <button type="button" title="remove item" aria-label="remove item" onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))} className="text-rose-500 opacity-60 hover:opacity-100 transition-opacity flex items-center gap-2 text-[8px] font-black lowercase">
                          <X className="w-4 h-4" /> remove
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="pt-8 space-y-4 border-t border-surface-border/50">
                <div className="flex justify-between items-center text-[10px] font-black lowercase opacity-40">
                  <span>subtotal</span>
                  <span>mk {cartSubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black lowercase text-rose-500">
                  <div className="flex items-center gap-2">
                    <span>discount</span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      className="w-20 bg-rose-500/10 border-none outline-none px-2 py-1 rounded text-rose-500 font-black text-[9px]"
                      value={discount || ''}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <span>- mk {discount.toLocaleString()}</span>
                </div>
                {taxConfig.rate > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-black lowercase opacity-40">
                    <span>tax ({taxConfig.rate}%)</span>
                    <span>mk {taxAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 border-t border-border/50">
                  <span className="text-[10px] font-black lowercase opacity-40">total</span>
                  <span className="text-3xl font-black text-primary tracking-tighter">mk {finalTotal.toLocaleString()}</span>
                </div>
                {paymentMode === 'Cash' && amountReceived && parseFloat(amountReceived) > finalTotal && (
                  <div className="flex justify-between items-center text-[10px] font-black lowercase text-success animate-in fade-in slide-in-from-top-1">
                    <span>change due</span>
                    <span className="font-black">mk {changeDue.toLocaleString()}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-6 pt-8 border-t border-surface-border/50">
                <div className="space-y-4">
                  <label className="text-[10px] font-black lowercase opacity-40">payment mode</label>
                  <div className="flex flex-wrap gap-5 px-2">
                    {(['Cash', 'Card', 'Momo', 'Credit'] as const).map(id => {
                      const m = { Cash: 'cash', Card: 'bank', Momo: 'momo', Credit: 'credit' }[id];
                      return (
                        <button 
                          key={id} 
                          type="button"
                          onClick={() => setPaymentMode(id)} 
                          className={clsx(
                            "text-[10px] font-black lowercase transition-all pb-1 border-b-2", 
                            paymentMode === id ? "text-primary border-primary" : "text-muted-foreground border-transparent opacity-40 hover:opacity-100"
                          )}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {paymentMode === 'Cash' && (
                  <div className="flex items-center justify-between gap-4 p-4 bg-muted/5 rounded-2xl border border-border/50">
                    <label className="text-[10px] font-black lowercase opacity-40 shrink-0">cashier received (mk)</label>
                    <input 
                      title="cash received" 
                      className="bg-transparent border-none outline-none text-right text-xl font-black w-full" 
                      placeholder="0.00"
                      value={amountReceived} 
                      onChange={e => setAmountReceived(e.target.value)} 
                    />
                  </div>
                )}
                {(paymentMode === 'Card' || paymentMode === 'Momo') && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black lowercase opacity-40">{paymentMode === 'Card' ? 'bank' : 'provider'}</label>
                      <select title={paymentMode === 'Card' ? 'select bank' : 'select provider'} className="input-field w-full font-black lowercase" value={bankName} onChange={e => setBankName(e.target.value)}>
                        <option value="">choose...</option>
                        {(paymentMode === 'Card' ? paymentConfig.bank : paymentConfig.momo).split(',').map(p => <option key={p.trim()} value={p.trim()}>{p.trim()}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black lowercase opacity-40">ref #</label>
                      <input title="reference number" placeholder="enter ref #" className="input-field w-full font-black lowercase" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black lowercase opacity-40">signature</label>
                    {showSigPad && (
                      <div className="flex items-center gap-4">
                        <button type="button" onClick={() => { const c = sigCanvasRef.current; if (c) { c.getContext('2d')?.clearRect(0,0,c.width,c.height); setSignature(null); } }} className="text-rose-500 flex items-center gap-1 text-[8px] font-black lowercase"><RotateCcw className="w-3 h-3" /> clear</button>
                        <button type="button" onClick={() => setShowSigPad(false)} className="text-muted-foreground flex items-center gap-1 text-[8px] font-black lowercase"><X className="w-3 h-3" /> close</button>
                      </div>
                    )}
                  </div>
                  {!showSigPad ? (
                    <button 
                      type="button" 
                      onClick={() => setShowSigPad(true)}
                      className="w-full py-6 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-primary/5 transition-all group btn-press"
                    >
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><CheckCircle2 className="w-6 h-6" /></div>
                      <span className="text-[10px] font-black lowercase tracking-[0.2em] text-primary">tap here to sign</span>
                    </button>
                  ) : (
                    <div className="bg-white border border-surface-border rounded-2xl h-32 relative overflow-hidden">
                      <canvas ref={sigCanvasRef} width={800} height={320} onMouseDown={startSignature} onTouchStart={startSignature} className="w-full h-full cursor-crosshair touch-none" />
                      {!signature && <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none lowercase font-black text-[8px] tracking-[0.3em]">sign anywhere in this box</div>}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 py-4 px-6 bg-surface-bg border border-surface-border rounded-2xl">
                  <input type="checkbox" id="printReceipt" checked={printReceipt} onChange={e => setPrintReceipt(e.target.checked)} className="w-5 h-5 rounded-lg border-surface-border text-primary-500 focus:ring-primary-500" />
                  <label htmlFor="printReceipt" className="text-[10px] font-black lowercase cursor-pointer opacity-60">print receipt automatically</label>
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
              "w-full h-16 rounded-2xl font-black text-sm lowercase shadow-xl transition-all btn-press flex items-center justify-center gap-3",
              paymentMode === 'Credit' ? "bg-amber-500 text-white shadow-amber-500/20" : "bg-primary text-primary-foreground shadow-lg shadow-primary/20",
              cart.length === 0 && "opacity-50 grayscale cursor-not-allowed"
            )}
          >
            {paymentMode === 'Credit' ? 'add to customer' : 'complete sale'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </div>
  );
};

export default POSPage;
