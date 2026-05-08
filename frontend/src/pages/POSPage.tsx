import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import type { LocalProduct, LocalSale, LocalSaleItem, LocalCustomer } from '../db/posDB';
import { toSentenceCase } from '../utils/stringUtils';
import { 
  Search, 
  Scan, 
  Trash2,
  Printer,
  CheckCircle2,
  X,
  ChevronLeft,
  Plus,
  Banknote,
  CreditCard,
  Smartphone,
  User,
  MessageCircle,
  Calendar,
  FileText,
  ShieldAlert,
  Building2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { soundService } from '../services/SoundService';
import clsx from 'clsx';
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
  const [showScanner, setShowScanner] = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<{ momo: string[]; bank: string[] }>({ momo: [], bank: [] });
  const [selectedSubMethod, setSelectedSubMethod] = useState<string>('');

  // Receipt Options
  const [printReceipt, setPrintReceipt] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);

  // Credit Sale Flow
  const [creditMode, setCreditMode] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [village, setVillage] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [printInvoice, setPrintInvoice] = useState(true);

  const [taxConfig, setTaxConfig] = useState<TaxConfig>({ rate: 10, inclusive: false });
  const [currentInvoiceNo, setCurrentInvoiceNo] = useState(generateInvoiceNo());

  useEffect(() => {
    if (cart.length === 0) {
      setCurrentInvoiceNo(generateInvoiceNo());
    }
  }, [cart.length]);

  const [showReceipt, setShowReceipt] = useState<{
    items: { product: LocalProduct; quantity: number }[];
    total: number;
    subtotal: number;
    discount: number;
    tax: number;
    invoiceNo: string;
    date: string;
    mode: string;
    paid: number;
    change: number;
  } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const tax = await db.settings.get('tax_config');
      if (tax?.value) setTaxConfig(tax.value as TaxConfig);

      const payment = await db.settings.get('payment_config');
      if (payment?.value) {
        const val = payment.value as { momo: string; bank: string };
        setPaymentConfig({
          momo: val.momo ? val.momo.split(',').map(s => s.trim()) : [],
          bank: val.bank ? val.bank.split(',').map(s => s.trim()) : []
        });
      }
    };
    loadSettings();
  }, []);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const products = useLiveQuery(
    async () => {
      if (searchTerm.length >= 2) {
        const byName = await db.products.where('name').startsWithIgnoreCase(searchTerm).filter(p => !p.deleted).toArray();
        const bySku = await db.products.where('sku').equals(searchTerm).filter(p => !p.deleted).toArray();
        return Array.from(new Map([...byName, ...bySku].map(p => [p.id, p])).values());
      } else {
        return await db.products.filter(p => !p.deleted && p.status === 'ACTIVE').limit(12).toArray();
      }
    },
    [searchTerm]
  );

  const addToCart = useCallback((product: LocalProduct) => {
    if (!product.isService && product.quantity <= 0) return toast.error('Out of stock');
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (!product.isService && existing.quantity >= product.quantity) {
          toast.error('No more stock available');
          return prev;
        }
        soundService.playBeep();
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      soundService.playBeep();
      return [...prev, { product, quantity: 1 }];
    });
    setSearchTerm('');
  }, []);

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.product.sellPrice * item.quantity), 0);
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

  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;
    
    if (paymentMode === 'Credit') {
      setCreditMode(true);
      return;
    }

    setIsCheckingOut(true);
    try {
      const invoiceNo = currentInvoiceNo;
      const itemsCount = cart.reduce((s, i) => s + i.quantity, 0);
      const saleItems: LocalSaleItem[] = cart.map(item => {
        return {
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.sellPrice,
          discount: 0,
          lineTotal: item.product.sellPrice * item.quantity,
          profit: (item.product.sellPrice - (item.product.costPrice || 0)) * item.quantity
        };
      });

      const totalItemProfit = saleItems.reduce((s, i) => s + i.profit, 0);
      const finalProfit = totalItemProfit - discount;

      const saleData: LocalSale = {
        id: crypto.randomUUID(),
        invoiceNo,
        userId: Number(user.id),
        items: saleItems,
        subtotal: cartSubtotal,
        discount,
        tax: taxAmount,
        total: finalTotal,
        paid: finalTotal,
        changeDue: 0,
        paymentMode,
        itemsCount,
        profit: finalProfit,
        createdAt: new Date().toISOString(),
        synced: 0,
        status: 'COMPLETED',
        bankName: selectedSubMethod || undefined
      };

      await db.salesQueue.add(saleData);

      for (const item of cart) {
        if (!item.product.isService) {
          const product = await db.products.get(item.product.id);
          if (product) {
            await db.products.update(item.product.id, {
              quantity: Math.max(0, product.quantity - item.quantity)
            });
          }
        }
      }

      setShowReceipt({
        items: cart,
        total: finalTotal,
        subtotal: cartSubtotal,
        discount,
        tax: taxAmount,
        invoiceNo,
        date: new Date().toISOString(),
        mode: paymentMode,
        paid: finalTotal,
        change: 0
      });

      setCart([]);
      toast.success('Sale Completed!');
      if (printReceipt) setTimeout(() => window.print(), 800);
      
    } catch {
      toast.error('Checkout failed.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleSaveCreditSale = async () => {
    if (!customerName || !whatsappNumber) return toast.error("Please provide customer details");
    if (!dueDate) return toast.error("Please select a due date");
    
    setIsCheckingOut(true);
    try {
      const customerId = crypto.randomUUID();
      const paidAmt = parseFloat(amountPaid) || 0;
      const balance = finalTotal - paidAmt;

      const newCustomer: LocalCustomer = {
        id: customerId,
        name: customerName,
        phone: whatsappNumber,
        idNumber: idNumber.toUpperCase(),
        village: village,
        balance: balance,
        totalCreditAmount: finalTotal,
        totalPaidAmount: paidAmt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: 0
      };
      await db.customers.add(newCustomer);

      const invoiceNo = currentInvoiceNo;
      const saleItems: LocalSaleItem[] = cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.sellPrice,
        discount: 0,
        lineTotal: item.product.sellPrice * item.quantity,
        profit: (item.product.sellPrice - (item.product.costPrice || 0)) * item.quantity
      }));

      const finalProfit = saleItems.reduce((s, i) => s + i.profit, 0) - discount;

      const saleData: LocalSale = {
        id: crypto.randomUUID(),
        invoiceNo,
        userId: Number(user.id),
        items: saleItems,
        subtotal: cartSubtotal,
        discount,
        tax: taxAmount,
        total: finalTotal,
        paid: paidAmt,
        changeDue: 0,
        paymentMode: 'Credit',
        itemsCount: cart.reduce((s, i) => s + i.quantity, 0),
        profit: finalProfit,
        createdAt: new Date().toISOString(),
        synced: 0,
        status: 'PENDING',
        customerId: customerId
      };

      await db.salesQueue.add(saleData);

      for (const item of cart) {
        if (!item.product.isService) {
          const product = await db.products.get(item.product.id);
          if (product) {
            await db.products.update(item.product.id, {
              quantity: Math.max(0, product.quantity - item.quantity)
            });
          }
        }
      }

      soundService.playSaleComplete();
      toast.success('Credit Sale Saved!');
      
      setCart([]);
      setCreditMode(false);
      setCustomerName('');
      setWhatsappNumber('');
      setIdNumber('');
      setVillage('');
      setAmountPaid('');
      setDueDate('');
      setPaymentMode('Cash');
      
    } catch {
      toast.error('Failed to save credit sale');
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (creditMode) {
    const paidAmt = parseFloat(amountPaid) || 0;
    const balance = Math.max(0, finalTotal - paidAmt);

    return (
      <div className="flex flex-col h-full bg-background overflow-y-auto max-w-2xl mx-auto w-full relative stagger-children">
        <div className="bg-primary text-primary-foreground flex items-center px-6 py-5 sticky top-0 z-10 shadow-lg">
           <button title="Go Back" aria-label="Go Back" onClick={() => setCreditMode(false)} className="mr-4 active:scale-90 transition-transform"><ChevronLeft className="w-6 h-6" /></button>
           <h2 className="text-lg font-black uppercase tracking-tighter">Register Credit Sale</h2>
        </div>
        
        <div className="p-6 space-y-8 pb-24">
           <div className="space-y-4">
             <h3 className="font-black text-foreground uppercase tracking-widest text-[10px] ml-1 opacity-50">Customer Verification</h3>
             <div className="glass-card rounded-3xl border border-border overflow-hidden shadow-sm space-y-px bg-card">
               <div className="flex items-center px-6 py-4 border-b border-border/50 focus-within:bg-primary/5 transition-colors">
                 <User className="w-5 h-5 text-primary mr-4" />
                 <input title="Customer Name" aria-label="Customer Name" className="w-full bg-transparent outline-none text-sm text-foreground font-black placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="FULL NAME" value={customerName} onChange={e => setCustomerName(e.target.value)} />
               </div>
               <div className="flex items-center px-6 py-4 border-b border-border/50 focus-within:bg-primary/5 transition-colors">
                 <MessageCircle className="w-5 h-5 text-success mr-4" />
                 <input title="WhatsApp Number" aria-label="WhatsApp Number" className="w-full bg-transparent outline-none text-sm text-foreground font-black placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="WHATSAPP NUMBER" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} />
               </div>
               <div className="flex items-center px-6 py-4 border-b border-border/50 focus-within:bg-primary/5 transition-colors">
                 <ShieldAlert className="w-5 h-5 text-amber-500 mr-4" />
                 <input title="National ID" aria-label="National ID" className="w-full bg-transparent outline-none text-sm text-foreground font-black placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="NATIONAL ID NUMBER" value={idNumber} onChange={e => setIdNumber(e.target.value)} />
               </div>
               <div className="flex items-center px-6 py-4 focus-within:bg-primary/5 transition-colors">
                 <Building2 className="w-5 h-5 text-blue-500 mr-4" />
                 <input title="Location/Village" aria-label="Location/Village" className="w-full bg-transparent outline-none text-sm text-foreground font-black placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="LOCATION / VILLAGE" value={village} onChange={e => setVillage(e.target.value)} />
               </div>
             </div>
           </div>

           <div className="space-y-4">
             <h3 className="font-black text-foreground uppercase tracking-widest text-[10px] ml-1 opacity-50">Sale Summary</h3>
             <div className="glass-card rounded-3xl border border-border p-6 space-y-5 shadow-sm bg-card">
               <div className="flex justify-between items-center text-sm">
                 <span className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Total Amount</span>
                 <span className="font-black text-foreground text-lg">MK {finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Initial Deposit</span>
                 <input title="Amount Paid" aria-label="Amount Paid" type="number" className="w-32 bg-muted/20 border border-border rounded-xl px-4 py-2.5 text-right outline-none focus:ring-2 focus:ring-primary font-black" placeholder="0.00" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Balance Due</span>
                 <span className="font-black text-destructive text-lg">MK {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
               </div>
               <div className="flex justify-between items-center text-sm pt-4 border-t border-border/50">
                 <span className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Promise Date</span>
                 <div className="relative">
                   <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                   <input title="Due Date" aria-label="Due Date" type="date" className="pl-10 pr-4 py-2.5 bg-muted/20 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary text-foreground text-xs font-black uppercase" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                 </div>
               </div>
             </div>
           </div>

           <div className="space-y-4">
             <h3 className="font-black text-foreground uppercase tracking-widest text-[10px] ml-1 opacity-50">Documentation</h3>
             <div className="glass-card rounded-3xl border border-border overflow-hidden shadow-sm bg-card">
               <label className="flex items-center justify-between px-6 py-4 border-b border-border/50 cursor-pointer hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4 text-[11px] text-foreground font-black uppercase tracking-widest"><Printer className="w-4 h-4 text-muted-foreground" /> Print official invoice</div>
                  <input title="Print Invoice" type="checkbox" className="w-5 h-5 accent-primary rounded-lg" checked={printInvoice} onChange={e => setPrintInvoice(e.target.checked)} />
               </label>
               <label className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4 text-[11px] text-foreground font-black uppercase tracking-widest"><MessageCircle className="w-4 h-4 text-success" /> Send copy via WhatsApp</div>
                  <input title="Send via WhatsApp" type="checkbox" className="w-5 h-5 accent-success rounded-lg" checked={sendWhatsapp} onChange={e => setSendWhatsapp(e.target.checked)} />
               </label>
             </div>
           </div>

           <div className="pt-6">
             <button onClick={handleSaveCreditSale} disabled={isCheckingOut} className="w-full py-5 bg-success text-white font-black rounded-[2rem] flex items-center justify-center gap-3 text-[11px] tracking-[0.2em] active:scale-95 transition-all shadow-xl shadow-success/20 uppercase">
               <FileText className="w-5 h-5" /> Commit Credit Sale
             </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto max-w-2xl mx-auto w-full relative custom-scrollbar stagger-children">
      {showScanner && (
        <BarcodeScanner onScan={async (sku) => {
          const p = await db.products.where('sku').equals(sku).first();
          if (p) { addToCart(p); setShowScanner(false); } else toast.error('Not Found');
        }} onClose={() => setShowScanner(false)} />
      )}

      {showReceipt && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <div className="bg-card max-w-sm w-full p-0 rounded-3xl border border-border overflow-hidden flex flex-col shadow-2xl">
            <div className="p-8 pb-4 flex flex-col items-center border-b border-border/50">
              <CheckCircle2 className="w-16 h-16 text-success mb-4" />
              <h2 className="text-xl font-black text-foreground uppercase tracking-tighter">Payment Successful</h2>
            </div>
            <div className="max-h-[50vh] overflow-y-auto bg-card p-6">
               <Receipt {...showReceipt} />
            </div>
            <div className="p-6 bg-muted/30 border-t border-border/50">
              <button onClick={() => setShowReceipt(null)} className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest text-[11px] btn-press">Close & New Sale</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 p-4 bg-card/80 backdrop-blur-md sticky top-0 z-10 shadow-sm border-b border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            id="product-search"
            title="Search Products"
            aria-label="Search Products"
            className="w-full pl-10 pr-4 py-3 bg-muted/20 border border-border rounded-2xl outline-none text-sm text-foreground font-medium placeholder:font-normal focus:ring-2 focus:ring-primary/50 transition-all" 
            placeholder="Search products by name, barcode..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          title="Scan Barcode"
          aria-label="Scan Barcode"
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary/10 text-primary border border-primary/20 font-black rounded-2xl active:scale-95 transition-all text-[10px] tracking-widest uppercase"
        >
          <Scan className="w-5 h-5" /> SCAN
        </button>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black text-foreground uppercase tracking-widest text-[11px] ml-1">Current Order {cart.length > 0 && `(${cart.length})`}</h3>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                const val = prompt('Enter discount amount:', discount.toString());
                if (val !== null) setDiscount(parseFloat(val) || 0);
              }}
              className="flex items-center gap-1 text-[10px] text-primary font-black uppercase tracking-widest hover:underline transition-all"
            >
              Discount
            </button>
            <button title="Clear Cart" aria-label="Clear Cart" onClick={() => setCart([])} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive font-black uppercase tracking-widest transition-all">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>
        {cart.length > 0 ? (
          <div className="glass-card rounded-[2rem] border border-border overflow-hidden shadow-sm bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground font-black border-b border-border/50 text-[9px] uppercase tracking-widest">
              <tr>
                <th className="text-left py-4 px-6">Item</th>
                <th className="text-center py-4 px-2">Qty</th>
                <th className="text-right py-4 px-2">Price</th>
                <th className="text-right py-4 px-6">Total</th>
                <th className="py-4 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {cart.map(item => (
                <tr key={item.product.id} className="hover:bg-muted/5 transition-colors">
                  <td className="py-4 px-6 text-foreground font-black text-[11px] uppercase truncate max-w-[120px]">{toSentenceCase(item.product.name)}</td>
                  <td className="py-4 px-2 text-center text-muted-foreground font-black text-[11px]">{item.quantity}</td>
                  <td className="py-4 px-2 text-right text-muted-foreground font-black text-[11px]">{item.product.sellPrice.toLocaleString()}</td>
                  <td className="py-4 px-6 text-right font-black text-foreground text-[11px]">{ (item.product.sellPrice * item.quantity).toLocaleString()}</td>
                  <td className="py-4 px-2 text-center">
                    <button title="Remove Item" aria-label="Remove Item" onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))} className="text-destructive hover:bg-destructive/10 p-2 rounded-xl transition-all"><X className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground/30 text-[10px] font-black uppercase tracking-widest">No items in order</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="p-6 bg-muted/20 border-t border-border/50 flex flex-col items-end gap-2 text-sm">
            <div className="flex justify-between w-48"><span className="text-muted-foreground font-black text-[10px] uppercase tracking-widest">Subtotal</span><span className="font-black text-foreground">MK {cartSubtotal.toLocaleString()}</span></div>
            {discount > 0 && <div className="flex justify-between w-48"><span className="text-destructive/60 font-black text-[10px] uppercase tracking-widest">Discount</span><span className="font-black text-destructive">-MK {discount.toLocaleString()}</span></div>}
            {taxConfig.rate > 0 && <div className="flex justify-between w-48"><span className="text-muted-foreground font-black text-[10px] uppercase tracking-widest">Tax ({taxConfig.rate}%)</span><span className="font-black text-foreground">MK {taxAmount.toLocaleString()}</span></div>}
            <div className="flex justify-between w-48 text-lg font-black mt-2 pt-2 border-t border-border/20"><span className="text-foreground uppercase tracking-tighter">TOTAL</span><span className="text-primary tracking-tighter">MK {finalTotal.toLocaleString()}</span></div>
          </div>
        </div>
        ) : (
          <div className="py-12 px-6 bg-primary/5 rounded-[2rem] border-2 border-dashed border-primary/20 text-center animate-pulse">
            <p className="text-[11px] text-primary font-black uppercase tracking-[0.2em]">Cart is currently empty</p>
          </div>
        )}
      </div>

      <div className="p-6 pt-0">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black text-foreground uppercase tracking-widest text-[11px] ml-1">Stock Inventory</h3>
          <button 
            title="View All Products" 
            aria-label="View All Products" 
            onClick={() => document.getElementById('product-search')?.focus()}
            className="text-[10px] text-primary font-black uppercase tracking-widest hover:underline"
          >
            Full Catalog
          </button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
          {products?.slice(0, cart.length === 0 ? 15 : 8).map(p => (
            <div key={p.id} onClick={() => addToCart(p)} className="glass-card bg-card border border-border/50 rounded-2xl p-4 flex flex-col items-center gap-3 cursor-pointer btn-press group">
              <div className="w-14 h-14 flex items-center justify-center bg-muted/20 rounded-xl group-hover:scale-110 transition-transform">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" /> : <Plus className="w-6 h-6 text-muted-foreground/30" />}
              </div>
              <div className="text-center w-full">
                <div className="text-[10px] font-black text-foreground leading-tight truncate uppercase">{toSentenceCase(p.name)}</div>
                <div className="text-[10px] text-primary font-black mt-1">MK {p.sellPrice.toLocaleString()}</div>
              </div>
            </div>
          ))}
          <div 
            onClick={() => document.getElementById('product-search')?.focus()}
            className="glass-card bg-primary/10 border border-primary/20 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer text-primary btn-press"
          >
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20"><Plus className="w-5 h-5"/></div>
            <span className="text-[10px] font-black uppercase tracking-widest mt-1">More</span>
          </div>
        </div>
      </div>

      <div className="p-6 pt-2">
        <h3 className="font-black text-foreground mb-4 uppercase tracking-widest text-[11px] ml-1">Payment Channel</h3>
        <div className="grid grid-cols-4 gap-3">
          <button onClick={() => { setPaymentMode('Cash'); setSelectedSubMethod(''); }} className={clsx("flex flex-col items-center justify-center py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all btn-press shadow-sm", paymentMode==='Cash' ? "bg-success text-white shadow-lg shadow-success/30 ring-2 ring-success ring-offset-2" : "bg-card text-muted-foreground border border-border/50")}>
             <Banknote className="w-5 h-5 mb-2" /> Cash
          </button>
          <button onClick={() => { setPaymentMode('Card'); setSelectedSubMethod(paymentConfig.bank[0] || ''); }} className={clsx("flex flex-col items-center justify-center py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all btn-press shadow-sm", paymentMode==='Card' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-primary ring-offset-2" : "bg-card text-muted-foreground border border-border/50")}>
             <CreditCard className="w-5 h-5 mb-2" /> Bank Card
          </button>
          <button onClick={() => { setPaymentMode('Momo'); setSelectedSubMethod(paymentConfig.momo[0] || ''); }} className={clsx("flex flex-col items-center justify-center py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all btn-press shadow-sm", paymentMode==='Momo' ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30 ring-2 ring-amber-500 ring-offset-2" : "bg-card text-muted-foreground border border-border/50")}>
             <Smartphone className="w-5 h-5 mb-2" /> Mobile Pay
          </button>
          <button onClick={() => { setPaymentMode('Credit'); setSelectedSubMethod(''); }} className={clsx("flex flex-col items-center justify-center py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all btn-press shadow-sm", paymentMode==='Credit' ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-600 ring-offset-2" : "bg-card text-muted-foreground border border-border/50")}>
             <User className="w-5 h-5 mb-2" /> Ledger
          </button>
        </div>

        {(paymentMode === 'Card' || paymentMode === 'Momo') && (
          <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-500 stagger-children">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 block ml-1">
              Confirm {paymentMode === 'Card' ? 'Bank Account' : 'Momo Channel'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(paymentMode === 'Card' ? paymentConfig.bank : paymentConfig.momo).map(method => (
                <button
                  key={method}
                  onClick={() => setSelectedSubMethod(method)}
                  className={clsx(
                    "px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 text-center btn-press",
                    selectedSubMethod === method 
                      ? "bg-primary/5 border-primary text-primary shadow-sm" 
                      : "bg-card border-border/50 text-muted-foreground/40 hover:border-border hover:text-muted-foreground"
                  )}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 pt-2">
        <h3 className="font-black text-foreground mb-4 uppercase tracking-widest text-[11px] ml-1">Post-Sale Workflow</h3>
        <div className="flex gap-4">
           <label className="flex-1 flex items-center justify-between p-5 bg-card border border-border/50 rounded-2xl cursor-pointer hover:border-primary/20 transition-all shadow-sm">
              <div className="flex items-center gap-3 text-[10px] text-foreground font-black uppercase tracking-widest"><Printer className="w-4 h-4 text-muted-foreground"/> Auto-Print</div>
              <input title="Print Receipt" type="checkbox" checked={printReceipt} onChange={e => setPrintReceipt(e.target.checked)} className="w-5 h-5 accent-primary rounded-lg" />
           </label>
           <label className="flex-1 flex items-center justify-between p-5 bg-card border border-border/50 rounded-2xl cursor-pointer hover:border-success/20 transition-all shadow-sm">
              <div className="flex items-center gap-3 text-[10px] text-foreground font-black uppercase tracking-widest"><MessageCircle className="w-4 h-4 text-success"/> Digital Copy</div>
              <input title="Send via WhatsApp" type="checkbox" checked={sendWhatsapp} onChange={e => setSendWhatsapp(e.target.checked)} className="w-5 h-5 accent-success rounded-lg" />
           </label>
        </div>
      </div>

      <div className="p-6 pt-4 pb-12">
        <button 
          disabled={cart.length === 0 || isCheckingOut} 
          onClick={handleCheckout} 
          className={clsx(
            "w-full py-6 text-white font-black rounded-[2rem] flex items-center justify-center gap-3 text-[12px] tracking-[0.3em] transition-all shadow-2xl uppercase btn-press", 
            cart.length === 0 ? "bg-muted-foreground/20 cursor-not-allowed grayscale" : "bg-primary shadow-primary/40 hover:shadow-primary/60"
          )}
        >
          <CheckCircle2 className="w-6 h-6" /> Commit Transaction
        </button>
      </div>

    </div>
  );
};

export default POSPage;
