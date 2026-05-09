import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import type { LocalProduct, LocalSale, LocalSaleItem, LocalCustomer } from '../db/posDB';
import { SyncService } from '../services/SyncService';
import { apiFetch } from '../api/apiFetch';
import { isValidMalawianPhone, restrictPhone } from '../utils/phoneUtils';

import { 
  Search, 
  Scan, 
  Trash2,
  Printer,
  CheckCircle2,
  X,
  ChevronLeft,
  Plus,
  Minus,
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
  ShoppingCart,
  RefreshCw
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

const ProductCard = React.memo(({ p, addToCart }: { p: LocalProduct; addToCart: (p: LocalProduct) => void }) => {
  const getPlaceholder = () => {
    const name = (p.name || '').toLowerCase();
    if (p.isService || name.includes('print') || name.includes('copy') || name.includes('scan') || name.includes('solution') || name.includes('service')) {
      return "/stationery_services_placeholder.png";
    }
    if (name.includes('pen') || name.includes('book') || name.includes('paper') || name.includes('staple') || name.includes('office') || name.includes('stationery')) {
      return "/stationery_items_placeholder.png";
    }
    return "/phone_accessories_placeholder.png";
  };

  return (
    <div onClick={() => addToCart(p)} className="aspect-square bg-card flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 active:bg-primary/5 transition-all relative group">
      <div className="w-full flex-1 flex items-center justify-center relative overflow-hidden p-2">
        {p.imageUrl ? (
          <img src={p.imageUrl.split('|')[0]} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
        ) : (
          <img 
            src={getPlaceholder()} 
            alt="placeholder" 
            className="w-full h-full object-contain opacity-100 group-hover:scale-105 transition-transform drop-shadow-md" 
          />
        )}
      </div>
      <div className="text-center w-full px-2 pb-2">
        <div className="text-[8px] md:text-[10px] font-black text-foreground leading-none truncate uppercase tracking-tighter">{p.name}</div>
        <div className="text-[9px] md:text-[11px] text-primary font-black mt-1">MK {p.sellPrice.toLocaleString()}</div>
      </div>
      {p.quantity <= 5 && !p.isService && (
        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
      )}
    </div>
  );
});




const POSPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'Momo' | 'Credit'>('Cash');
  const [cart, setCart] = useState<{ product: LocalProduct; quantity: number }[]>(() => {
    const saved = localStorage.getItem('posCart');
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });
  const [showScanner, setShowScanner] = useState(false);
  const [discount, setDiscount] = useState<number>(() => {
    const saved = localStorage.getItem('posDiscount');
    return parseFloat(saved || '0') || 0;
  });
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

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [livePhoto, setLivePhoto] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flashOn, setFlashOn] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  // Persistence logic
  useEffect(() => {
    localStorage.setItem('posCart', JSON.stringify(cart));
    localStorage.setItem('posDiscount', discount.toString());
  }, [cart, discount]);

  const startCamera = async (mode = facingMode) => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode } 
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraOpen(true);
      setFlashOn(false);
    } catch {
      toast.error('Could not access camera');
    }
  };

  const toggleFlash = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
    if (caps && caps.torch) {
      try {
        await track.applyConstraints({ advanced: [{ torch: !flashOn }] } as unknown as MediaTrackConstraints);
        setFlashOn(!flashOn);
      } catch {
        toast.error('Flashlight error');
      }
    } else {
      toast.error('Flashlight not supported on this camera');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      setLivePhoto(canvas.toDataURL('image/jpeg', 0.7));
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setIsCameraOpen(false);
  };

  const [taxConfig, setTaxConfig] = useState<TaxConfig>({ rate: 10, inclusive: false });
  const [currentInvoiceNo, setCurrentInvoiceNo] = useState(generateInvoiceNo());


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
    // Trigger background sync on mount to ensure we have the latest remote data
    SyncService.pushSales().catch(console.error);
  }, []);


  const user = JSON.parse(localStorage.getItem('user') || '{}');


  const [isRemoteLoading, setIsRemoteLoading] = useState(false);

  const localProducts = useLiveQuery(
    async () => {
      const all = await db.products.toArray();
      const allActive = all.filter(p => !p.deleted && (!p.status || p.status.toLowerCase() === 'active'));

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

  // Effect to fetch from remote DB in background to keep local fresh
  useEffect(() => {
    let isMounted = true;
    const fetchRemote = async () => {
      if (!navigator.onLine) return;
      setIsRemoteLoading(true);
      try {
        console.log('🔍 Fetching products...', searchTerm ? `Search: ${searchTerm}` : 'All');
        const data = await apiFetch(searchTerm ? `/products?search=${encodeURIComponent(searchTerm)}` : '/products');
        console.log('📦 Received products data:', data);
        if (isMounted && data.success) {
          const items = data.data || data.updates?.products || [];
          console.log(`✅ Processing ${items.length} products`);
          if (items.length > 0) {
            await db.products.bulkPut(items);
          }
        }
      } catch (e) {
        console.error('Remote fetch failed:', e);
      } finally {
        if (isMounted) setIsRemoteLoading(false);
      }
    };

    const debounce = setTimeout(fetchRemote, searchTerm ? 500 : 2000);
    return () => { isMounted = false; clearTimeout(debounce); };
  }, [searchTerm]);

  const products = React.useMemo(() => localProducts || [], [localProducts]);

  const displayedProducts = useMemo(() => {
    if (!products) return [];
    if (searchTerm.length >= 1 || showAll || products.length <= 48) return products;
    
    // Pick 48 items to show initially on desktop/large screens
    return products.slice(0, 48);
  }, [products, searchTerm, showAll]);

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

  const decreaseQuantity = useCallback((productId: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === productId);
      if (existing && existing.quantity > 1) {
        soundService.playBeep();
        return prev.map(item => item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(i => i.product.id !== productId);
    });
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
        tax: Number(taxAmount || 0),
        total: Number(finalTotal || 0),
        paid: Number(parseFloat(amountReceived) || finalTotal || 0),
        changeDue: Number(changeDue || 0),
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
      setDiscount(0);
      localStorage.removeItem('posCart');
      localStorage.removeItem('posDiscount');
      setCurrentInvoiceNo(generateInvoiceNo());
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
    if (!isValidMalawianPhone(whatsappNumber)) return toast.error("Invalid phone format");
    if (witnessPhone && !isValidMalawianPhone(witnessPhone)) return toast.error("Invalid witness phone");
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
        livePhoto: livePhoto || undefined,
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
        tax: Number(taxAmount || 0),
        total: Number(finalTotal || 0),
        paid: Number(paidAmt || 0),
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
      setDiscount(0);
      localStorage.removeItem('posCart');
      localStorage.removeItem('posDiscount');
      setCurrentInvoiceNo(generateInvoiceNo());
      setCreditMode(false);
      setCustomerName('');
      setWhatsappNumber('');
      setWitnessPhone('');
      setIdNumber('');
      setVillage('');
      setAmountPaid('');
      setDueDate('');
      setPaymentMode('Cash');
      setLivePhoto('');
      
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
      <div className="flex flex-col h-full bg-background overflow-y-auto w-full relative stagger-children">

        <div className="bg-primary text-primary-foreground flex items-center px-6 py-5 sticky top-0 z-10 shadow-lg">
           <button title="Go back" aria-label="Go back" onClick={() => setCreditMode(false)} className="mr-4 active:scale-90 transition-transform"><ChevronLeft className="w-6 h-6" /></button>
           <h2 className="text-lg font-bold tracking-tight">Register credit sale</h2>
        </div>
        
        <div className="p-6 space-y-8 pb-24">
           <div className="space-y-4">
             <h3 className="font-bold text-foreground tracking-widest text-[10px] ml-1 opacity-50">Customer verification</h3>
             <div className="glass-card rounded-3xl border border-border overflow-hidden shadow-sm bg-card">
               <div className="flex items-center px-6 py-4 border-b border-border/50 focus-within:bg-primary/5 transition-colors">
                 <User className="w-5 h-5 text-primary mr-4" />
                 <input title="Customer name" aria-label="Customer name" className="w-full bg-transparent outline-none text-sm text-foreground font-bold placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="Full name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
               </div>
               <div className="flex items-center px-6 py-4 border-b border-border/50 focus-within:bg-primary/5 transition-colors">
                 <WhatsAppIcon className="w-5 h-5 text-emerald-500 fill-emerald-500/20 mr-4" />
                 <div className="flex-1">
                   <input title="Phone number" aria-label="Phone number" className="w-full bg-transparent outline-none text-sm text-foreground font-bold placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="Phone (e.g. 0... or +265...)" value={whatsappNumber} onChange={e => setWhatsappNumber(restrictPhone(e.target.value))} />
                   <div className="text-[7px] text-muted-foreground font-black tracking-widest mt-0.5">10 digits if starts with 0, 13 if +265</div>
                 </div>
               </div>
               <div className="flex items-center px-6 py-4 border-b border-border/50 focus-within:bg-primary/5 transition-colors">
                 <Phone className="w-5 h-5 text-primary mr-4" />
                 <input title="Witness phone" aria-label="Witness phone" className="w-full bg-transparent outline-none text-sm text-foreground font-bold placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="Witness phone" value={witnessPhone} onChange={e => setWitnessPhone(restrictPhone(e.target.value))} />
               </div>
               <div className="flex items-center px-6 py-4 border-b border-border/50 focus-within:bg-primary/5 transition-colors">
                 <ShieldAlert className="w-5 h-5 text-amber-500 mr-4" />
                 <input title="National ID" aria-label="National ID" maxLength={8} className="w-full bg-transparent outline-none text-sm text-foreground font-bold placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="National ID (Max 8)" value={idNumber} onChange={e => setIdNumber(e.target.value.toUpperCase().substring(0, 8))} />
               </div>
               <div className="flex items-center px-6 py-4 focus-within:bg-primary/5 transition-colors">
                 <Building2 className="w-5 h-5 text-blue-500 mr-4" />
                 <input title="Location / Village" aria-label="Location / Village" className="w-full bg-transparent outline-none text-sm text-foreground font-bold placeholder:font-normal placeholder:text-muted-foreground/30" placeholder="Location / village" value={village} onChange={e => setVillage(e.target.value)} />
               </div>
             </div>
           </div>

            <div className="space-y-4">
              <h3 className="font-bold text-foreground capitalize tracking-widest text-[10px] ml-1 opacity-50">Customer Photo</h3>
              <div className="glass-card rounded-3xl border border-border overflow-hidden shadow-sm bg-card p-6 flex flex-col items-center">
                {livePhoto ? (
                  <div className="relative w-32 h-32 rounded-2xl overflow-hidden mb-4 border border-border">
                    <img src={livePhoto} alt="Customer" className="w-full h-full object-cover" />
                    <button title="Remove Photo" aria-label="Remove Photo" onClick={() => setLivePhoto('')} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center mb-4 text-muted-foreground/50">
                    <User className="w-10 h-10" />
                  </div>
                )}
                {!livePhoto && (
                  <button onClick={() => startCamera()} className="btn-primary !py-3 !px-6 text-[10px] font-bold tracking-widest flex items-center gap-2 uppercase">
                    <Scan className="w-4 h-4" /> Take Photo
                  </button>
                )}
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
                  <div className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground opacity-40 group-focus-within:opacity-100 transition-opacity">MK</span>
                    <input title="Initial Deposit" aria-label="Initial Deposit" type="number" className="w-32 bg-muted/20 border border-border rounded-xl pl-9 pr-4 py-2.5 text-right outline-none focus:ring-2 focus:ring-primary font-bold" placeholder="0.00" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
                  </div>
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

        {/* Camera Modal */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col">
            <div className="p-4 flex justify-between items-center bg-black/50">
              <button title="Switch Camera" aria-label="Switch Camera" onClick={() => {
                const newMode = facingMode === 'user' ? 'environment' : 'user';
                setFacingMode(newMode);
                startCamera(newMode);
              }} className="p-3 bg-white/20 rounded-full text-white"><Scan className="w-5 h-5" /></button>
              <button title="Toggle Flash" aria-label="Toggle Flash" onClick={toggleFlash} className={clsx("p-3 rounded-full text-white", flashOn ? "bg-amber-500" : "bg-white/20")}><Smartphone className="w-5 h-5" /></button>
              <button title="Close Camera" aria-label="Close Camera" onClick={stopCamera} className="p-3 bg-white/20 rounded-full text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
              <div className="absolute inset-0 border-4 border-dashed border-white/20 pointer-events-none m-8 rounded-3xl" />
            </div>
            <div className="p-8 pb-12 flex justify-center bg-black/50">
              <button title="Capture Photo" aria-label="Capture Photo" onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-white/50 active:scale-95 transition-transform" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full bg-background overflow-hidden w-full relative">
      {/* Modals & Overlays */}
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
            <div className="max-h-[60vh] overflow-y-auto bg-card p-4 custom-scrollbar">
              <div id="receipt-print" className="bg-white p-4 rounded-xl">
                <Receipt {...showReceipt} />
              </div>
            </div>

            <div className="p-6 bg-muted/30 border-t border-border/50 flex gap-4">
              <button 
                onClick={async () => {
                  const receiptElement = document.getElementById('receipt-print');
                  if (!receiptElement) return;
                  toast.loading('Generating shareable receipt...', { id: 'share' });
                  try {
                    const canvas = await html2canvas(receiptElement, { 
                      scale: 3, 
                      backgroundColor: '#ffffff',
                      useCORS: true,
                      logging: false,
                      windowWidth: 400 
                    });

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
                  } catch {
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

      {/* Left Pane: Products & Search */}
      <div className="flex-1 flex flex-col min-h-0 border-r border-border/10 overflow-hidden bg-muted/5">
        {/* Sticky Header for Search */}
        <div className="flex gap-2 p-3 md:p-4 bg-card/80 backdrop-blur-md z-10 shadow-sm border-b border-border/50">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              id="product-search"
              title="Search Products"
              aria-label="Search Products"
              className={clsx(
                "w-full pl-10 pr-10 py-3 bg-muted/20 border border-border rounded-2xl outline-none text-sm text-foreground font-medium placeholder:font-normal focus:ring-2 focus:ring-primary/50 transition-all",
                isRemoteLoading && "animate-pulse border-primary/30"
              )} 
              placeholder={isRemoteLoading ? "Searching remote DB..." : "Search items..."}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                title="Clear Search"
                aria-label="Clear Search"
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-background/50 rounded-full p-1 transition-all active:scale-90"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button 
            title="Refresh Products"
            aria-label="Refresh Products"
            onClick={() => {
              toast.promise(SyncService.pushSales(), {
                loading: 'Updating list...',
                success: 'Products refreshed',
                error: 'Refresh failed'
              });
            }}
            className="p-3 bg-muted/10 border border-border rounded-2xl text-muted-foreground hover:bg-muted/20 transition-all flex items-center justify-center btn-press"
          >
            <RefreshCw className={clsx("w-5 h-5", isRemoteLoading && "animate-spin")} />
          </button>
          <button 
            title="Scan Barcode"
            aria-label="Scan Barcode"
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 px-4 md:px-6 py-3 bg-primary/10 text-primary border border-primary/20 font-bold rounded-2xl active:scale-95 transition-all text-[10px] tracking-widest capitalize"
          >
            <Scan className="w-5 h-5" /> <span className="hidden sm:inline">Scan</span>
          </button>
        </div>

        {/* Product Grid Area - Adaptive height on mobile */}
        <div className={clsx(
          "lg:h-auto lg:flex-1 overflow-y-auto p-2 md:p-6 custom-scrollbar bg-card/20",
          cart.length === 0 ? "flex-1" : "h-[280px]"
        )}>
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className="font-bold text-foreground capitalize tracking-widest text-[9px] md:text-[11px]">Stock</h3>


            <button 
              title="View All Products" 
              aria-label="View All Products" 
              onClick={() => { setShowAll(!showAll); setSearchTerm(''); }}
              className="text-[10px] text-primary font-bold capitalize tracking-widest hover:underline"
            >
              {showAll ? 'Collapse' : 'Full catalog'}
            </button>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-[1px] bg-border/50 border border-border/50 rounded-xl overflow-hidden pb-0">


            {displayedProducts.map((p: LocalProduct) => (
              <ProductCard key={p.id} p={p} addToCart={addToCart} />
            ))}
            {!showAll && products && products.length > 24 && (
              <div 
                onClick={() => setShowAll(true)}
                className="glass-card bg-primary/10 border border-primary/20 rounded-3xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer text-primary btn-press hover:bg-primary/20 transition-all shadow-sm aspect-square"
              >
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20"><Plus className="w-5 h-5"/></div>
                <span className="text-[9px] md:text-[10px] font-black capitalize tracking-widest mt-1 text-center">Full catalog</span>
              </div>
            )}
            {displayedProducts.length === 0 && (
              <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 opacity-30">
                <Package className="w-16 h-16" />
                <p className="text-[10px] font-black tracking-widest uppercase">No products found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Pane: Cart & Checkout - Hidden on mobile if empty */}
      <div className={clsx(
        "w-full lg:w-[380px] xl:w-[420px] flex flex-col bg-card border-l border-border/50 shadow-2xl z-20 min-h-0 transition-all",
        cart.length === 0 ? "hidden lg:flex" : "flex"
      )}>

        <div className="p-5 border-b border-border/50 bg-muted/10 flex justify-between items-center">
          <h3 className="font-black text-foreground capitalize tracking-widest text-[11px]">Current Order ({cart.length})</h3>
          {cart.length > 0 && (
            <button title="Clear Cart" aria-label="Clear Cart" onClick={() => { setCart([]); setCurrentInvoiceNo(generateInvoiceNo()); }} className="text-[10px] text-rose-500 font-bold flex items-center gap-1.5 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-all">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
          {cart.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-2 gap-[1px] bg-border/50 border border-border/50 rounded-xl overflow-hidden p-0">
              {cart.map(item => {
                const p = item.product;
                const getPlaceholder = () => {
                  const name = (p.name || '').toLowerCase();
                  if (p.isService || name.includes('print') || name.includes('copy') || name.includes('scan') || name.includes('solution') || name.includes('service')) return "/stationery_services_placeholder.png";
                  if (name.includes('pen') || name.includes('book') || name.includes('paper') || name.includes('staple') || name.includes('office') || name.includes('stationery')) return "/stationery_items_placeholder.png";
                  return "/phone_accessories_placeholder.png";
                };

                return (
                  <div key={p.id} className="aspect-square bg-card flex flex-col items-center justify-center relative group animate-in zoom-in-95 duration-200">
                    <div className="w-full flex-1 flex items-center justify-center relative overflow-hidden p-1">
                      {p.imageUrl ? (
                        <img src={p.imageUrl.split('|')[0]} alt={p.name} className="w-full h-full object-contain" />
                      ) : (
                        <img src={getPlaceholder()} alt="placeholder" className="w-full h-full object-contain" />
                      )}
                    </div>
                    <div className="text-center w-full px-1 pb-2">
                      <div className="text-[8px] md:text-[10px] font-black text-foreground leading-none truncate uppercase tracking-tighter mb-1.5">{p.name}</div>
                      <div className="flex items-center justify-center gap-2">
                        <button title="Decrease Quantity" aria-label="Decrease Quantity" onClick={(e) => { e.stopPropagation(); decreaseQuantity(p.id); }} className="w-6 h-6 bg-muted/80 text-foreground rounded flex items-center justify-center hover:bg-primary hover:text-white transition-colors"><Minus className="w-3 h-3" /></button>
                        <span className="text-[10px] font-black w-4 text-center">{item.quantity}</span>
                        <button title="Increase Quantity" aria-label="Increase Quantity" onClick={(e) => { e.stopPropagation(); addToCart(p); }} className="w-6 h-6 bg-muted/80 text-foreground rounded flex items-center justify-center hover:bg-primary hover:text-white transition-colors"><Plus className="w-3 h-3" /></button>
                      </div>
                      <div className="text-[8px] md:text-[10px] text-primary font-black mt-1">MK {p.sellPrice.toLocaleString()}</div>
                    </div>
                    <button 
                      title="Remove" 
                      onClick={(e) => { e.stopPropagation(); setCart(prev => prev.filter(i => i.product.id !== p.id)); }} 
                      className="absolute top-1 right-1 bg-destructive/80 text-white p-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-destructive"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>

          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 opacity-20 gap-4">
              <div className="w-20 h-20 rounded-full border-4 border-dashed border-muted-foreground flex items-center justify-center">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <p className="text-[10px] font-black tracking-[0.2em] uppercase text-center">Your cart is empty</p>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-5 bg-muted/5 border-t border-border/50 space-y-4">
            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <span>Subtotal</span>
                <span>MK {cartSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Discount</span>
                <div className="relative flex-1 max-w-[140px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-muted-foreground bg-background pr-1">MK</span>
                  <input 
                    title="Discount Amount"
                    aria-label="Discount Amount"
                    placeholder="0"
                    type="number" 
                    className="w-full bg-background border border-border/50 rounded-xl pl-10 pr-3 py-2 text-right text-[11px] font-black focus:ring-2 focus:ring-primary/20 outline-none"
                    value={discount || ''} 
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} 
                  />
                </div>
              </div>
              {taxConfig.rate > 0 && (
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <span>Tax ({taxConfig.rate}%)</span>
                  <span>MK {taxAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-black text-foreground pt-2 border-t border-border/20 tracking-tighter">
                <span className="uppercase text-[12px] tracking-[0.1em]">Total Due</span>
                <span className="text-primary">MK {finalTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Modes */}
            <div className="grid grid-cols-4 gap-2 pt-2">
              {[
                { id: 'Cash', icon: Banknote, color: 'bg-success' },
                { id: 'Card', icon: CreditCard, color: 'bg-primary' },
                { id: 'Momo', icon: Smartphone, color: 'bg-amber-500' },
                { id: 'Credit', icon: User, color: 'bg-purple-600' }
              ].map(mode => (
                <button 
                  key={mode.id}
                  onClick={() => { setPaymentMode(mode.id as 'Cash'|'Card'|'Momo'|'Credit'); setSelectedSubMethod(''); }} 
                  className={clsx(
                    "flex flex-col items-center justify-center py-2.5 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all btn-press", 
                    paymentMode === mode.id ? `${mode.color} text-white shadow-lg` : "bg-card text-muted-foreground border border-border/50"
                  )}
                >
                  <mode.icon className="w-3.5 h-3.5 mb-1" /> {mode.id}
                </button>
              ))}
            </div>

            {/* Sub Methods (Bank/Momo) */}
            {(paymentMode === 'Card' || paymentMode === 'Momo') && (
              <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1">
                {(paymentMode === 'Card' ? paymentConfig.bank : paymentConfig.momo).map(method => (
                  <button
                    key={method}
                    onClick={() => setSelectedSubMethod(method)}
                    className={clsx(
                      "px-2 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border",
                      selectedSubMethod === method 
                        ? "bg-primary text-white border-primary shadow-sm" 
                        : "bg-background border-border/50 text-muted-foreground/60 hover:border-border"
                    )}
                  >
                    {method}
                  </button>
                ))}
              </div>
            )}


            {/* Amount Received Input (Mandatory for all) */}
            <div className="bg-primary/5 rounded-2xl p-4 flex items-center justify-between gap-4 border border-primary/10">
              <div className="flex-1">
                <label className="text-[9px] font-black text-primary/60 tracking-widest mb-1 block">Amount received</label>
                <div className="relative">
                   <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">MK</span>
                   <input 
                    title="Amount Received"
                    aria-label="Amount Received"
                    type="number" 
                    className="w-full bg-transparent text-lg font-black text-foreground outline-none border-b border-primary/20 pb-0.5 pl-8" 
                    placeholder="0.00" 
                    value={amountReceived} 
                    onChange={e => setAmountReceived(e.target.value)} 
                    onFocus={(e) => e.target.select()} 
                   />
                </div>
              </div>
              {paymentMode === 'Cash' && (
                <div className="text-right">
                  <div className="text-[9px] font-black text-muted-foreground tracking-widest mb-1">Change</div>
                  <div className="text-lg font-black text-primary tracking-tighter">MK {changeDue.toLocaleString()}</div>
                </div>
              )}
            </div>

            {/* Checkout Button */}
            <button 
              disabled={
                cart.length === 0 || 
                isCheckingOut || 
                (paymentMode !== 'Credit' && (!amountReceived || parseFloat(amountReceived) < finalTotal)) ||
                ((paymentMode === 'Card' || paymentMode === 'Momo') && !selectedSubMethod)
              } 
              onClick={handleCheckout} 
              className={clsx(
                "w-full py-5 text-white font-black rounded-2xl flex items-center justify-center gap-3 text-[11px] tracking-[0.2em] transition-all shadow-xl btn-press", 
                (cart.length === 0 || (paymentMode !== 'Credit' && (!amountReceived || parseFloat(amountReceived) < finalTotal))) ? "bg-muted-foreground/20 cursor-not-allowed" : "bg-primary shadow-primary/30"
              )}
            >
              <CheckCircle2 className="w-5 h-5" /> {paymentMode === 'Credit' ? 'Proceed to Credit Sale' : 'Checkout'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default POSPage;

