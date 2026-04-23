import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import type { LocalProduct } from '../db/posDB';
import { Search, ShoppingCart, Power, RefreshCw, Users, ChevronRight, Plus, Minus, Trash2, X, Fingerprint, PackageSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { SyncService } from '../services/SyncService';
import { soundService } from '../services/SoundService';
import clsx from 'clsx';

import { Receipt } from '../components/Receipt';
import { Invoice } from '../components/Invoice';

const generateInvoiceNo = () => `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

const POSPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'CREDIT'>('CASH');
  const [cart, setCart] = useState<{ product: LocalProduct; quantity: number }[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [showMobileCart, setShowMobileCart] = useState(false);

  const [showReceipt, setShowReceipt] = useState<{
    items: { product: LocalProduct; quantity: number }[];
    total: number;
    invoiceNo: string;
    date: string;
    mode: 'CASH' | 'CREDIT';
    customerName?: string;
  } | null>(null);

  const products = useLiveQuery(
    () => searchTerm.length >= 2 
      ? db.products.where('name').startsWithIgnoreCase(searchTerm).toArray()
      : Promise.resolve([]),
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
        if (existing.quantity >= product.quantity) {
          soundService.playError();
          toast.error(`Out of stock! only ${product.quantity} left`, { id: 'stock-error' });
          return prev;
        }
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast.success(`${product.name} added`, { id: 'scan-success', duration: 1000 });
  }, []);

  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      const currentTime = Date.now();
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        if (e.key !== 'Enter') return;
      }
      if (currentTime - lastKeyTime > 50) barcodeBuffer = '';
      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 2) {
          e.preventDefault();
          const product = await db.products.where('sku').equals(barcodeBuffer).first();
          if (product) {
            addToCart(product);
          } else {
            soundService.playError();
            toast.error(`SKU ${barcodeBuffer} not found`, { id: 'scanner-error' });
          }
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
      lastKeyTime = currentTime;
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [addToCart]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.sellPrice * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMode === 'CREDIT' && !selectedCustomerId) {
      setShowCustomerSelector(true);
      return;
    }

    try {
      const invoiceNo = generateInvoiceNo();
      const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
      
      const saleData = {
        id: crypto.randomUUID(),
        items: cart.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.sellPrice,
          costPrice: item.product.costPrice,
          lineTotal: item.product.sellPrice * item.quantity,
          profit: (item.product.sellPrice - item.product.costPrice) * item.quantity
        })),
        total: cartTotal,
        itemsCount,
        paymentMode,
        customerId: selectedCustomerId || undefined,
        invoiceNo,
        createdAt: new Date().toISOString(),
        status: 'PENDING'
      };

      await db.salesQueue.add(saleData);

      for (const item of cart) {
        await db.products.update(item.product.id, {
          quantity: item.product.quantity - item.quantity,
          updatedAt: new Date().toISOString()
        });
      }

      let customerName = undefined;
      if (selectedCustomerId) {
        const customer = await db.customers.get(selectedCustomerId);
        if (customer) {
          customerName = customer.name;
          await db.customers.update(selectedCustomerId, {
            balance: customer.balance + (paymentMode === 'CREDIT' ? cartTotal : 0),
            updatedAt: new Date().toISOString()
          });
        }
      }

      soundService.playSaleComplete();
      setShowReceipt({
        items: cart,
        total: cartTotal,
        invoiceNo,
        date: new Date().toLocaleString(),
        mode: paymentMode,
        customerName
      });

      setCart([]);
      setSelectedCustomerId(null);
      setShowCustomerSelector(false);
      toast.success('Sale Completed!');
    } catch (err) {
      soundService.playError();
      console.error(err);
      toast.error('Failed to save sale');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] md:h-screen overflow-hidden bg-surface-bg">
      <AnimatePresence>
        {showCustomerSelector && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card border border-surface-border rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-surface-border bg-surface-bg/30">
                <h3 className="text-xl font-black tracking-tighter mb-4">Select Customer</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
                  <input autoFocus type="text" placeholder="Search customer..." className="input-field w-full pl-10" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 divide-y divide-surface-border/50">
                 {customers?.length === 0 ? (
                    <div className="p-8 text-center text-surface-text/40 font-bold text-[10px] leading-loose">
                       No matching customers found.
                    </div>
                 ) : (
                   customers?.map(c => (
                     <button key={c.id} onClick={() => { setSelectedCustomerId(c.id); handleCheckout(); }} className="w-full p-4 flex justify-between items-center hover:bg-primary-500/5 transition-colors group">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-surface-bg border border-surface-border rounded-xl flex items-center justify-center group-hover:border-primary-400 transition-colors">
                             <Users className="w-5 h-5 text-surface-text/40" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-sm">{c.name}</div>
                            <div className="text-[10px] text-surface-text/30 font-bold">{c.phone}</div>
                          </div>
                       </div>
                       <ChevronRight className="w-5 h-5 text-surface-text/20 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                     </button>
                   ))
                 )}
              </div>
              <div className="p-6 border-t border-surface-border bg-surface-bg/30 flex gap-4">
                 <button onClick={() => setShowCustomerSelector(false)} className="flex-1 py-3 bg-surface-bg border border-surface-border rounded-xl text-[10px] font-bold uppercase tracking-widest">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card max-w-lg w-full p-8 rounded-3xl flex flex-col items-center shadow-2xl">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-6 border-2 border-emerald-500/20">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black mb-2 tracking-tight">Sale Completed</h2>
              <p className="text-surface-text/40 mb-8 text-center text-[10px] font-black uppercase tracking-widest">Invoice: {showReceipt.invoiceNo}</p>
              
              <div className="w-full bg-white rounded-2xl overflow-hidden mb-8 shadow-inner border border-zinc-100 p-4">
                {showReceipt.mode === 'CASH' ? <Receipt {...showReceipt} /> : <Invoice {...showReceipt} />}
              </div>
              
              <div className="flex gap-4 w-full">
                <button onClick={() => window.print()} className="flex-1 px-6 py-4 bg-surface-bg hover:bg-surface-border/50 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-surface-border">
                  <RefreshCw className="w-4 h-4" /> Print
                </button>
                <button onClick={() => setShowReceipt(null)} className="flex-1 btn-primary !py-4 font-black text-[11px] uppercase tracking-widest">
                  New Transaction
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 bg-surface-bg/50">
        <header className="p-4 md:p-6 border-b border-surface-border bg-surface-card shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-5 h-5 group-focus-within:text-primary-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search products or scan barcode..." 
                className="input-field w-full pl-12 h-14 text-sm font-bold shadow-sm" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <button 
              onClick={async () => {
                setIsSyncing(true);
                await SyncService.pushSales();
                setIsSyncing(false);
                toast.success('Synced');
              }} 
              className={clsx("p-4 bg-surface-card border border-surface-border rounded-2xl text-primary-500 hover:border-primary-500 transition-all", isSyncing && "animate-spin")}
            >
              <RefreshCw className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {searchTerm.length < 2 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30">
               <div className="w-32 h-32 bg-surface-card border-2 border-dashed border-surface-border rounded-full flex items-center justify-center mb-6">
                  <PackageSearch className="w-12 h-12" />
               </div>
               <h2 className="text-xl font-black uppercase tracking-widest">Ready to scan</h2>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-2">Scan a product or search to begin</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              <AnimatePresence mode="popLayout">
                {products?.map(product => (
                  <motion.div 
                    layout 
                    initial={{ opacity: 0, scale: 0.9 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.9 }} 
                    key={product.id} 
                    onClick={() => addToCart(product)} 
                    className="bg-surface-card border border-surface-border p-4 rounded-3xl cursor-pointer active:scale-95 transition-all group hover:border-primary-500/40 hover:shadow-xl hover:shadow-primary-500/5 flex flex-col relative overflow-hidden h-48"
                  >
                    <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                       <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center">
                          <Plus className="w-5 h-5" />
                       </div>
                    </div>
                    <div className="text-[9px] font-black text-surface-text/30 mb-2 uppercase tracking-widest">{product.sku}</div>
                    <div className="font-black text-sm text-surface-text group-hover:text-primary-500 transition-colors line-clamp-2 leading-tight">{product.name}</div>
                    <div className="mt-auto flex flex-col gap-1">
                      <div className="text-lg font-black text-primary-500">MK {product.sellPrice.toLocaleString()}</div>
                      <div className={clsx(
                        "text-[9px] font-black uppercase tracking-widest",
                        product.quantity <= 5 ? "text-red-500" : "text-surface-text/30"
                      )}>Stock: {product.quantity}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:flex flex-col w-96 bg-surface-card border-l border-surface-border shadow-2xl relative z-10">
        <div className="p-6 border-b border-surface-border flex items-center justify-between bg-surface-bg/30">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-primary-500/10 text-primary-500 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
             </div>
             <h2 className="text-xl font-black tracking-tighter uppercase italic">Current Order</h2>
          </div>
          <button onClick={() => setCart([])} className="p-2 text-surface-text/20 hover:text-red-500 transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
              <ShoppingCart className="w-12 h-12 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Cart is empty</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {cart.map((item, idx) => (
                <motion.div layout initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} key={item.product.id} className="p-4 bg-surface-bg/50 border border-surface-border rounded-2xl group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="font-black text-sm leading-tight">{item.product.name}</div>
                      <div className="text-[10px] font-bold text-surface-text/30 mt-1 uppercase tracking-widest">MK {item.product.sellPrice.toLocaleString()} / unit</div>
                    </div>
                    <button onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))} className="p-1 text-surface-text/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-surface-border/50">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setCart(prev => prev.map(i => i.product.id === item.product.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}
                        className="w-8 h-8 bg-surface-card border border-surface-border rounded-lg flex items-center justify-center hover:border-primary-500 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <div className="w-10 text-center font-black text-sm">{item.quantity}</div>
                      <button 
                        onClick={() => addToCart(item.product)}
                        className="w-8 h-8 bg-surface-card border border-surface-border rounded-lg flex items-center justify-center hover:border-primary-500 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="font-black text-primary-500">MK {(item.product.sellPrice * item.quantity).toLocaleString()}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        <div className="p-6 bg-surface-card border-t border-surface-border space-y-4 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
          <div className="flex gap-2 p-1 bg-surface-bg rounded-xl border border-surface-border">
            <button onClick={() => setPaymentMode('CASH')} className={clsx("flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", paymentMode === 'CASH' ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20" : "text-surface-text/40")}>Cash</button>
            <button onClick={() => setPaymentMode('CREDIT')} className={clsx("flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", paymentMode === 'CREDIT' ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "text-surface-text/40")}>Credit</button>
          </div>

          <div className="space-y-1">
             <div className="flex justify-between text-[10px] font-black text-surface-text/30 uppercase tracking-widest">
               <span>Total amount</span>
               <span>{cart.length} items</span>
             </div>
             <div className={clsx("text-4xl font-black tracking-tighter", paymentMode === 'CREDIT' ? 'text-amber-500' : 'text-primary-500')}>
                MK {cartTotal.toLocaleString()}
             </div>
          </div>

          <button 
            disabled={cart.length === 0}
            onClick={handleCheckout} 
            className={clsx(
              "w-full py-6 rounded-3xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] disabled:opacity-50 disabled:grayscale",
              paymentMode === 'CASH' ? "bg-primary-500 text-white shadow-primary-500/20" : "bg-amber-500 text-white shadow-amber-500/20"
            )}
          >
            <Power className="w-5 h-5" />
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSPage;
