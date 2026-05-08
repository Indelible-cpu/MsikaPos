import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  MessageCircle as WhatsAppIcon,
  Phone,
  Calendar,
  FileText,
  ShieldAlert,
  Building2,
  MessageSquare,
  Package,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
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
  const [printReceipt] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);

  // Credit Sale Flow
  const [creditMode, setCreditMode] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [witnessPhone, setWitnessPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [village, setVillage] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [printInvoice, setPrintInvoice] = useState(true);
  const [showAll, setShowAll] = useState(false);

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
      // Always fetch active products first as base
      const allActive = await db.products.where('status').equals('ACTIVE').filter(p => !p.deleted).toArray();
      
      if (searchTerm.length >= 1) {
        const term = searchTerm.toLowerCase();
        return allActive.filter(p => 
          p.name.toLowerCase().includes(term) || 
          p.sku.toLowerCase().includes(term)
        );
      }
      return allActive;
    },
    [searchTerm]
  );

  const [randomSeed, setRandomSeed] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRandomSeed(Date.now());
    }, 30000); // Rotate products every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const displayedProducts = useMemo(() => {
    if (!products) return [];
    if (searchTerm.length >= 1 || showAll) return products;
    
    // Deterministic shuffle within the interval window
    const shuffled = [...products].sort((a, b) => {
      const hashA = (a.id * 13 + randomSeed) % 100;
      const hashB = (b.id * 13 + randomSeed) % 100;
      return hashA - hashB;
    });
    return shuffled.slice(0, 30); // Show 30 products (at least 5 rows on mobile)
  }, [products, searchTerm, showAll, randomSeed]);

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

  const changeDue = Math.max(0, (parseFloat(amountReceived) || 0) - finalTotal);

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
        paid: parseFloat(amountReceived) || finalTotal,
        changeDue: changeDue,
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
        paid: parseFloat(amountReceived) || finalTotal,
        change: changeDue
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
        witnessPhone: witnessPhone,
        idNumber: idNumber.toUpperCase().substring(0, 8),
        village: village,
        balance: balance,
        totalCreditAmount: finalTotal,
        totalPaidAmount: paidAmt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: 0
      };
      await db.customers.add(newCustomer);

      // Record initial deposit in history
      if (paidAmt > 0) {
        await db.debtPayments.add({
          id: crypto.randomUUID(),
          customerId: customerId,
          amount: paidAmt,
          paymentMethod: 'Cash',
          cashierName: user.fullname || 'Cashier',
          createdAt: new Date().toISOString(),
          synced: 0,
          reference: 'INITIAL DEPOSIT'
        });
      }

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
      setWitnessPhone('');
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
           <h2 className="text-lg font-bold capitalize tracking-tight">Register Credit Sale</h2>
        </div>
        
        <div className="p-6 space-y-8 pb-24">
           <div className="space-y-4">
             <h3 className="font-bold text-foreground capitalize tracking-widest text-[10px] ml-1 opacity-50">Customer Verification</h3>
             <div className="glass-card rounded-3xl border border-border overflow-hidden shadow-sm bg-card">
               <div className="flex items-center px-6 py-4 border-b border-border/50 focus-within:bg-primary/5 transition-colors">
                 <User className="w-5 h-5 text-primary mr-4" />
                 <input title="Customer Name" aria-label="Customer Name" className="w-full bg-transparent outline-none text-sm text-foreground font-bold placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="Full Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
               </div>
               <div className="flex items-center px-6 py-4 border-b border-border/50 focus-within:bg-primary/5 transition-colors">
                 <WhatsAppIcon className="w-5 h-5 text-emerald-500 fill-emerald-500/20 mr-4" />
                 <input title="Phone Number" aria-label="Phone Number" className="w-full bg-transparent outline-none text-sm text-foreground font-bold placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="Phone Number" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} />
               </div>
               <div className="flex items-center px-6 py-4 border-b border-border/50 focus-within:bg-primary/5 transition-colors">
                 <Phone className="w-5 h-5 text-primary mr-4" />
                 <input title="Witness Phone" aria-label="Witness Phone" className="w-full bg-transparent outline-none text-sm text-foreground font-bold placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="Witness Phone" value={witnessPhone} onChange={e => setWitnessPhone(e.target.value)} />
               </div>
               <div className="flex items-center px-6 py-4 border-b border-border/50 focus-within:bg-primary/5 transition-colors">
                 <ShieldAlert className="w-5 h-5 text-amber-500 mr-4" />
                 <input title="National ID" aria-label="National ID" maxLength={8} className="w-full bg-transparent outline-none text-sm text-foreground font-bold placeholder:font-normal placeholder:text-muted-foreground/30 uppercase" placeholder="National ID (Max 8)" value={idNumber} onChange={e => setIdNumber(e.target.value.toUpperCase().substring(0, 8))} />
               </div>
               <div className="flex items-center px-6 py-4 focus-within:bg-primary/5 transition-colors">
                 <Building2 className="w-5 h-5 text-blue-500 mr-4" />
                 <input title="Location / Village" aria-label="Location / Village" className="w-full bg-transparent outline-none text-sm text-foreground font-bold placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="Location / Village" value={village} onChange={e => setVillage(e.target.value)} />
               </div>
             </div>
           </div>

           <div className="space-y-4">
             <h3 className="font-bold text-foreground capitalize tracking-widest text-[10px] ml-1 opacity-50">Sale Summary</h3>
             <div className="glass-card rounded-3xl border border-border p-6 space-y-5 shadow-sm bg-card">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-bold capitalize tracking-widest text-[10px]">Total Amount</span>
                  <span className="font-bold text-foreground text-lg">MK {finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-bold capitalize tracking-widest text-[10px]">Initial Deposit</span>
                  <input title="Initial Deposit" aria-label="Initial Deposit" type="number" className="w-32 bg-muted/20 border border-border rounded-xl px-4 py-2.5 text-right outline-none focus:ring-2 focus:ring-primary font-bold" placeholder="0.00" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-bold capitalize tracking-widest text-[10px]">Balance Due</span>
                  <span className="font-bold text-destructive text-lg">MK {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-4 border-t border-border/50">
                  <span className="text-muted-foreground font-bold capitalize tracking-widest text-[10px]">Promise Date</span>
                 <div className="relative">
                   <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                   <input title="Due Date" aria-label="Due Date" type="date" className="pl-10 pr-4 py-2.5 bg-muted/20 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary text-foreground text-xs font-black uppercase" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                 </div>
               </div>
             </div>
           </div>

           <div className="space-y-4">
             <h3 className="font-bold text-foreground capitalize tracking-widest text-[10px] ml-1 opacity-50">Documentation</h3>
             <div className="glass-card rounded-3xl border border-border overflow-hidden shadow-sm bg-card">
                <label className="flex items-center justify-between px-6 py-4 border-b border-border/50 cursor-pointer hover:bg-muted/10 transition-colors">
                   <div className="flex items-center gap-4 text-[11px] text-foreground font-bold capitalize tracking-widest"><Printer className="w-4 h-4 text-muted-foreground" /> Print Official Invoice</div>
                   <input title="Print Invoice" type="checkbox" className="w-5 h-5 accent-primary rounded-lg" checked={printInvoice} onChange={e => setPrintInvoice(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-muted/10 transition-colors">
                   <div className="flex items-center gap-4 text-[11px] text-foreground font-bold capitalize tracking-widest"><WhatsAppIcon className="w-4 h-4 text-emerald-500 fill-emerald-500/10" /> Send Copy Via WhatsApp</div>
                   <input title="Send via WhatsApp" type="checkbox" className="w-5 h-5 accent-success rounded-lg" checked={sendWhatsapp} onChange={e => setSendWhatsapp(e.target.checked)} />
                </label>
             </div>
           </div>

           <div className="pt-6">
             <button onClick={handleSaveCreditSale} disabled={isCheckingOut} className="w-full py-5 bg-success text-white font-bold rounded-[2rem] flex items-center justify-center gap-3 text-[11px] tracking-[0.2em] active:scale-95 transition-all shadow-xl shadow-success/20 capitalize">
               <FileText className="w-5 h-5" /> Save Credit Sale
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
            <div className="max-h-[50vh] overflow-y-auto bg-card p-6" id="receipt-print">
               <Receipt {...showReceipt} />
            </div>
            <div className="p-6 bg-muted/30 border-t border-border/50 flex gap-4">
              <button 
                onClick={async () => {
                  const receiptElement = document.getElementById('receipt-print');
                  if (!receiptElement) return;
                  toast.loading('Generating shareable receipt...', { id: 'share' });
                  try {
                    const canvas = await html2canvas(receiptElement, { scale: 2, backgroundColor: '#ffffff' });
                    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                    if (!blob) throw new Error('Blob error');
                    const file = new File([blob], `Receipt-${showReceipt.invoiceNo}.png`, { type: 'image/png' });
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({ files: [file], title: 'Receipt', text: `Receipt from ${localStorage.getItem('companyName') || 'MsikaPos'}` });
                      toast.success('Shared successfully', { id: 'share' });
                    } else {
                      const text = encodeURIComponent(`Receipt from ${localStorage.getItem('companyName') || 'MsikaPos'}\nInvoice: ${showReceipt.invoiceNo}\nTotal: MK ${showReceipt.total.toLocaleString()}\nThank you!`);
                      window.open(`https://wa.me/?text=${text}`, '_blank');
                      toast.success('WhatsApp opened', { id: 'share' });
                    }
                  } catch (e) {
                    toast.error('Failed to share', { id: 'share' });
                  }
                }}
                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-bold tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 capitalize"
              >
                <MessageSquare className="w-4 h-4" /> Share WhatsApp
              </button>
              <button onClick={() => setShowReceipt(null)} className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl font-bold capitalize tracking-widest text-[11px] btn-press">New Sale</button>
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
          className="flex items-center gap-2 px-6 py-3 bg-primary/10 text-primary border border-primary/20 font-bold rounded-2xl active:scale-95 transition-all text-[10px] tracking-widest capitalize"
        >
          <Scan className="w-5 h-5" /> Scan
        </button>
      </div>

      {cart.length > 0 && (
      <div className="py-6 space-y-4">
        <div className="px-6 flex justify-between items-center">
          <h3 className="font-bold text-foreground capitalize tracking-widest text-[11px] ml-1">Current Order ({cart.length})</h3>
          <div className="flex gap-4">
            <button title="Clear Cart" aria-label="Clear Cart" onClick={() => setCart([])} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive font-bold capitalize tracking-widest transition-all">
              <Trash2 className="w-3.5 h-3.5" /> Clear Order
            </button>
          </div>
        </div>
        <div className="bg-card border-y border-border/50 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground font-bold border-b border-border/50 text-[9px] capitalize tracking-widest">
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
            </tbody>
          </table>
          <div className="p-6 bg-muted/10 border-t border-border/50 flex flex-col items-end gap-3 text-sm">
            <div className="flex justify-between w-full max-w-xs"><span className="text-muted-foreground font-bold text-[10px] capitalize tracking-widest">Subtotal</span><span className="font-bold text-foreground">MK {cartSubtotal.toLocaleString()}</span></div>
            
            <div className="flex justify-between items-center w-full max-w-xs">
              <span className="text-muted-foreground font-bold text-[10px] capitalize tracking-widest">Apply Discount</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">MK</span>
                <input 
                  type="number" 
                  title="Discount Amount"
                  placeholder="0.00"
                  className="w-32 bg-background border border-border/50 rounded-xl px-9 py-2 text-right text-[11px] font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={discount || ''} 
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} 
                />
              </div>
            </div>

            {taxConfig.rate > 0 && <div className="flex justify-between w-full max-w-xs"><span className="text-muted-foreground font-bold text-[10px] capitalize tracking-widest">Tax ({taxConfig.rate}%)</span><span className="font-bold text-foreground">MK {taxAmount.toLocaleString()}</span></div>}
            <div className="flex justify-between w-full max-w-xs text-xl font-bold mt-2 pt-4 border-t border-border/20"><span className="text-foreground capitalize tracking-tighter">TOTAL AMOUNT</span><span className="text-primary tracking-tighter">MK {finalTotal.toLocaleString()}</span></div>
          </div>
        </div>
      </div>
      )}

      <div className="p-6 pt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-foreground capitalize tracking-widest text-[11px] ml-1">Stock inventory</h3>
          <button 
            title="View All Products" 
            aria-label="View All Products" 
            onClick={() => { setShowAll(!showAll); setSearchTerm(''); }}
            className="text-[10px] text-primary font-bold capitalize tracking-widest hover:underline"
          >
            {showAll ? 'Collapse' : 'Full catalog'}
          </button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 min-h-[400px]">
          {displayedProducts.map((p: LocalProduct) => (
            <div key={p.id} onClick={() => addToCart(p)} className="glass-card bg-card border border-border/50 rounded-2xl p-2.5 flex flex-col items-center gap-2 cursor-pointer btn-press group hover:border-primary/30 transition-all shadow-sm relative overflow-hidden">
              <div className="w-12 h-12 flex items-center justify-center bg-muted/20 rounded-xl group-hover:scale-110 transition-transform overflow-hidden relative border border-border/30">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-primary/5">
                    <Package className="w-5 h-5 text-primary/20" />
                    <span className="text-[6px] font-bold text-primary/20 absolute bottom-1.5 uppercase tracking-tight">{p.isService ? 'Srv' : 'Item'}</span>
                  </div>
                )}
              </div>
              <div className="text-center w-full">
                <div className="text-[9px] font-bold text-foreground leading-tight truncate px-1 capitalize">{toSentenceCase(p.name)}</div>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  <div className="text-[9px] text-primary font-bold">MK {p.sellPrice.toLocaleString()}</div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.success(`${p.name}\nStock: ${p.quantity}\nSKU: ${p.sku}`, { icon: 'ℹ️', duration: 3000 });
                    }}
                    className="p-1 hover:bg-primary/10 rounded-full transition-colors"
                  >
                    <Info className="w-2.5 h-2.5 text-primary/40" />
                  </button>
                </div>
              </div>
              {p.quantity <= 5 && !p.isService && (
                <div className="absolute top-1 right-1">
                   <div className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
                </div>
              )}
            </div>
          ))}
          {!showAll && products && products.length > 24 && (
            <div 
              onClick={() => setShowAll(true)}
              className="glass-card bg-primary/10 border border-primary/20 rounded-3xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer text-primary btn-press hover:bg-primary/20 transition-all shadow-sm"
            >
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20"><Plus className="w-5 h-5"/></div>
              <span className="text-[10px] font-bold capitalize tracking-widest mt-1">Full catalog</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 pt-2">
        <h3 className="font-black text-foreground mb-4 uppercase tracking-widest text-[11px] ml-1">Payment Channel</h3>
        <div className="grid grid-cols-4 gap-3">
          <button onClick={() => { setPaymentMode('Cash'); setSelectedSubMethod(''); }} className={clsx("flex flex-col items-center justify-center py-2.5 rounded-xl font-bold text-[9px] capitalize tracking-widest transition-all btn-press shadow-sm", paymentMode==='Cash' ? "bg-success text-white shadow-lg shadow-success/30 ring-2 ring-success ring-offset-2" : "bg-card text-muted-foreground border border-border/50")}>
             <Banknote className="w-4 h-4 mb-1" /> Cash
          </button>
          <button onClick={() => { setPaymentMode('Card'); setSelectedSubMethod(paymentConfig.bank[0] || ''); }} className={clsx("flex flex-col items-center justify-center py-2.5 rounded-xl font-bold text-[9px] capitalize tracking-widest transition-all btn-press shadow-sm", paymentMode==='Card' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-primary ring-offset-2" : "bg-card text-muted-foreground border border-border/50")}>
             <CreditCard className="w-4 h-4 mb-1" /> Card
          </button>
          <button onClick={() => { setPaymentMode('Momo'); setSelectedSubMethod(paymentConfig.momo[0] || ''); }} className={clsx("flex flex-col items-center justify-center py-2.5 rounded-xl font-bold text-[9px] capitalize tracking-widest transition-all btn-press shadow-sm", paymentMode==='Momo' ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30 ring-2 ring-amber-500 ring-offset-2" : "bg-card text-muted-foreground border border-border/50")}>
             <Smartphone className="w-4 h-4 mb-1" /> Mobile
          </button>
          <button onClick={() => { setPaymentMode('Credit'); setSelectedSubMethod(''); }} className={clsx("flex flex-col items-center justify-center py-2.5 rounded-xl font-bold text-[9px] capitalize tracking-widest transition-all btn-press shadow-sm", paymentMode==='Credit' ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-600 ring-offset-2" : "bg-card text-muted-foreground border border-border/50")}>
             <User className="w-4 h-4 mb-1" /> Credit
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

      {paymentMode === 'Cash' && cart.length > 0 && (
        <div className="p-6 pt-2 animate-in fade-in slide-in-from-bottom-2">
           <div className="glass-card bg-card border border-border/50 rounded-2xl p-5 flex items-center justify-between gap-6 shadow-sm">
             <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest">Amount received</label>
                <input title="Amount Received" aria-label="Amount Received" type="number" className="w-full bg-transparent text-xl font-bold text-foreground outline-none border-b border-border/50 pb-1" placeholder="0.00" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} />
             </div>
             <div className="text-right space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest">Change due</div>
                <div className="text-xl font-bold text-primary">MK {changeDue.toLocaleString()}</div>
             </div>
           </div>
        </div>
      )}

      <div className="p-6 pt-2 pb-12">
        <button 
          disabled={cart.length === 0 || isCheckingOut} 
          onClick={handleCheckout} 
          className={clsx(
            "w-full py-6 text-white font-bold rounded-[2rem] flex items-center justify-center gap-3 text-[12px] tracking-[0.3em] transition-all shadow-2xl capitalize btn-press", 
            cart.length === 0 ? "bg-muted-foreground/20 cursor-not-allowed grayscale" : "bg-primary shadow-primary/40 hover:shadow-primary/60"
          )}
        >
          <CheckCircle2 className="w-6 h-6" /> Checkout
        </button>
      </div>
    </div>
  );
};

export default POSPage;
