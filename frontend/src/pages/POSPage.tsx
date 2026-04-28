import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import type { LocalProduct } from '../db/posDB';
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
      if (payment?.value) {
        const val = payment.value as { momo: string; bank: string };
        setPaymentConfig(val);
        // Pre-select first option if available
        const momoList = val.momo.split(',').map(s => s.trim());
        const bankList = val.bank.split(',').map(s => s.trim());
        if (momoList.length > 0) setBankName(momoList[0]);
        if (bankList.length > 0 && paymentMode === 'Card') setBankName(bankList[0]);
      }
    };
    loadTax();
  }, [paymentMode]);

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
  const cartSubtotal = cart.reduce((sum, item) => sum + (Number(item.product.sellPrice) * item.quantity), 0);
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
      if (!selectedCustomerId) {
        toast.error('Customer required for credit sale');
        setShowCustomerSelector(true);
        return;
      }
      const customer = await db.customers.get(selectedCustomerId);
      if (!customer?.livePhoto) {
        toast.error('Identity Verification Required: Credit sales require a customer photo');
        setShowCustomerSelector(true);
        return;
      }
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
    <div className="flex flex-col lg:flex-row h-screen bg-surface-bg overflow-hidden relative px-0">
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
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card md:border md:border-surface-border md:rounded-3xl w-full max-w-md h-full md:h-auto md:max-h-[80vh] shadow-2xl flex flex-col overflow-hidden">
              <div className="p-8 border-b border-surface-border bg-surface-bg/30">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-black tracking-tighter uppercase">Attach Customer</h3>
                </div>
                
                {!isAddingCustomer ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
                      <input autoFocus type="text" placeholder="Search customer..." className="input-field w-full pl-10 py-3 px-4 font-black" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
                    </div>
                    <button 
                      onClick={() => setIsAddingCustomer(true)}
                      className="w-full py-4 bg-primary-500/10 text-primary-500 rounded-2xl font-black text-[10px] tracking-widest flex items-center justify-center gap-2 uppercase"
                    >
                      <Plus className="w-4 h-4" /> Add New Customer
                    </button>
                  </div>
                ) : (
                  <div className="text-left">
                    <button onClick={() => { setIsAddingCustomer(false); stopCamera(); }} className="text-[10px] font-black text-primary-500 mb-2 flex items-center gap-1 uppercase">
                      <ArrowRight className="w-3 h-3 rotate-180" /> Back to Search
                    </button>
                    <h4 className="text-sm font-black mb-2 uppercase">New customer profile</h4>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isAddingCustomer ? (
                  <form onSubmit={handleQuickAddCustomer} className="space-y-6">
                    <div className="flex flex-col gap-6">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1 uppercase">Full name</label>
                          <input required type="text" className="input-field w-full py-3 px-4 font-black" placeholder="e.g. John Phiri" value={custForm.name} onChange={e => setCustForm({...custForm, name: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1 uppercase">Phone number</label>
                          <input required type="text" className="input-field w-full py-3 px-4 font-black" placeholder="e.g. 0881234567 or +265..." value={custForm.phone} onChange={e => setCustForm({...custForm, phone: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1 uppercase">National ID (8 chars)</label>
                          <input type="text" className="input-field w-full py-3 px-4 font-black" placeholder="e.g. ABC12345" value={custForm.idNumber} onChange={e => setCustForm({...custForm, idNumber: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1 uppercase">Village / location</label>
                          <input type="text" className="input-field w-full py-3 px-4 font-black" placeholder="e.g. Lilongwe" value={custForm.village} onChange={e => setCustForm({...custForm, village: e.target.value})} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1 uppercase">Live photo</label>
                          <div className="w-full aspect-square bg-surface-bg border border-surface-border rounded-2xl overflow-hidden relative flex flex-col items-center justify-center">
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
                              <button type="button" onClick={startCamera} className="flex-1 py-2 bg-surface-bg border border-surface-border rounded-lg text-[8px] font-bold flex items-center justify-center gap-1 uppercase">
                                <Camera className="w-3 h-3" /> Camera
                              </button>
                            )}
                            {custForm.livePhoto && (
                              <button type="button" onClick={() => setCustForm({...custForm, livePhoto: ''})} className="flex-1 py-2 bg-surface-bg border border-surface-border rounded-lg text-[8px] font-bold text-red-500 uppercase">Retake</button>
                            )}
                            <label className="flex-1 py-2 bg-surface-bg border border-surface-border rounded-lg text-[8px] font-bold flex items-center justify-center gap-1 cursor-pointer uppercase">
                              <Upload className="w-3 h-3" /> Upload
                              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                            </label>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1 uppercase">Biometrics</label>
                          <button 
                            type="button" 
                            onClick={captureFingerprint}
                            disabled={!!custForm.fingerprintData}
                            className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all ${custForm.fingerprintData ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-surface-bg border-surface-border text-surface-text/60'}`}
                          >
                            {custForm.fingerprintData ? <CheckCircle2 className="w-8 h-8" /> : <Fingerprint className="w-8 h-8" />}
                            <span className="text-[8px] font-bold uppercase">{custForm.fingerprintData ? 'Captured' : 'Scan'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="w-full btn-primary !py-4 text-[10px] font-black tracking-widest mt-6 uppercase shadow-lg shadow-primary-500/20">
                      Create secure profile
                    </button>
                  </form>
                ) : (
                  <div className="divide-y divide-surface-border/50">
                    {customers?.length === 0 ? (
                      <div className="p-12 text-center opacity-20">
                        <Users className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-xs font-black tracking-widest uppercase">No customers found</p>
                      </div>
                    ) : (
                      customers?.map(c => (
                        <button key={c.id} onClick={() => { setSelectedCustomerId(c.id); setShowCustomerSelector(false); if(paymentMode === 'Credit') handleCheckout(); }} className="w-full p-4 flex justify-between items-center hover:bg-primary-500/5 transition-colors group text-left rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-surface-bg border border-surface-border rounded-xl flex items-center justify-center group-hover:border-primary-400 transition-colors overflow-hidden">
                              {c.livePhoto ? <img src={c.livePhoto} alt="" className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-surface-text/40" />}
                            </div>
                            <div>
                              <div className="font-bold text-sm uppercase">{c.name}</div>
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
              <div className="p-4 border-t border-surface-border bg-surface-bg/10">
                <button 
                  onClick={() => { setShowCustomerSelector(false); stopCamera(); }}
                  className="w-full h-14 bg-surface-bg text-[10px] font-black tracking-widest hover:bg-surface-border/50 transition-all active:scale-[0.98] uppercase rounded-2xl border border-surface-border"
                >
                  Cancel & Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card max-w-lg w-full p-8 rounded-3xl flex flex-col items-center shadow-2xl border border-surface-border">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-6 border-2 border-emerald-500/20">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black mb-2 tracking-tight uppercase">Sale Completed</h2>
              <p className="text-surface-text/40 mb-8 text-center text-[10px] font-black tracking-widest uppercase">Inv: {showReceipt.invoiceNo}</p>
              
              <div id="print-container" className="w-full bg-white rounded-2xl overflow-hidden mb-8 shadow-inner border border-zinc-100 p-4 max-h-[40vh] overflow-y-auto text-black flex justify-center">
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
                <button onClick={() => window.print()} className="flex-1 px-4 py-4 bg-surface-bg hover:bg-surface-border/50 rounded-2xl font-black text-[10px] tracking-widest flex items-center justify-center gap-2 border border-surface-border uppercase">
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
                  }} className="flex-1 px-4 py-4 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white rounded-2xl font-black text-[10px] tracking-widest flex items-center justify-center gap-2 border border-[#25D366]/20 uppercase">
                  <Send className="w-4 h-4" /> Share
                </button>
              </div>
              <button onClick={() => setShowReceipt(null)} className="w-full mt-4 btn-primary !py-5 font-black text-[10px] tracking-widest uppercase shadow-lg shadow-primary-500/20">
                New Transaction
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-0 bg-surface-bg overflow-y-auto custom-scrollbar px-0">
        <header className="px-6 md:px-12 py-8 border-b border-surface-border bg-surface-card sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-surface-text/40 w-5 h-5 group-focus-within:text-primary-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search products by name or SKU..." 
                className="input-field w-full pl-14 h-16 text-sm font-black uppercase" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <button onClick={() => setShowScanner(true)} className="w-16 h-16 bg-primary-500 text-white rounded-2xl active:scale-95 transition-all shadow-xl shadow-primary-500/20 flex items-center justify-center" title="Scan Barcode" aria-label="Scan Barcode">
              <Scan className="w-6 h-6" />
            </button>
            <button onClick={async () => {
                setIsSyncing(true);
                await SyncService.pushSales();
                setIsSyncing(false);
                toast.success('Synced');
              }} className={clsx("w-16 h-16 bg-surface-card border border-surface-border rounded-2xl text-primary-500 shadow-sm flex items-center justify-center transition-all active:bg-primary-500/5", isSyncing && "animate-spin")} title="Sync Sales" aria-label="Sync Sales">
              <RefreshCw className="w-6 h-6" />
            </button>
          </div>
        </header>

        <main className="w-full p-6 md:p-12 space-y-12">
          {searchTerm.length >= 2 && (
            <div className="mb-12">
              <div className="card-label mb-6 pl-2 uppercase">Matching Products</div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {products?.map(product => (
                    <motion.div 
                      layout 
                      initial={{ opacity: 0, scale: 0.9 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.9 }} 
                      key={product.id} 
                      onClick={() => addToCart(product)} 
                      className="p-6 cursor-pointer active:scale-[0.98] transition-all group bg-surface-card border border-surface-border rounded-3xl flex items-center justify-between gap-6 hover:border-primary-500/20 shadow-sm"
                    >
                      <div className="flex items-center gap-6 min-w-0">
                        <div className="w-20 h-20 bg-surface-bg border border-surface-border rounded-2xl overflow-hidden shrink-0 flex items-center justify-center">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <PackageSearch className="w-8 h-8 text-surface-text/10" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="card-label !mb-0 uppercase tracking-widest text-[8px]">{product.sku}</div>
                          <div className="font-black text-base text-surface-text group-hover:text-primary-500 transition-colors truncate uppercase">{product.name}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-black text-primary-500 tracking-tighter uppercase">MK {product.sellPrice.toLocaleString()}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          <div className="w-full pb-40">
            <div className="flex items-center justify-between mb-8 px-2">
               <h2 className="text-xl font-black uppercase flex items-center gap-3">
                  <ShoppingCart className="w-6 h-6 text-primary-500" />
                  Active Cart
               </h2>
                <div className="card-label uppercase">
                  {cart.length} items
                </div>
            </div>

            {cart.length === 0 ? (
              <div className="py-32 flex flex-col items-center justify-center bg-surface-card border-2 border-dashed border-surface-border rounded-[3rem] opacity-30">
                <PackageSearch className="w-20 h-20 mb-6 text-surface-text/20" />
                <p className="text-[10px] font-black tracking-[0.3em] uppercase">Cart is ready for products</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {cart.map((item) => (
                    <motion.div layout initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} key={item.product.id} className="p-8 group bg-surface-card border border-surface-border rounded-[2rem] shadow-sm hover:border-primary-500/10 transition-all">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex-1 flex items-center gap-6">
                          <div className="w-16 h-16 bg-surface-bg border border-surface-border rounded-2xl overflow-hidden flex items-center justify-center shrink-0">
                             {item.product.imageUrl ? <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" /> : <PackageSearch className="w-6 h-6 text-surface-text/10" />}
                          </div>
                          <div>
                            <div className="font-black text-xl leading-tight uppercase">{item.product.name}</div>
                            <div className="card-label !mt-1 !mb-0 uppercase">MK {item.product.sellPrice.toLocaleString()} per unit</div>
                          </div>
                        </div>
                        <button onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))} className="p-3 text-surface-text/10 hover:text-red-500 hover:bg-red-500/5 rounded-2xl transition-all" title="Remove item" aria-label="Remove item">
                          <X className="w-7 h-7" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-6 border-t border-surface-border/50">
                        <div className="flex items-center gap-4">
                          <button onClick={() => setCart(prev => prev.map(i => i.product.id === item.product.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} className="w-14 h-14 bg-surface-bg border border-surface-border rounded-2xl flex items-center justify-center hover:bg-surface-border/30 transition-all active:scale-95" title="Decrease quantity" aria-label="Decrease quantity"><Minus className="w-6 h-6" /></button>
                          <div className="w-16 text-center font-black text-2xl uppercase">{item.quantity}</div>
                          <button onClick={() => addToCart(item.product)} className="w-14 h-14 bg-surface-bg border border-surface-border rounded-2xl flex items-center justify-center hover:bg-surface-border/30 transition-all active:scale-95" title="Increase quantity" aria-label="Increase quantity"><Plus className="w-6 h-6" /></button>
                        </div>
                        <div className="text-right">
                           <div className="text-2xl font-black text-primary-500 tracking-tighter uppercase">MK {(Number(item.product.sellPrice) * item.quantity).toLocaleString()}</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <div className="mt-12 p-10 bg-surface-card border border-surface-border rounded-[3rem] space-y-10 shadow-xl relative overflow-hidden">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                          "p-6 rounded-3xl border flex flex-col items-center gap-3 transition-all active:scale-95",
                          paymentMode === mode.id ? `${mode.color} text-white border-transparent shadow-2xl scale-105` : "bg-surface-bg border-surface-border text-surface-text/30 hover:border-primary-500/20"
                        )}
                      >
                        <mode.icon className="w-7 h-7" />
                        <span className="text-[10px] font-black tracking-widest uppercase">{mode.label || mode.id}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10 border-t border-surface-border/30">
                    {paymentMode === 'Cash' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Cash Received (MK)</label>
                          <input type="number" placeholder="0.00" className="input-field w-full text-3xl font-black h-20 px-8 rounded-3xl border-2 focus:border-primary-500" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} onFocus={e => e.target.select()} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-surface-text/40 tracking-widest ml-1 uppercase">Transaction Summary</label>
                          <div className={clsx("h-20 flex flex-col justify-center px-8 rounded-3xl border-2 font-black transition-all", parseFloat(amountReceived) >= finalTotal ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" : "bg-surface-bg border-surface-border text-surface-text/10")}>
                            <div className="flex justify-between items-center">
                               <span className="text-[11px] uppercase tracking-widest">Change Due:</span>
                               <span className="text-xl">MK {changeDue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center opacity-60">
                               <span className="text-[9px] uppercase tracking-widest">Tax Inclusion:</span>
                               <span className="text-[10px]">MK {taxAmount.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    {(paymentMode === 'Card' || paymentMode === 'Momo') && (
                      <>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-surface-text/40 ml-1">{paymentMode === 'Card' ? 'Select Bank' : 'Select Provider'}</label>
                          <select 
                            className="input-field w-full h-20 rounded-3xl px-8 text-xl font-black appearance-none bg-surface-bg border-2 border-surface-border focus:border-primary-500 transition-all uppercase"
                            value={bankName} 
                            onChange={e => setBankName(e.target.value)}
                            title={paymentMode === 'Card' ? 'Select Bank' : 'Select Provider'}
                          >
                            {(paymentMode === 'Card' ? paymentConfig.bank : paymentConfig.momo).split(',').map(provider => (
                              <option key={provider.trim()} value={provider.trim()}>{provider.trim()}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Reference Number</label>
                          <input type="text" className="input-field w-full h-20 rounded-3xl px-8 text-xl font-black border-2" placeholder="XXXX-XXXX" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                        </div>
                      </>
                    )}
                    {paymentMode === 'Credit' && (
                      <div className="col-span-full">
                         <div className="p-8 bg-amber-500/5 border-2 border-amber-500/20 rounded-3xl flex items-center justify-between">
                            <div className="flex items-center gap-6">
                               <div className="w-16 h-16 bg-amber-500/20 text-amber-600 rounded-2xl flex items-center justify-center">
                                  <Users className="w-8 h-8" />
                               </div>
                               <div>
                                  <div className="font-black text-xl uppercase">Credit Sale</div>
                                  <div className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest">{selectedCustomerId ? 'Customer attached' : 'No customer selected'}</div>
                               </div>
                            </div>
                            <button onClick={() => setShowCustomerSelector(true)} className="btn-primary !bg-amber-500 !px-8 !py-4 text-[10px] font-black tracking-widest uppercase shadow-xl shadow-amber-500/20">
                               {selectedCustomerId ? 'Change Customer' : 'Select Customer'}
                            </button>
                         </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-10 flex flex-col md:flex-row items-center justify-between gap-8 border-t border-surface-border/30">
                    <div className="flex flex-wrap items-center gap-10">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-surface-text/30 tracking-widest uppercase mb-1">Subtotal</span>
                        <span className="text-xl font-black uppercase">MK{cartSubtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-black text-surface-text/30 tracking-widest uppercase mb-1">Discount (MK)</label>
                        <input 
                          type="number" 
                          value={discount || ''} 
                          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                          className="bg-transparent border-b border-surface-border w-32 text-xl font-black focus:outline-none focus:border-primary-500 transition-colors uppercase"
                          placeholder="0.00"
                        />
                      </div>
                      {taxAmount > 0 && (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-surface-text/30 tracking-widest uppercase mb-1">Tax ({taxConfig.rate}%)</span>
                          <span className="text-xl font-black text-primary-500 uppercase">MK{taxAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 bg-surface-bg/50 px-4 py-2 rounded-xl border border-surface-border/50">
                        <input 
                          type="checkbox" 
                          id="printReceipt" 
                          checked={printReceipt} 
                          onChange={(e) => setPrintReceipt(e.target.checked)}
                          className="w-5 h-5 rounded-lg border-surface-border text-primary-500 focus:ring-primary-500 cursor-pointer"
                        />
                        <label htmlFor="printReceipt" className="text-[10px] font-black tracking-widest text-surface-text/60 cursor-pointer uppercase">Auto-Print Receipt</label>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-8 w-full md:w-auto">
                      <div className="text-right">
                        <span className="text-[10px] font-black text-surface-text/30 tracking-widest mb-1 uppercase block">Final Payable Total</span>
                        <div className={clsx("text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none", paymentMode === 'Credit' ? 'text-amber-500' : 'text-primary-500')}>
                            MK{finalTotal.toLocaleString()}
                        </div>
                      </div>
                      <button 
                        onClick={handleCheckout} 
                        disabled={
                          (paymentMode === 'Cash' && parseFloat(amountReceived) < finalTotal) ||
                          ((paymentMode === 'Card' || paymentMode === 'Momo') && (!bankName || !accountNumber))
                        }
                        className={clsx(
                          "w-full md:w-80 h-20 rounded-[2rem] font-black text-lg tracking-widest transition-all flex items-center justify-center gap-4 shadow-2xl active:scale-[0.98] disabled:opacity-30 disabled:grayscale uppercase",
                          paymentMode === 'Credit' ? "bg-amber-500 text-white shadow-amber-500/20" : "bg-primary-500 text-white shadow-primary-500/40"
                        )}
                      >
                        {paymentMode === 'Credit' ? <Users className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
                        {paymentMode === 'Credit' ? 'Process Credit' : 'Complete Sale'}
                      </button>
                    </div>
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
