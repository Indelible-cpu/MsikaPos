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
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('pos_active_transaction');
    if (saved) {
      const data = JSON.parse(saved);
      setCart(data.cart || []);
      setPaymentMode(data.paymentMode || 'Cash');
      setAmountReceived(data.amountReceived || '');
      setDiscount(data.discount || 0);
      setSignature(data.signature || null);
      setBankName(data.bankName || '');
      setAccountNumber(data.accountNumber || '');
    }
  }, []);

  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem('pos_active_transaction', JSON.stringify({
        cart, paymentMode, amountReceived, discount, signature, bankName, accountNumber
      }));
    } else {
      localStorage.removeItem('pos_active_transaction');
    }
  }, [cart, paymentMode, amountReceived, discount, signature, bankName, accountNumber]);
  
  const [taxConfig, setTaxConfig] = useState<TaxConfig>({ rate: 0, inclusive: true });
  const [paymentConfig, setPaymentConfig] = useState({ momo: 'TNM Mpamba, Airtel Money', bank: 'National Bank, NBS Bank, Standard Bank' });
  const [printReceipt, setPrintReceipt] = useState(false);
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

  const activeBranchId = parseInt(localStorage.getItem('activeBranchId') || '0') || null;
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const products = useLiveQuery(
    async () => {
      let query: any;
      
      if (searchTerm.length >= 2) {
        // Search by name
        const byName = await db.products
          .where('name')
          .startsWithIgnoreCase(searchTerm)
          .and(p => !p.deleted && (p.branchId === activeBranchId || p.branchId === null))
          .toArray();

        // Search by SKU
        const bySku = await db.products
          .where('sku')
          .equals(searchTerm)
          .and(p => !p.deleted && (p.branchId === activeBranchId || p.branchId === null))
          .toArray();

        // Merge and deduplicate
        const merged = [...byName, ...bySku];
        return Array.from(new Map(merged.map(p => [p.id, p])).values());
      } else {
        // Show recent/default products for this branch
        return await db.products
          .where('updatedAt')
          .reverse()
          .filter(p => !p.deleted && (p.branchId === activeBranchId || p.branchId === null))
          .limit(24)
          .toArray();
      }
    },
    [searchTerm, activeBranchId]
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

  useEffect(() => {
    if (cart.length > 0) {
      const timer = setInterval(() => {
        toast('Finish this transaction before starting another!', { id: 'reminder', icon: '⚠️', duration: 3000 });
      }, 30000); // remind every 30 seconds
      return () => clearInterval(timer);
    }
  }, [cart.length]);

  useEffect(() => {
    if (showSigPad && signature && sigCanvasRef.current) {
      const canvas = sigCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = signature;
      }
    }
  }, [showSigPad]);

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
            items: cart.map(item => {
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
            }),
            subtotal: cartSubtotal,
            discount,
            tax: taxAmount,
            total: finalTotal,
            profit: cart.reduce((s, item) => {
              const { finalPrice } = calculateEffectiveDiscount(item.product);
              return s + ((finalPrice - (item.product.costPrice || 0)) * item.quantity);
            }, 0) - discount,
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

      const totalItemProfit = saleItems.reduce((s, i) => s + i.profit, 0);
      const finalProfit = totalItemProfit - discount;

      const saleData: LocalSale = {
        id: crypto.randomUUID(),
        invoiceNo,
        userId: user.id,
        branchId: activeBranchId,
        items: saleItems,
        subtotal: cartSubtotal,
        discount,
        tax: taxAmount,
        total: finalTotal,
        paid,
        changeDue,
        paymentMode,
        itemsCount,
        profit: finalProfit,
        createdAt: new Date().toISOString(),
        synced: 0,
        status: 'COMPLETED',
        bankName,
        accountNumber,
        amountReceived: parseFloat(amountReceived) || paid,
        customerId: undefined
      };

      await db.salesQueue.add(saleData);

      // Decrement local inventory
      for (const item of cart) {
        if (!item.product.isService) {
          const product = await db.products.get(item.product.id);
          if (product) {
            await db.products.update(item.product.id, {
              quantity: Math.max(0, product.quantity - item.quantity),
              updatedAt: new Date().toISOString()
            });
          }
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
                <h2 className="text-lg font-black capitalize">Success</h2>
                <p className="text-[8px] font-black opacity-40 capitalize tracking-[0.2em]">Ref: {showReceipt.invoiceNo}</p>
              </div>

              <div id="print-container" className="w-full bg-white max-h-[50vh] overflow-y-auto flex justify-center border-y border-border/50">
                <div id="receipt-content">
                  <Receipt {...showReceipt} />
                </div>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center px-2">
                  <button type="button" onClick={() => window.print()} className="text-[10px] font-black capitalize text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors"><Printer className="w-3 h-3" /> Print</button>
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
                    className="text-[10px] font-black capitalize text-[#25D366] flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp Share
                  </button>
                </div>
                <button type="button" onClick={() => setShowReceipt(null)} className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black capitalize text-[10px] btn-press shadow-lg shadow-primary/20">New Sale</button>
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
              <input title="search inventory" aria-label="search inventory" placeholder="search products..." className="input-field w-full pl-12 h-12 text-sm font-black capitalize" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button type="button" title="scan barcode" aria-label="scan barcode" onClick={() => setShowScanner(true)} className="w-12 h-12 flex items-center justify-center shrink-0 btn-press text-primary hover:bg-primary/10 rounded-xl transition-colors"><Scan className="w-6 h-6" /></button>
            <button type="button" title="sync offline data" aria-label="sync offline data" onClick={async () => { setIsSyncing(true); await SyncService.pushSales(); setIsSyncing(false); toast.success('synced'); }} className="w-12 h-12 bg-card/50 border border-border/50 rounded-xl text-primary flex items-center justify-center shrink-0 btn-press transition-colors hover:bg-card/80">
              <RefreshCw className={clsx("w-5 h-5", isSyncing && "animate-spin")} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar stagger-children">
          <div className="flex justify-between items-center px-2">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
               {searchTerm.length >= 2 ? `Search Results for "${searchTerm}"` : 'Recent Products'}
             </h3>
             <span className="text-[8px] font-black uppercase tracking-widest bg-primary/10 text-primary px-3 py-1 rounded-full">
               {products?.length || 0} Items
             </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {products?.map(p => (
                <motion.div 
                  layout 
                  initial={{ opacity: 0, scale: 0.9 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={p.id} 
                  onClick={() => addToCart(p)} 
                  className="p-4 cursor-pointer glass-card border border-border/50 rounded-3xl flex flex-row md:flex-col items-center md:items-stretch gap-4 hover:border-primary/20 shadow-sm transition-all group hover-lift active:scale-95"
                >
                  <div className="w-20 h-20 md:w-full md:h-auto md:aspect-square bg-muted/20 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 border border-border/50">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <PackageSearch className="text-muted-foreground/20 w-8 h-8 md:w-10 md:h-10" />
                    )}
                  </div>
                  <div className="space-y-1 md:space-y-2 flex-1">
                    <div className="font-black capitalize text-[11px] leading-tight line-clamp-2 min-h-[2.4em]">{toSentenceCase(p.name)}</div>
                    <div className="flex justify-between items-end">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-muted-foreground capitalize tracking-widest">retail price</span>
                        <span className="font-black text-primary text-base md:text-lg leading-none">Mk {p.sellPrice.toLocaleString()}</span>
                      </div>
                      {p.quantity <= 5 && !p.isService && (
                        <span className="text-[7px] font-black text-rose-500 bg-rose-500/10 px-2 py-1 rounded-lg">Low Stock</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {products?.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-20 gap-4">
                 <PackageSearch className="w-16 h-16" />
                 <span className="text-[10px] font-black uppercase tracking-widest">No products found</span>
              </div>
            )}
          </div>
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
            <h2 className="text-xl font-black capitalize flex items-center gap-3"><ShoppingCart className="w-6 h-6 text-primary" /> cart <span className="bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded-lg ml-2">{cart.reduce((a, b) => a + b.quantity, 0)}</span></h2>
            <p className="text-[8px] font-black opacity-30 capitalize tracking-widest">transaction # {currentInvoiceNo}</p>
            {cart.length > 0 && <span className="text-[7px] font-black text-amber-500 animate-pulse">(!) uncompleted transaction</span>}
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
            {cart.length > 0 && <button onClick={() => { toast.error('Complete or clear the current sale first!'); }} className="text-[10px] font-black capitalize text-destructive opacity-40 hover:opacity-100 transition-opacity">Clear All</button>}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10 capitalize font-black text-[10px] tracking-[0.3em] gap-6">
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
                             <div className="font-black capitalize text-[10px] truncate w-32">{toSentenceCase(item.product.name)}</div>
                             <div className="text-[9px] font-black opacity-40">Mk {item.product.sellPrice.toLocaleString()} × {item.quantity}</div>
                           </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] font-black opacity-30 capitalize">subtotal</div>
                          <div className="text-sm font-black text-primary-500 leading-none">Mk {(item.product.sellPrice * item.quantity).toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-surface-border/30">
                        <div className="flex items-center bg-surface-card rounded-lg border border-surface-border">
                          <button type="button" title="decrease quantity" aria-label="decrease quantity" onClick={() => setCart(prev => prev.map(i => i.product.id === item.product.id ? {...i, quantity: Math.max(1, i.quantity - 1)} : i))} className="w-8 h-8 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"><Minus className="w-3 h-3" /></button>
                          <span className="font-black text-xs w-6 text-center">{item.quantity}</span>
                          <button type="button" title="increase quantity" aria-label="increase quantity" onClick={() => addToCart(item.product)} className="w-8 h-8 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"><Plus className="w-3 h-3" /></button>
                        </div>
                        <button type="button" title="remove item" aria-label="remove item" onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))} className="text-rose-500 opacity-60 hover:opacity-100 transition-opacity flex items-center gap-2 text-[8px] font-black capitalize">
                          <X className="w-4 h-4" /> remove
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="pt-8 space-y-4 border-t border-surface-border/50">
                <div className="flex justify-between items-center text-[10px] font-black capitalize opacity-40">
                  <span>subtotal</span>
                  <span>Mk {cartSubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black capitalize text-rose-500">
                  <div className="flex items-center gap-2">
                    <span>discount</span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      className="w-20 bg-rose-500/10 border-none outline-none px-2 py-1 rounded text-rose-500 font-black text-[9px]"
                      value={discount || ''}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                    />
                  </div>
                  <span>- Mk {discount.toLocaleString()}</span>
                </div>
                {taxConfig.rate > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-black capitalize opacity-40">
                    <span>tax ({taxConfig.rate}%)</span>
                    <span>Mk {taxAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 border-t border-border/50">
                  <span className="text-[10px] font-black capitalize opacity-40">total</span>
                  <span className="text-3xl font-black text-primary tracking-tighter">Mk {finalTotal.toLocaleString()}</span>
                </div>
                {paymentMode === 'Cash' && amountReceived && parseFloat(amountReceived) > finalTotal && (
                  <div className="flex justify-between items-center text-[10px] font-black capitalize text-success animate-in fade-in slide-in-from-top-1">
                    <span>change due</span>
                    <span className="font-black">Mk {changeDue.toLocaleString()}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-6 pt-8 border-t border-surface-border/50">
                <div className="flex items-center gap-4">
                  <label className="text-[10px] font-black capitalize opacity-40 shrink-0">payment mode</label>
                  <div className="flex flex-wrap gap-4">
                    {(['Cash', 'Card', 'Momo', 'Credit'] as const).map(id => {
                      const m = { Cash: 'cash', Card: 'bank', Momo: 'momo', Credit: 'credit' }[id];
                      const colorClass = { Cash: 'text-emerald-500 border-emerald-500', Card: 'text-blue-500 border-blue-500', Momo: 'text-amber-500 border-amber-500', Credit: 'text-rose-500 border-rose-500' }[id];
                      return (
                        <button 
                          key={id} 
                          type="button"
                          onClick={() => setPaymentMode(id)} 
                          className={clsx(
                            "text-[10px] font-black capitalize transition-all pb-1 border-b-2", 
                            paymentMode === id ? colorClass : "text-muted-foreground border-transparent opacity-40 hover:opacity-100"
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
                    <label className="text-[10px] font-black capitalize opacity-40 shrink-0">cashier received (Mk)</label>
                    <input 
                      type="number"
                      title="cash received" 
                      className="bg-transparent border-none outline-none text-right text-xl font-black w-full" 
                      placeholder="0.00"
                      value={amountReceived} 
                      onChange={e => setAmountReceived(e.target.value)} 
                      onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                    />
                  </div>
                )}
                {(paymentMode === 'Card' || paymentMode === 'Momo') && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black capitalize opacity-40">{paymentMode === 'Card' ? 'bank' : 'provider'}</label>
                      <select title={paymentMode === 'Card' ? 'select bank' : 'select provider'} className="input-field w-full font-black capitalize" value={bankName} onChange={e => setBankName(e.target.value)}>
                        <option value="">choose...</option>
                        {(paymentMode === 'Card' ? paymentConfig.bank : paymentConfig.momo).split(',').map(p => <option key={p.trim()} value={p.trim()}>{p.trim()}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black capitalize opacity-40">ref #</label>
                      <input title="reference number" placeholder="enter ref #" className="input-field w-full font-black capitalize" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black capitalize opacity-40">signature</label>
                    {showSigPad && (
                      <div className="flex items-center gap-4">
                        <button type="button" onClick={() => { const c = sigCanvasRef.current; if (c) { c.getContext('2d')?.clearRect(0,0,c.width,c.height); setSignature(null); } }} className="text-rose-500 flex items-center gap-1 text-[8px] font-black capitalize"><RotateCcw className="w-3 h-3" /> clear</button>
                        <button type="button" onClick={() => setShowSigPad(false)} className="text-muted-foreground flex items-center gap-1 text-[8px] font-black capitalize"><X className="w-3 h-3" /> close</button>
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
                      <span className="text-[10px] font-black capitalize tracking-[0.2em] text-primary">tap here to sign</span>
                    </button>
                  ) : (
                    <div className="bg-white border border-surface-border rounded-2xl h-32 relative overflow-hidden">
                      <canvas ref={sigCanvasRef} width={800} height={320} onMouseDown={startSignature} onTouchStart={startSignature} className="w-full h-full cursor-crosshair touch-none" />
                      {!signature && <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none capitalize font-black text-[8px] tracking-[0.3em]">sign anywhere in this box</div>}
                    </div>
                  )}
                </div>

                <button 
                  type="button"
                  onClick={() => setPrintReceipt(!printReceipt)}
                  className="flex items-center gap-4 py-4 px-6 bg-surface-bg border border-surface-border rounded-2xl w-full hover:bg-primary/5 transition-all text-left"
                >
                  <div className={clsx("w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all", printReceipt ? "bg-primary border-primary text-white" : "border-surface-border")}>
                    {printReceipt && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                  <span className="text-[10px] font-black capitalize opacity-60">print receipt automatically</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="p-8 border-t border-border/50 bg-card/50">
          <button 
            disabled={cart.length === 0}
            onClick={handleCheckout} 
            className={clsx(
              "w-full h-16 rounded-2xl font-black text-sm capitalize shadow-xl transition-all btn-press flex items-center justify-center gap-3",
              {
                Cash: 'bg-emerald-500 text-white shadow-emerald-500/20',
                Card: 'bg-blue-500 text-white shadow-blue-500/20',
                Momo: 'bg-amber-500 text-white shadow-amber-500/20',
                Credit: 'bg-rose-500 text-white shadow-rose-500/20'
              }[paymentMode],
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
