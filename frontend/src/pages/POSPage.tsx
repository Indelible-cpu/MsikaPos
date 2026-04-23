import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import type { LocalProduct } from '../db/posDB';
import { 
  Search, 
  ShoppingCart, 
  Power, 
  RefreshCw, 
  Users, 
  ChevronRight, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  PackageSearch, 
  Scan, 
  CreditCard, 
  Smartphone, 
  Wallet,
  Printer,
  Send,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { SyncService } from '../services/SyncService';
import { soundService } from '../services/SoundService';
import clsx from 'clsx';

import { Receipt } from '../components/Receipt';
import { Invoice } from '../components/Invoice';
import BarcodeScanner from '../components/BarcodeScanner';

const generateInvoiceNo = () => `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

interface TaxConfig {
  rate: number;
  inclusive: boolean;
}

const POSPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'CARD' | 'MOMO' | 'CREDIT'>('CASH');
  const [cart, setCart] = useState<{ product: LocalProduct; quantity: number }[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [taxConfig, setTaxConfig] = useState<TaxConfig>({ rate: 0, inclusive: true });
  const [options, setOptions] = useState({ print: true, whatsapp: false });
  const [showMobileCart, setShowMobileCart] = useState(false);

  const [showReceipt, setShowReceipt] = useState<{
    items: { product: LocalProduct; quantity: number }[];
    total: number;
    subtotal: number;
    tax: number;
    invoiceNo: string;
    date: string;
    mode: string;
    customerName?: string;
    paid: number;
    change: number;
  } | null>(null);

  // Load Tax Config
  useEffect(() => {
    const loadTax = async () => {
      const tax = await db.settings.get('tax_config');
      if (tax?.value) setTaxConfig(tax.value as TaxConfig);
    };
    loadTax();
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

  // Totals Calculation
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.product.sellPrice * item.quantity), 0);
  let finalTotal = cartSubtotal;
  let taxAmount = 0;

  if (taxConfig.rate > 0) {
    if (taxConfig.inclusive) {
      taxAmount = cartSubtotal - (cartSubtotal / (1 + (taxConfig.rate / 100)));
    } else {
      taxAmount = cartSubtotal * (taxConfig.rate / 100);
      finalTotal = cartSubtotal + taxAmount;
    }
  }

  const changeDue = Math.max(0, (parseFloat(amountReceived) || 0) - finalTotal);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (paymentMode === 'CASH' && !showCashModal) {
      setShowCashModal(true);
      return;
    }

    if (paymentMode === 'CREDIT' && !selectedCustomerId) {
      setShowCustomerSelector(true);
      return;
    }

    const paid = paymentMode === 'CASH' ? (parseFloat(amountReceived) || finalTotal) : finalTotal;
    if (paid < finalTotal && paymentMode !== 'CREDIT') {
      toast.error('Insufficient amount received');
      return;
    }

    try {
      const invoiceNo = generateInvoiceNo();
      const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
      
      const saleData = {
        id: crypto.randomUUID(),
        invoiceNo,
        items: cart.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.sellPrice,
          costPrice: item.product.costPrice,
          discount: 0,
          lineTotal: item.product.sellPrice * item.quantity,
          profit: (item.product.sellPrice - item.product.costPrice) * item.quantity
        })),
        subtotal: cartSubtotal,
        discount: 0,
        tax: taxAmount,
        total: finalTotal,
        paid,
        changeDue,
        itemsCount,
        paymentMode,
        customerId: selectedCustomerId || undefined,
        createdAt: new Date().toISOString(),
        synced: 0
      };

      await db.salesQueue.add(saleData);

      // Update Inventory
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
            balance: customer.balance + (paymentMode === 'CREDIT' ? finalTotal : 0),
            updatedAt: new Date().toISOString()
          });
        }
      }

      soundService.playSaleComplete();
      
      setShowReceipt({
        items: cart,
        total: finalTotal,
        subtotal: cartSubtotal,
        tax: taxAmount,
        invoiceNo,
        date: new Date().toLocaleString(),
        mode: paymentMode,
        customerName,
        paid,
        change: changeDue
      });

      setCart([]);
      setSelectedCustomerId(null);
      setShowCustomerSelector(false);
      setShowCashModal(false);
      setAmountReceived('');
      toast.success('Sale Completed!');
      
      if (options.print) {
        setTimeout(() => window.print(), 500);
      }
    } catch (err) {
      soundService.playError();
      console.error(err);
      toast.error('Failed to save sale');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-surface-bg">
      <AnimatePresence>
        {showScanner && (
          <BarcodeScanner 
            onScan={async (sku) => {
              const product = await db.products.where('sku').equals(sku).first();
              if (product) {
                addToCart(product);
                setShowScanner(false);
              } else {
                soundService.playError();
                toast.error(`SKU ${sku} not found`);
              }
            }}
            onClose={() => setShowScanner(false)}
          />
        )}

        {showCustomerSelector && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card border border-surface-border rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-surface-border bg-surface-bg/30">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-black tracking-tighter">Select Customer</h3>
                  <button 
                    onClick={() => setShowCustomerSelector(false)} 
                    className="p-2 hover:bg-surface-bg rounded-xl"
                    title="Close"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5"/>
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
                  <input autoFocus type="text" placeholder="Search customer..." className="input-field w-full pl-10" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 divide-y divide-surface-border/50">
                 {customers?.length === 0 ? (
                    <div className="p-8 text-center text-surface-text/40 font-bold text-[10px] leading-loose">No matching customers found.</div>
                 ) : (
                    customers?.map(c => (
                      <button key={c.id} onClick={() => { setSelectedCustomerId(c.id); setShowCustomerSelector(false); if(paymentMode === 'CREDIT') handleCheckout(); }} className="w-full p-4 flex justify-between items-center hover:bg-primary-500/5 transition-colors group">
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
            </motion.div>
          </motion.div>
        )}

        {showCashModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card border border-surface-border rounded-3xl w-full max-w-md shadow-2xl p-6">
              <h3 className="text-xl font-black tracking-tighter mb-6">Payment Received</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-surface-text/40 uppercase tracking-widest ml-1">Payable Amount</label>
                  <div className="text-3xl font-black text-primary-500 mt-1">MK {finalTotal.toLocaleString()}</div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-surface-text/40 uppercase tracking-widest ml-1">Cash Received</label>
                  <input 
                    autoFocus 
                    type="number" 
                    placeholder="Enter amount..." 
                    className="input-field w-full text-2xl font-black mt-1" 
                    value={amountReceived} 
                    onChange={(e) => setAmountReceived(e.target.value)} 
                  />
                </div>
                {parseFloat(amountReceived) >= finalTotal && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Change to give</div>
                    <div className="text-2xl font-black text-emerald-500">MK {changeDue.toLocaleString()}</div>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowCashModal(false)} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
                  <button 
                    disabled={parseFloat(amountReceived) < finalTotal}
                    onClick={handleCheckout} 
                    className="flex-1 btn-primary !py-4 font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                  >
                    Complete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card max-w-lg w-full p-8 rounded-3xl flex flex-col items-center shadow-2xl">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-6 border-2 border-emerald-500/20">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black mb-2 tracking-tight">Sale Completed</h2>
              <p className="text-surface-text/40 mb-8 text-center text-[10px] font-black uppercase tracking-widest">Invoice: {showReceipt.invoiceNo}</p>
              
              <div className="w-full bg-white rounded-2xl overflow-hidden mb-8 shadow-inner border border-zinc-100 p-4 max-h-[40vh] overflow-y-auto text-black">
                {showReceipt.mode === 'CREDIT' ? (
                  <Invoice 
                    items={showReceipt.items}
                    total={showReceipt.total}
                    subtotal={showReceipt.subtotal}
                    tax={showReceipt.tax}
                    invoiceNo={showReceipt.invoiceNo}
                    date={showReceipt.date}
                    customerName={showReceipt.customerName}
                  />
                ) : (
                  <Receipt 
                    items={showReceipt.items}
                    total={showReceipt.total}
                    subtotal={showReceipt.subtotal}
                    tax={showReceipt.tax}
                    invoiceNo={showReceipt.invoiceNo}
                    date={showReceipt.date}
                    paid={showReceipt.paid}
                    change={showReceipt.change}
                    mode={showReceipt.mode}
                  />
                )}
              </div>
              
              <div className="flex gap-3 w-full">
                <button onClick={() => window.print()} className="flex-1 px-4 py-3 bg-surface-bg hover:bg-surface-border/50 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-surface-border">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button 
                  onClick={() => {
                    const text = `Sale Invoice: ${showReceipt.invoiceNo}\nTotal: MK ${showReceipt.total.toLocaleString()}\nThank you for shopping!`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                  }} 
                  className="flex-1 px-4 py-3 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-[#25D366]/20"
                >
                  <Send className="w-4 h-4" /> WhatsApp
                </button>
              </div>
              <button onClick={() => setShowReceipt(null)} className="w-full mt-4 btn-primary !py-4 font-black text-[10px] uppercase tracking-widest">
                New Transaction
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 bg-surface-bg/50">
        <header className="p-4 md:p-6 border-b border-surface-border bg-surface-card shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-5 h-5 group-focus-within:text-primary-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search products..." 
                className="input-field w-full pl-12 h-14 text-sm font-bold" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <button 
              onClick={() => setShowScanner(true)}
              className="p-4 bg-primary-500 text-white rounded-2xl active:scale-95 transition-all"
              title="Scan"
              aria-label="Scan"
            >
              <Scan className="w-6 h-6" />
            </button>
            <button 
              onClick={async () => {
                setIsSyncing(true);
                await SyncService.pushSales();
                setIsSyncing(false);
                toast.success('Synced');
              }} 
              className={clsx("p-4 bg-surface-card border border-surface-border rounded-2xl text-primary-500", isSyncing && "animate-spin")}
              title="Sync"
              aria-label="Sync"
            >
              <RefreshCw className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {searchTerm.length < 2 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
               <PackageSearch className="w-16 h-16 mb-4" />
               <p className="text-xs font-black uppercase tracking-widest text-center">Ready for input</p>
            </div>
          ) : (
            <div className="space-y-2 pb-24 lg:pb-4">
              <AnimatePresence mode="popLayout">
                {products?.map(product => (
                  <motion.div 
                    layout 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    exit={{ opacity: 0, x: 10 }} 
                    key={product.id} 
                    onClick={() => addToCart(product)} 
                    className="bg-surface-card border border-surface-border p-4 rounded-2xl cursor-pointer active:scale-[0.99] transition-all group hover:border-primary-500/40 flex items-center justify-between gap-4"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="text-[8px] font-black text-surface-text/30 uppercase tracking-widest">{product.sku}</div>
                      <div className="font-black text-sm text-surface-text group-hover:text-primary-500 transition-colors truncate">{product.name}</div>
                      <div className={clsx("text-[9px] font-black uppercase mt-1", product.quantity <= 5 ? "text-red-500" : "text-surface-text/20")}>Stock: {product.quantity}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-black text-primary-500">MK {product.sellPrice.toLocaleString()}</div>
                      <div className="p-1.5 bg-primary-500 text-white rounded-lg inline-flex items-center justify-center mt-1">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className={clsx(
        "flex flex-col w-full lg:w-96 bg-surface-card border-l border-surface-border shadow-2xl relative z-20",
        "fixed inset-x-0 bottom-0 lg:static transition-transform duration-500",
        showMobileCart ? "translate-y-0 h-full rounded-none" : "translate-y-[calc(100%-64px)] lg:translate-y-0 h-16 lg:h-auto"
      )}>
        {/* Mobile Cart Trigger */}
        <button 
          onClick={() => setShowMobileCart(!showMobileCart)}
          className="lg:hidden h-16 w-full flex items-center justify-between px-6 border-b border-surface-border bg-primary-500 text-white"
          title="Toggle Cart"
          aria-label="Toggle Cart"
        >
          <div className="flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
            <ShoppingCart className="w-5 h-5" />
            Order ({cart.length})
          </div>
          <div className="font-black text-lg">MK {finalTotal.toLocaleString()}</div>
        </button>

        <div className="p-6 border-b border-surface-border flex items-center justify-between bg-surface-bg/30">
          <div className="flex items-center gap-3">
             <ShoppingCart className="w-5 h-5 text-primary-500" />
             <h2 className="text-xl font-black tracking-tighter uppercase italic">Current Order</h2>
          </div>
          {showMobileCart && (
             <button onClick={() => setShowMobileCart(false)} className="lg:hidden p-2 bg-surface-bg rounded-xl border border-surface-border"><X className="w-5 h-5" /></button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10">
              <ShoppingCart className="w-12 h-12 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Order is empty</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {cart.map((item) => (
                <motion.div layout initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} key={item.product.id} className="p-4 bg-surface-bg/50 border border-surface-border rounded-2xl group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="font-black text-sm leading-tight">{item.product.name}</div>
                      <div className="text-[10px] font-bold text-surface-text/30 mt-1 uppercase tracking-widest">MK {item.product.sellPrice.toLocaleString()} / unit</div>
                    </div>
                    <button onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))} className="p-1 text-surface-text/20 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-surface-border/50">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCart(prev => prev.map(i => i.product.id === item.product.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} className="w-8 h-8 bg-surface-card border border-surface-border rounded-lg flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                      <div className="w-10 text-center font-black text-sm">{item.quantity}</div>
                      <button onClick={() => addToCart(item.product)} className="w-8 h-8 bg-surface-card border border-surface-border rounded-lg flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                    </div>
                    <div className="font-black text-primary-500">MK {(item.product.sellPrice * item.quantity).toLocaleString()}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        <div className="p-6 bg-surface-card border-t border-surface-border space-y-4 pb-24 lg:pb-6">
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'CASH', icon: Wallet, color: 'bg-primary-500' },
              { id: 'CARD', icon: CreditCard, color: 'bg-blue-600' },
              { id: 'MOMO', icon: Smartphone, color: 'bg-emerald-600' },
              { id: 'CREDIT', icon: Users, color: 'bg-amber-600' }
            ].map((mode) => (
              <button key={mode.id} onClick={() => setPaymentMode(mode.id as any)} className={clsx("p-3 rounded-xl border flex flex-col items-center gap-1 transition-all", paymentMode === mode.id ? `${mode.color} text-white border-transparent scale-105 shadow-lg` : "bg-surface-bg border-surface-border text-surface-text/30")}>
                <mode.icon className="w-4 h-4" />
                <span className="text-[7px] font-black uppercase">{mode.id}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2 py-2">
             <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-surface-text/30 uppercase tracking-widest mb-1">Total Payable</span>
                <div className={clsx("text-3xl font-black tracking-tighter", paymentMode === 'CREDIT' ? 'text-amber-500' : 'text-primary-500')}>
                    MK {finalTotal.toLocaleString()}
                </div>
             </div>
          </div>

          <button 
            disabled={cart.length === 0}
            onClick={handleCheckout} 
            className={clsx(
              "w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] disabled:opacity-50",
              paymentMode === 'CREDIT' ? "bg-amber-500 text-white" : "bg-primary-500 text-white shadow-primary-500/20"
            )}
          >
            {paymentMode === 'CREDIT' ? <Users className="w-4 h-4" /> : <Power className="w-4 h-4" />}
            {paymentMode === 'CREDIT' ? 'Process Credit' : 'Complete Sale'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSPage;
