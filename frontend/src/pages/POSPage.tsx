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
  X, 
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
  CheckCircle2
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
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
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
  const [taxConfig, setTaxConfig] = useState<TaxConfig>({ rate: 0, inclusive: true });
  const [options] = useState({ print: true, whatsapp: false });
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

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
    bankName?: string;
    accountNumber?: string;
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
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearchTerm(''); // Clear search after adding
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
        discount: 0,
        tax: taxAmount,
        total: finalTotal,
        paid,
        changeDue,
        itemsCount,
        paymentMode,
        bankName: (paymentMode === 'Card' || paymentMode === 'Momo') ? bankName : undefined,
        accountNumber: (paymentMode === 'Card' || paymentMode === 'Momo') ? accountNumber : undefined,
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
          tax: taxAmount,
          invoiceNo,
          date: new Date().toLocaleString(),
          mode: paymentMode,
          customerName,
          paid,
          change: changeDue,
          bankName: (paymentMode === 'Card' || paymentMode === 'Momo') ? bankName : undefined,
          accountNumber: (paymentMode === 'Card' || paymentMode === 'Momo') ? accountNumber : undefined
        });

      setCart([]);
      setSelectedCustomerId(null);
      setShowCustomerSelector(false);
      setAmountReceived('');
      setBankName('');
      setAccountNumber('');
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card border border-surface-border rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-surface-border bg-surface-bg/30">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-black tracking-tighter italic">Attach Customer</h3>
                  <button onClick={() => setShowCustomerSelector(false)} className="p-2 hover:bg-surface-bg rounded-xl" title="Close" aria-label="Close">
                    <X className="w-5 h-5"/>
                  </button>
                </div>
                
                {!isAddingCustomer ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
                      <input autoFocus type="text" placeholder="Search customer..." className="input-field w-full pl-10" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
                    </div>
                    <button 
                      onClick={() => setIsAddingCustomer(true)}
                      className="w-full py-3 bg-primary-500/10 text-primary-500 rounded-xl font-black text-[10px] tracking-widest uppercase flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add New Customer
                    </button>
                  </div>
                ) : (
                  <div className="text-left">
                    <button onClick={() => setIsAddingCustomer(false)} className="text-[10px] font-black text-primary-500 mb-2 flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 rotate-180" /> Back to Search
                    </button>
                    <h4 className="text-sm font-black italic mb-4">Quick Registration</h4>
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
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1 uppercase">Full name</label>
                          <input required type="text" className="input-field w-full" placeholder="e.g. John Phiri" value={custForm.name} onChange={e => setCustForm({...custForm, name: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1 uppercase">Phone number</label>
                          <input required type="text" className="input-field w-full" placeholder="e.g. 0881234567 or +265..." value={custForm.phone} onChange={e => setCustForm({...custForm, phone: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1 uppercase">National ID (8 chars)</label>
                          <input type="text" className="input-field w-full" placeholder="e.g. ABC12345" value={custForm.idNumber} onChange={e => setCustForm({...custForm, idNumber: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1 uppercase">Village / location</label>
                          <input type="text" className="input-field w-full" placeholder="e.g. Lilongwe" value={custForm.village} onChange={e => setCustForm({...custForm, village: e.target.value})} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Photo Capture */}
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
                              <button type="button" onClick={capturePhoto} className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-red-500 text-white w-10 h-10 rounded-full shadow-lg border-2 border-white"></button>
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
                          <label className="text-[9px] font-black tracking-widest text-surface-text/40 pl-1 uppercase">Biometrics</label>
                          <button 
                            type="button" 
                            onClick={captureFingerprint}
                            disabled={!!custForm.fingerprintData}
                            className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all ${custForm.fingerprintData ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-surface-bg border-surface-border text-surface-text/60'}`}
                          >
                            {custForm.fingerprintData ? <CheckCircle2 className="w-8 h-8" /> : <Fingerprint className="w-8 h-8" />}
                            <span className="text-[8px] font-bold">{custForm.fingerprintData ? 'Captured' : 'Scan'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="w-full btn-primary !py-4 text-[10px] font-black uppercase tracking-widest mt-6">
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
            </motion.div>
          </motion.div>
        )}

        {showReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-card max-w-lg w-full p-8 rounded-3xl flex flex-col items-center shadow-2xl">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-6 border-2 border-emerald-500/20">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black mb-2 tracking-tight italic">Sale Completed</h2>
              <p className="text-surface-text/40 mb-8 text-center text-[10px] font-black tracking-widest uppercase">Invoice: {showReceipt.invoiceNo}</p>
              
              <div className="w-full bg-white rounded-2xl overflow-hidden mb-8 shadow-inner border border-zinc-100 p-4 max-h-[40vh] overflow-y-auto text-black">
                {showReceipt.mode === 'Credit' ? (
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
                <button onClick={() => window.print()} className="flex-1 px-4 py-3 bg-surface-bg hover:bg-surface-border/50 rounded-2xl font-black text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 border border-surface-border">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button onClick={() => {
                    const itemsText = showReceipt.items.map(i => `• ${i.product.name} x${i.quantity} @ MK ${i.product.sellPrice.toLocaleString()}`).join('\n');
                    const bankInfo = showReceipt.bankName ? `\n🏦 *${showReceipt.mode === 'Momo' ? 'Provider' : 'Bank'}*: ${showReceipt.bankName}\n🔢 *Acc/Ref*: ${showReceipt.accountNumber}` : '';
                    const taxText = showReceipt.tax > 0 ? `\nTax: MK ${showReceipt.tax.toLocaleString()}` : '';
                    const text = `🧾 *RECEIPT: ${showReceipt.invoiceNo}*\n\n*${localStorage.getItem('companyName')?.toUpperCase() || 'VENDRAX'}*\n------------------------------\n${itemsText}\n------------------------------\nSubtotal: MK ${showReceipt.subtotal.toLocaleString()}${taxText}\n*TOTAL: MK ${showReceipt.total.toLocaleString()}*\n\n*Payment*: ${showReceipt.mode}${bankInfo}\n\n_Thank you for your business!_`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                  }} className="flex-1 px-4 py-3 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white rounded-2xl font-black text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 border border-[#25D366]/20">
                  <Send className="w-4 h-4" /> WhatsApp
                </button>
              </div>
              <button onClick={() => setShowReceipt(null)} className="w-full mt-4 btn-primary !py-4 font-black text-[10px] tracking-widest uppercase">
                New Transaction
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-0 bg-surface-bg overflow-y-auto custom-scrollbar">
        <header className="p-4 md:p-6 border-b border-surface-border bg-surface-card shadow-sm sticky top-0 z-10">
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
            <button onClick={() => setShowScanner(true)} className="p-4 bg-primary-500 text-white rounded-2xl active:scale-95 transition-all" title="Scan Barcode" aria-label="Scan Barcode">
              <Scan className="w-6 h-6" />
            </button>
            <button onClick={async () => {
                setIsSyncing(true);
                await SyncService.pushSales();
                setIsSyncing(false);
                toast.success('Synced');
              }} className={clsx("p-4 bg-surface-card border border-surface-border rounded-2xl text-primary-500", isSyncing && "animate-spin")} title="Sync Sales" aria-label="Sync Sales">
              <RefreshCw className="w-6 h-6" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {/* Products Results Section */}
          {searchTerm.length >= 2 && (
            <div className="mb-12">
              <h2 className="text-[10px] font-black tracking-widest text-surface-text/30 uppercase mb-4 pl-2">Matching Products</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <AnimatePresence mode="popLayout">
                  {products?.map(product => (
                    <motion.div 
                      layout 
                      initial={{ opacity: 0, scale: 0.9 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.9 }} 
                      key={product.id} 
                      onClick={() => addToCart(product)} 
                      className="bg-surface-card border border-surface-border p-5 rounded-3xl cursor-pointer active:scale-[0.98] transition-all group hover:border-primary-500/40 flex items-center justify-between gap-4"
                    >
                      <div className="flex flex-col min-w-0">
                        <div className="text-[8px] font-black text-surface-text/30 tracking-widest uppercase">{product.sku}</div>
                        <div className="font-black text-sm text-surface-text group-hover:text-primary-500 transition-colors truncate">{product.name}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-black text-primary-500 tracking-tighter italic">MK {product.sellPrice.toLocaleString()}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Cart Section - Naturally follows products flow */}
          <div className="max-w-4xl mx-auto pb-32">
            <div className="flex items-center justify-between mb-8 px-2">
               <div className="flex items-center gap-3">
                  <ShoppingCart className="w-6 h-6 text-primary-500" />
                  <h2 className="text-2xl font-black tracking-tighter italic">Order Cart</h2>
               </div>
               <div className="text-[10px] font-black tracking-widest text-surface-text/30 uppercase">
                 {cart.length} ITEMS SELECTED
               </div>
            </div>

            {cart.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center opacity-10">
                <PackageSearch className="w-20 h-20 mb-4" />
                <p className="text-xs font-black tracking-widest uppercase">Cart is ready for products</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {cart.map((item) => (
                    <motion.div layout initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} key={item.product.id} className="p-6 bg-surface-card border border-surface-border rounded-[2rem] group shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="font-black text-base leading-tight">{item.product.name}</div>
                          <div className="text-[10px] font-bold text-surface-text/30 mt-1 tracking-widest uppercase italic">MK {item.product.sellPrice.toLocaleString()} / UNIT</div>
                        </div>
                        <button onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))} className="p-2 text-surface-text/20 hover:text-red-500 transition-colors" title="Remove item" aria-label="Remove item">
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-5 border-t border-surface-border/50">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setCart(prev => prev.map(i => i.product.id === item.product.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} className="w-11 h-11 bg-surface-bg border border-surface-border rounded-2xl flex items-center justify-center hover:bg-surface-border/30 transition-all" title="Decrease quantity" aria-label="Decrease quantity"><Minus className="w-5 h-5" /></button>
                          <div className="w-14 text-center font-black text-lg">{item.quantity}</div>
                          <button onClick={() => addToCart(item.product)} className="w-11 h-11 bg-surface-bg border border-surface-border rounded-2xl flex items-center justify-center hover:bg-surface-border/30 transition-all" title="Increase quantity" aria-label="Increase quantity"><Plus className="w-5 h-5" /></button>
                        </div>
                        <div className="font-black text-primary-500 text-2xl tracking-tighter italic">MK {(item.product.sellPrice * item.quantity).toLocaleString()}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Checkout Summary Bar - Centered at the bottom of the list */}
                <div className="mt-12 bg-surface-card border border-surface-border rounded-[3rem] p-8 shadow-2xl space-y-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'Cash', icon: Wallet, color: 'bg-primary-500' },
                      { id: 'Card', icon: CreditCard, color: 'bg-blue-600' },
                      { id: 'Momo', icon: Smartphone, color: 'bg-emerald-600' },
                      { id: 'Credit', icon: Users, color: 'bg-amber-600' }
                    ].map((mode) => (
                      <button 
                        key={mode.id} 
                        onClick={() => setPaymentMode(mode.id as 'Cash' | 'Card' | 'Momo' | 'Credit')} 
                        className={clsx(
                          "p-5 rounded-3xl border flex flex-col items-center gap-2 transition-all active:scale-95",
                          paymentMode === mode.id ? `${mode.color} text-white border-transparent shadow-lg scale-105` : "bg-surface-bg border-surface-border text-surface-text/30 hover:border-primary-500/20"
                        )}
                      >
                        <mode.icon className="w-6 h-6" />
                        <span className="text-[9px] font-black uppercase tracking-widest">{mode.id}</span>
                      </button>
                    ))}
                  </div>

                  {/* Dynamic Inline Payment Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-surface-border/30">
                    {paymentMode === 'Cash' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-surface-text/40 tracking-widest uppercase ml-1">Cash Received (MK)</label>
                          <input type="number" placeholder="Enter amount..." className="input-field w-full text-lg font-black" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} onFocus={e => e.target.select()} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-surface-text/40 tracking-widest uppercase ml-1">Change & Tax Summary</label>
                          <div className={clsx("h-14 flex flex-col justify-center px-6 rounded-2xl border font-black", parseFloat(amountReceived) >= finalTotal ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-surface-bg border-surface-border text-surface-text/10")}>
                            <div className="text-[10px] opacity-60">CHANGE: MK {changeDue.toLocaleString()}</div>
                            <div className="text-[10px] opacity-60">TAX: MK {taxAmount.toLocaleString()}</div>
                          </div>
                        </div>
                      </>
                    )}
                    {(paymentMode === 'Card' || paymentMode === 'Momo') && (
                      <>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-surface-text/40 tracking-widest uppercase ml-1">{paymentMode === 'Card' ? 'Credited To (Bank)' : 'Transfered To (Provider)'}</label>
                          <input type="text" placeholder={paymentMode === 'Card' ? 'e.g. National Bank' : 'e.g. TNM Mpamba'} className="input-field w-full text-sm font-bold" value={bankName} onChange={e => setBankName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-surface-text/40 tracking-widest uppercase ml-1">Account / Reference Number</label>
                          <input type="text" placeholder="Enter account or ref..." className="input-field w-full text-sm font-bold" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-6 border-t border-surface-border/50">
                    <div className="flex flex-col gap-1 w-full md:w-auto">
                      <div className="flex justify-between md:justify-start gap-8 items-center border-b border-surface-border/30 pb-2 mb-2">
                        <div>
                          <span className="text-[8px] font-black text-surface-text/30 tracking-widest uppercase block">Subtotal</span>
                          <span className="text-sm font-black">MK {cartSubtotal.toLocaleString()}</span>
                        </div>
                        {taxAmount > 0 && (
                          <div>
                            <span className="text-[8px] font-black text-surface-text/30 tracking-widest uppercase block">Tax ({taxConfig.rate}%)</span>
                            <span className="text-sm font-black text-primary-500">MK {taxAmount.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center md:text-left">
                        <span className="text-[10px] font-black text-surface-text/30 tracking-widest uppercase mb-1 block">Final Order Total</span>
                        <div className={clsx("text-5xl font-black tracking-tighter italic", paymentMode === 'Credit' ? 'text-amber-500' : 'text-primary-500')}>
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
                        "w-full md:w-auto px-16 py-7 rounded-[2rem] font-black text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-4 shadow-2xl active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed",
                        paymentMode === 'Credit' ? "bg-amber-500 text-white" : "bg-primary-500 text-white shadow-primary-500/20"
                      )}
                    >
                      {paymentMode === 'Credit' ? <Users className="w-6 h-6" /> : <Power className="w-6 h-6" />}
                      {paymentMode === 'Credit' ? 'PROCESS CREDIT' : 'COMPLETE SALE'}
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
