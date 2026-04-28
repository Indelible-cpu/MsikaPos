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
  PackageSearch, 
  Scan, 
  CreditCard, 
  Smartphone, 
  Wallet,
  Printer,
  Send,
  ArrowRight,
  Camera,
  Upload,
  Fingerprint,
  CheckCircle2,
  X
} from 'lucide-react';
import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { SyncService } from '../services/SyncService';
import { soundService } from '../services/SoundService';
import clsx from 'clsx';

import { Receipt } from '../components/Receipt';
import { Invoice } from '../components/Invoice';
import BarcodeScanner from '../components/BarcodeScanner';
import html2canvas from 'html2canvas';

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
  
  // Full Registration State for POS
  const [custForm, setCustForm] = useState({ 
    name: '', 
    phone: '',
    idNumber: '',
    village: '',
    livePhoto: '',
    fingerprintData: ''
  });

  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [showScanner, setShowScanner] = useState(false);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [taxConfig, setTaxConfig] = useState<TaxConfig>({ rate: 0, inclusive: true });
  const [paymentConfig, setPaymentConfig] = useState({ momo: 'Momo', bank: 'Bank' });
  const [printReceipt, setPrintReceipt] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  /* Centering and Printing Fixes */
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
  } | null>(null);

  // Load Tax Config
  useEffect(() => {
    const loadTax = async () => {
      const tax = await db.settings.get('tax_config');
      if (tax?.value) setTaxConfig(tax.value as TaxConfig);
      const payment = await db.settings.get('payment_config');
      if (payment?.value) setPaymentConfig(payment.value as { momo: string; bank: string });
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
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearchTerm(''); // Clear search after adding
    toast.success(`${product.name} added`, { id: 'scan-success', duration: 1000 });
  }, []);

  // Totals Calculation
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

  const changeDue = Math.max(0, (parseFloat(amountReceived) || 0) - finalTotal);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (paymentMode === 'Credit' && !selectedCustomerId) {
      setShowCustomerSelector(true);
      setIsAddingCustomer(true);
      return;
    }

    const paid = paymentMode === 'Cash' ? (parseFloat(amountReceived) || finalTotal) : finalTotal;
    if (paid < finalTotal && paymentMode !== 'Credit') {
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
        discount,
        tax: taxAmount,
        total: finalTotal,
        paid,
        changeDue,
        itemsCount,
        paymentMode,
        bankName: (paymentMode === 'Card' || paymentMode === 'Momo') ? bankName : undefined,
        accountNumber: (paymentMode === 'Card' || paymentMode === 'Momo') ? accountNumber : undefined,
        amountReceived: parseFloat(amountReceived) || paid,
        customerId: selectedCustomerId || undefined,
        createdAt: new Date().toISOString(),
        synced: 0
      };

      await db.salesQueue.add(saleData);

      let customerName = undefined;
      if (selectedCustomerId) {
        const customer = await db.customers.get(selectedCustomerId);
        if (customer) {
          customerName = customer.name;
          await db.customers.update(selectedCustomerId, {
            balance: customer.balance + (paymentMode === 'Credit' ? finalTotal : 0),
            updatedAt: new Date().toISOString()
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
          bankName: (paymentMode === 'Card' || paymentMode === 'Momo') ? bankName : undefined,
          accountNumber: (paymentMode === 'Card' || paymentMode === 'Momo') ? accountNumber : undefined,
          customerId: selectedCustomerId || undefined
        });

      setCart([]);
      setSelectedCustomerId(null);
      setShowCustomerSelector(false);
      setAmountReceived('');
      setBankName('');
      setAccountNumber('');
      setDiscount(0);
      toast.success('Sale Completed!');
      
      if (printReceipt) {
        setTimeout(() => {
          window.print();
        }, 800);
      }
    } catch (err) {
      soundService.playError();
      console.error(err);
      toast.error('Failed to save sale');
    }
  };

  const startCamera = async () => {
    setUseCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
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
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCustForm(prev => ({ ...prev, livePhoto: dataUrl }));
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setUseCamera(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustForm(prev => ({ ...prev, livePhoto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const captureFingerprint = async () => {
    toast.loading('Scanning fingerprint...', { id: 'fp' });
    setTimeout(() => {
      const mockHash = "FP_" + Math.random().toString(36).substring(2, 15);
      setCustForm(prev => ({ ...prev, fingerprintData: btoa(mockHash) }));
      toast.success('Fingerprint secured', { id: 'fp' });
    }, 1500);
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name || !custForm.phone) return;

    if (!/^\d{10}$|^\d{13}$/.test(custForm.phone)) {
      toast.error('Mobile number must be exactly 10 or 13 digits');
      return;
    }

    if (custForm.idNumber && custForm.idNumber.length !== 8) {
      toast.error('National ID must be exactly 8 characters');
      return;
    }

    try {
      const id = crypto.randomUUID();
      await db.customers.add({
        id,
        name: custForm.name,
        phone: custForm.phone,
        idNumber: custForm.idNumber.toUpperCase(),
        village: custForm.village,
        livePhoto: custForm.livePhoto,
        fingerprintData: custForm.fingerprintData,
        balance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setSelectedCustomerId(id);
      setIsAddingCustomer(false);
      setCustForm({ name: '', phone: '', idNumber: '', village: '', livePhoto: '', fingerprintData: '' });
      toast.success('Customer added');
      if (paymentMode === 'Credit') handleCheckout();
    } catch {
      toast.error('Failed to add customer');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-surface-bg overflow-hidden relative">
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center md:p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card md:border md:border-surface-border md:rounded-none w-full max-w-md h-full md:h-auto md:max-h-[80vh] shadow-2xl flex flex-col overflow-hidden">
              <div className="p-6 border-b border-surface-border bg-surface-bg/30">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-black tracking-tighter italic">Attach Customer</h3>
                </div>
                
                {!isAddingCustomer ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
                      <input autoFocus type="text" placeholder="Search customer..." className="input-field w-full pl-10" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
                    </div>
                    <button 
                      onClick={() => setIsAddingCustomer(true)}
                      className="w-full py-3 bg-primary-500/10 text-primary-500 rounded-xl font-black text-[10px] tracking-widest flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add New Customer
                    </button>
                  </div>
                ) : (
                  <div className="text-left">
                    <button onClick={() => { setIsAddingCustomer(false); stopCamera(); }} className="text-[10px] font-black text-primary-500 mb-2 flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 rotate-180" /> Back to Search
                    </button>
                    <h4 className="text-sm font-black italic mb-2">New customer profile</h4>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                {isAddingCustomer ? (
                  <form onSubmit={handleQuickAddCustomer} className="p-4 space-y-4">
                    <div className="flex flex-col gap-6">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1">Full name</label>
                          <input required type="text" className="input-field w-full" placeholder="e.g. John Phiri" value={custForm.name} onChange={e => setCustForm({...custForm, name: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1">Phone number</label>
                          <input required type="text" className="input-field w-full" placeholder="e.g. 0881234567 or +265..." value={custForm.phone} onChange={e => setCustForm({...custForm, phone: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1">National ID (8 chars)</label>
                          <input type="text" className="input-field w-full" placeholder="e.g. ABC12345" value={custForm.idNumber} onChange={e => setCustForm({...custForm, idNumber: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1">Village / location</label>
                          <input type="text" className="input-field w-full" placeholder="e.g. Lilongwe" value={custForm.village} onChange={e => setCustForm({...custForm, village: e.target.value})} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Photo Capture */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1">Live photo</label>
                          <div className="w-full aspect-square bg-surface-bg border border-surface-border rounded-none overflow-hidden relative flex flex-col items-center justify-center">
                            {custForm.livePhoto ? (
                              <img src={custForm.livePhoto} alt="Preview" className="w-full h-full object-cover" />
                            ) : useCamera ? (
                              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-8 h-8 text-surface-text/20 mb-2" />
                            )}
                            {useCamera && !custForm.livePhoto && (
                              <button type="button" title="Capture photo" aria-label="Capture photo" onClick={capturePhoto} className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-red-500 text-white w-10 h-10 rounded-full shadow-lg border-2 border-white"></button>
                            )}
                            <canvas ref={canvasRef} className="hidden" />
                          </div>
                          <div className="flex gap-2">
                            {!useCamera && !custForm.livePhoto && (
                              <button type="button" onClick={startCamera} className="flex-1 py-2 bg-surface-bg border border-surface-border rounded-lg text-[8px] font-bold flex items-center justify-center gap-1">
                                <Camera className="w-3 h-3" /> Camera
                              </button>
                            )}
                            {custForm.livePhoto && (
                              <button type="button" onClick={() => setCustForm({...custForm, livePhoto: ''})} className="flex-1 py-2 bg-surface-bg border border-surface-border rounded-lg text-[8px] font-bold text-red-500">Retake</button>
                            )}
                            <label className="flex-1 py-2 bg-surface-bg border border-surface-border rounded-lg text-[8px] font-bold flex items-center justify-center gap-1 cursor-pointer">
                              <Upload className="w-3 h-3" /> Upload
                              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                            </label>
                          </div>
                        </div>

                        {/* Fingerprint Capture */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1">Biometrics</label>
                          <button 
                            type="button" 
                            onClick={captureFingerprint}
                            disabled={!!custForm.fingerprintData}
                            className={`w-full aspect-square rounded-none flex flex-col items-center justify-center gap-2 border transition-all ${custForm.fingerprintData ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-surface-bg border-surface-border text-surface-text/60'}`}
                          >
                            {custForm.fingerprintData ? <CheckCircle2 className="w-8 h-8" /> : <Fingerprint className="w-8 h-8" />}
                            <span className="text-[8px] font-bold">{custForm.fingerprintData ? 'Captured' : 'Scan'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="w-full btn-primary !py-4 text-[10px] font-black tracking-widest mt-6">
                      Create secure profile
                    </button>
                  </form>
                ) : (
                  <div className="divide-y divide-surface-border/50">
                    {customers?.length === 0 ? (
                      <div className="p-12 text-center opacity-20">
                        <Users className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-xs font-black tracking-widest">No customers found</p>
                      </div>
                    ) : (
                      customers?.map(c => (
                        <button key={c.id} onClick={() => { setSelectedCustomerId(c.id); setShowCustomerSelector(false); if(paymentMode === 'Credit') handleCheckout(); }} className="w-full p-4 flex justify-between items-center hover:bg-primary-500/5 transition-colors group text-left">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-surface-bg border border-surface-border rounded-xl flex items-center justify-center group-hover:border-primary-400 transition-colors">
                              <Users className="w-5 h-5 text-surface-text/40" />
                            </div>
                            <div>
                              <div className="font-bold text-sm">{c.name}</div>
                              <div className="text-[10px] text-surface-text/30 font-bold">{c.phone}</div>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-surface-text/20 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="border-t border-surface-border bg-surface-bg/10">
                <button 
                  onClick={() => { setShowCustomerSelector(false); stopCamera(); }}
                  className="w-full h-14 bg-surface-bg text-[10px] font-black tracking-widest hover:bg-surface-border/50 transition-all active:scale-[0.98]"
                >
                  Cancel & Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card max-w-lg w-full p-8 rounded-none flex flex-col items-center shadow-2xl">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-6 border-2 border-emerald-500/20">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black mb-2 tracking-tight italic">Sale Completed</h2>
              <p className="text-surface-text/40 mb-8 text-center text-[10px] font-black tracking-widest">Inv: {showReceipt.invoiceNo}</p>
              
              <div id="print-container" className="w-full bg-white rounded-none overflow-hidden mb-8 shadow-inner border border-zinc-100 p-4 max-h-[40vh] overflow-y-auto text-black flex justify-center">
                {showReceipt.mode === 'Credit' ? (
                  <Invoice 
                    items={showReceipt.items}
                    total={showReceipt.total}
                    subtotal={showReceipt.subtotal}
                    discount={showReceipt.discount}
                    tax={showReceipt.tax}
                    invoiceNo={showReceipt.invoiceNo}
                    date={showReceipt.date}
                    customerName={showReceipt.customerName}
                    customerId={showReceipt.customerId}
                  />
                ) : (
                  <Receipt 
                    items={showReceipt.items}
                    total={showReceipt.total}
                    subtotal={showReceipt.subtotal}
                    discount={showReceipt.discount}
                    tax={showReceipt.tax}
                    invoiceNo={showReceipt.invoiceNo}
                    date={showReceipt.date}
                    paid={showReceipt.paid}
                    change={showReceipt.change}
                    mode={showReceipt.mode}
                    customerName={showReceipt.customerName}
                    customerId={showReceipt.customerId}
                  />
                )}
              </div>
              
              <div className="flex gap-3 w-full">
                <button onClick={() => window.print()} className="flex-1 px-4 py-3 bg-surface-bg hover:bg-surface-border/50 rounded-none font-black text-[10px] tracking-widest flex items-center justify-center gap-2 border border-surface-border">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button onClick={async () => {
                    try {
                      const receiptElement = document.querySelector('.invoice') || document.querySelector('.receipt');
                      if (receiptElement) {
                        toast.loading('Generating receipt...', { id: 'receipt' });
                        const canvas = await html2canvas(receiptElement as HTMLElement, { scale: 2 });
                        canvas.toBlob(async (blob) => {
                          if (blob) {
                            const file = new File([blob], `receipt_${showReceipt.invoiceNo}.png`, { type: 'image/png' });
                            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                              await navigator.share({
                                files: [file],
                                title: `Receipt ${showReceipt.invoiceNo}`
                              });
                              toast.success('Shared successfully', { id: 'receipt' });
                            } else {
                              const itemsText = showReceipt.items.map(i => `▫️ ${i.product.name}\n   ${i.quantity} x MK ${i.product.sellPrice.toLocaleString()} = *MK ${(i.product.sellPrice * i.quantity).toLocaleString()}*`).join('\n\n');
                              const bankInfo = showReceipt.bankName ? `\n\n🏦 *${showReceipt.mode === 'Momo' ? 'Provider' : 'Bank'}*: ${showReceipt.bankName}\n🔢 *Acc/Ref*: ${showReceipt.accountNumber}` : '';
                              const taxText = showReceipt.tax > 0 ? `\nTax: MK ${showReceipt.tax.toLocaleString()}` : '';
                              const text = `*${localStorage.getItem('companyName') || 'MsikaPos'}*\n━━━━━━━━━━━━━━━━\n🧾 *DIGITAL RECEIPT*\n━━━━━━━━━━━━━━━━\n\n*Inv*: ${showReceipt.invoiceNo}\n*Date*: ${showReceipt.date}\n\n*ITEMS:*\n${itemsText}\n\n━━━━━━━━━━━━━━━━\nSubtotal: MK ${showReceipt.subtotal.toLocaleString()}${taxText}\n*TOTAL: MK ${showReceipt.total.toLocaleString()}*\n━━━━━━━━━━━━━━━━\n\n*Payment*: ${showReceipt.mode}${bankInfo}\n\n_Thank you for your business!_\n_Powered by MsikaPos_`;
                              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                              toast.success('Generated text receipt fallback', { id: 'receipt' });
                            }
                          }
                        }, 'image/png');
                      }
                    } catch {
                      toast.error('Failed to generate receipt image', { id: 'receipt' });
                    }
                  }} className="flex-1 px-4 py-3 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white rounded-none font-black text-[10px] tracking-widest flex items-center justify-center gap-2 border border-[#25D366]/20">
                  <Send className="w-4 h-4" /> Share Receipt
                </button>
              </div>
              <button onClick={() => setShowReceipt(null)} className="w-full mt-4 btn-primary !py-4 font-black text-[10px] tracking-widest">
                New Transaction
              </button>
              <button onClick={() => setShowReceipt(null)} className="w-full mt-2 py-3 text-[10px] font-black tracking-widest text-surface-text/40 hover:text-surface-text transition-colors">
                Dismiss
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-0 bg-surface-bg overflow-y-auto custom-scrollbar">
        <header className="p-4 md:p-6 border-b border-surface-border bg-transparent sticky top-0 z-10">
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
            <button onClick={() => setShowScanner(true)} className="p-3 bg-primary-500 text-white rounded-2xl active:scale-95 transition-all shadow-lg shadow-primary-500/20" title="Scan Barcode" aria-label="Scan Barcode">
              <Scan className="w-5 h-5" />
            </button>
            <button onClick={async () => {
                setIsSyncing(true);
                await SyncService.pushSales();
                setIsSyncing(false);
                toast.success('Synced');
              }} className={clsx("p-3 bg-surface-card border border-surface-border rounded-2xl text-primary-500 shadow-sm", isSyncing && "animate-spin")} title="Sync Sales" aria-label="Sync Sales">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="w-full p-4 md:p-10 space-y-10">
          {/* Products Results Section */}
          {/* Products Results Section */}
          {searchTerm.length >= 2 && (
            <div className="mb-12">
              <div className="card-label mb-4 pl-2">Matching Products</div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {products?.map(product => (
                    <motion.div 
                      layout 
                      initial={{ opacity: 0, scale: 0.9 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.9 }} 
                      key={product.id} 
                      onClick={() => addToCart(product)} 
                      className="p-6 cursor-pointer active:scale-[0.98] transition-all group border-b border-surface-border/50 flex items-center justify-between gap-4"
                    >
                      <div className="flex flex-col min-w-0">
                        <div className="card-label !mb-0">{product.sku}</div>
                        <div className="font-black text-sm text-surface-text group-hover:text-primary-500 transition-colors truncate">{product.name}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-black text-primary-500 tracking-tighter italic">MK {product.sellPrice.toLocaleString()}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Cart Section - Naturally follows products flow */}
          <div className="w-full pb-32 px-4 md:px-10">
            <div className="flex items-center justify-between mb-10 px-4">
               <h2 className="section-title !mb-0">
                  <ShoppingCart className="w-6 h-6 text-primary-500" />
                  Order Cart
               </h2>
                <div className="card-label">
                  {cart.length} items selected
                </div>
            </div>

            {cart.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center opacity-10">
                <PackageSearch className="w-20 h-20 mb-4" />
                <p className="text-xs font-black tracking-widest">Cart is ready for products</p>
              </div>
            ) : (
              <div className="space-y-0 border-t border-surface-border">
                <AnimatePresence mode="popLayout">
                  {cart.map((item) => (
                    <motion.div layout initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} key={item.product.id} className="p-6 group border-b border-surface-border">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="font-black text-lg leading-tight">{item.product.name}</div>
                          <div className="card-label !mt-1 !mb-0">MK {item.product.sellPrice.toLocaleString()} / UNIT</div>
                        </div>
                        <button onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))} className="p-2 text-surface-text/20 hover:text-red-500 transition-colors" title="Remove item" aria-label="Remove item">
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-5 border-t border-surface-border/50">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setCart(prev => prev.map(i => i.product.id === item.product.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} className="w-11 h-11 bg-surface-bg border border-surface-border rounded-none flex items-center justify-center hover:bg-surface-border/30 transition-all" title="Decrease quantity" aria-label="Decrease quantity"><Minus className="w-5 h-5" /></button>
                          <div className="w-14 text-center font-black text-lg">{item.quantity}</div>
                          <button onClick={() => addToCart(item.product)} className="w-11 h-11 bg-surface-bg border border-surface-border rounded-none flex items-center justify-center hover:bg-surface-border/30 transition-all" title="Increase quantity" aria-label="Increase quantity"><Plus className="w-5 h-5" /></button>
                        </div>
                        <div className="font-black text-primary-500 text-2xl tracking-tighter italic">MK {(item.product.sellPrice * item.quantity).toLocaleString()}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Checkout Summary Bar - Seamless flow */}
                <div className="mt-12 p-8 border-t border-surface-border space-y-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'Cash', icon: Wallet, color: 'bg-primary-500' },
                      { id: 'Card', icon: CreditCard, color: 'bg-blue-600', label: paymentConfig.bank },
                      { id: 'Momo', icon: Smartphone, color: 'bg-emerald-600', label: paymentConfig.momo },
                      { id: 'Credit', icon: Users, color: 'bg-amber-600' }
                    ].map((mode) => (
                      <button 
                        key={mode.id} 
                        onClick={() => setPaymentMode(mode.id as 'Cash' | 'Card' | 'Momo' | 'Credit')} 
                        className={clsx(
                          "p-5 rounded-none border flex flex-col items-center gap-2 transition-all active:scale-95",
                          paymentMode === mode.id ? `${mode.color} text-white border-transparent shadow-lg scale-105` : "bg-surface-bg border-surface-border text-surface-text/30 hover:border-primary-500/20"
                        )}
                      >
                        <mode.icon className="w-6 h-6" />
                        <span className="card-label !mb-0 !text-inherit">{mode.label || mode.id}</span>
                      </button>
                    ))}
                  </div>

                  {/* Dynamic Inline Payment Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-surface-border/30">
                    {paymentMode === 'Cash' && (
                      <>
                        <div className="space-y-1">
                          <label className="card-label ml-1">Cash Received (MK)</label>
                          <input type="number" placeholder="Enter amount..." className="input-field w-full text-xl font-black !rounded-none" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} onFocus={e => e.target.select()} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-surface-text/40 tracking-widest ml-1">Change & Tax Summary</label>
                          <div className={clsx("h-14 flex flex-col justify-center px-6 rounded-none border font-black", parseFloat(amountReceived) >= finalTotal ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-surface-bg border-surface-border text-surface-text/10")}>
                            <div className="text-[10px] opacity-60">CHANGE: MK {changeDue.toLocaleString()}</div>
                            <div className="text-[10px] opacity-60">TAX: MK {taxAmount.toLocaleString()}</div>
                          </div>
                        </div>
                      </>
                    )}
                    {(paymentMode === 'Card' || paymentMode === 'Momo') && (
                      <>
                        <div className="space-y-1">
                          <label className="card-label ml-1">{paymentMode === 'Card' ? `Credited To (${paymentConfig.bank})` : `Transfered To (${paymentConfig.momo})`}</label>
                          <input type="text" placeholder={paymentMode === 'Card' ? `e.g. ${paymentConfig.bank}` : `e.g. ${paymentConfig.momo}`} className="input-field w-full !rounded-none" value={bankName} onChange={e => setBankName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="card-label ml-1">Account / Reference Number</label>
                          <input type="text" placeholder="Enter account or ref..." className="input-field w-full !rounded-none" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-6 border-t border-surface-border/50">
                    <div className="flex flex-col gap-1 w-full md:w-auto">
                      <div className="flex justify-between md:justify-start gap-8 items-center border-b border-surface-border/30 pb-2 mb-2">
                        <div>
                          <span className="text-[8px] font-black text-surface-text/30 tracking-widest block">Subtotal</span>
                          <span className="text-sm font-black">MK {cartSubtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[8px] font-black text-surface-text/30 tracking-widest block">Discount</label>
                          <input 
                            type="number" 
                            value={discount || ''} 
                            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                            className="bg-transparent border-b border-surface-border w-24 text-sm font-black focus:outline-none focus:border-primary-500 transition-colors"
                            placeholder="0"
                          />
                        </div>
                        {taxAmount > 0 && (
                          <div>
                            <span className="text-[8px] font-black text-surface-text/30 tracking-widest block">Tax ({taxConfig.rate}%)</span>
                            <span className="text-sm font-black text-primary-500">MK {taxAmount.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="printReceipt" 
                          checked={printReceipt} 
                          onChange={(e) => setPrintReceipt(e.target.checked)}
                          className="w-4 h-4 rounded border-surface-border text-primary-500 focus:ring-primary-500"
                        />
                        <label htmlFor="printReceipt" className="text-[10px] font-black tracking-widest text-surface-text/60 cursor-pointer">Print Receipt After Checkout</label>
                      </div>
                      <div className="text-center md:text-left mt-4">
                        <span className="text-[10px] font-black text-surface-text/30 tracking-widest mb-1 block">Final Order Total</span>
                        <div className={clsx("text-3xl sm:text-5xl font-black tracking-tighter italic", paymentMode === 'Credit' ? 'text-amber-500' : 'text-primary-500')}>
                            MK {finalTotal.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={handleCheckout} 
                      disabled={
                        (paymentMode === 'Cash' && parseFloat(amountReceived) < finalTotal) ||
                        ((paymentMode === 'Card' || paymentMode === 'Momo') && (!bankName || !accountNumber))
                      }
                      className={clsx(
                        "w-full md:w-auto px-16 py-7 rounded-none font-black text-sm tracking-widest transition-all flex items-center justify-center gap-4 shadow-2xl active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed",
                        paymentMode === 'Credit' ? "bg-amber-500 text-white" : "bg-primary-500 text-white shadow-primary-500/20"
                      )}
                    >
                      {paymentMode === 'Credit' ? <Users className="w-6 h-6" /> : <Power className="w-6 h-6" />}
                      {paymentMode === 'Credit' ? 'Process Credit' : 'Complete Sale'}
                      <ArrowRight className="w-6 h-6" />
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
