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
  FileText
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
  const [discount] = useState<number>(0);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Receipt Options
  const [printReceipt, setPrintReceipt] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);

  // Credit Sale Flow
  const [creditMode, setCreditMode] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
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
        status: 'COMPLETED'
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
      <div className="flex flex-col h-full bg-[#f4f6f8] overflow-y-auto max-w-2xl mx-auto w-full relative">
        <div className="bg-[#0052cc] text-white flex items-center px-4 py-4 sticky top-0 z-10 shadow-md">
           <button title="Go Back" aria-label="Go Back" onClick={() => setCreditMode(false)} className="mr-4 active:scale-90 transition-transform"><ChevronLeft className="w-6 h-6" /></button>
           <h2 className="text-lg font-bold">Credit Sale</h2>
        </div>
        
        <div className="p-4 space-y-4 pb-24">
           <div>
             <h3 className="font-bold text-gray-800 mb-2 text-sm">Customer Details</h3>
             <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
               <div className="flex items-center px-4 py-3 border-b border-gray-100">
                 <User className="w-5 h-5 text-gray-400 mr-3" />
                 <input title="Customer Name" aria-label="Customer Name" className="w-full outline-none text-sm text-gray-700 font-medium placeholder:font-normal" placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
               </div>
               <div className="flex items-center px-4 py-3">
                 <MessageCircle className="w-5 h-5 text-gray-400 mr-3" />
                 <input title="WhatsApp Number" aria-label="WhatsApp Number" className="w-full outline-none text-sm text-gray-700 font-medium placeholder:font-normal" placeholder="WhatsApp Number" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} />
               </div>
             </div>
           </div>

           <div>
             <h3 className="font-bold text-gray-800 mb-2 text-sm">Sale Summary</h3>
             <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4 shadow-sm">
               <div className="flex justify-between items-center text-sm">
                 <span className="text-gray-600 font-medium">Total Amount</span>
                 <span className="font-bold text-gray-900">{finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-gray-600 font-medium">Amount Paid</span>
                 <input title="Amount Paid" aria-label="Amount Paid" type="number" className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-right outline-none focus:border-[#0052cc] font-medium" placeholder="Enter amount" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-gray-600 font-medium">Balance</span>
                 <span className="font-bold text-[#0052cc]">{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
               </div>
               <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-100">
                 <span className="text-gray-600 font-medium">Due Date</span>
                 <div className="relative">
                   <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                   <input title="Due Date" aria-label="Due Date" type="date" className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#0052cc] text-gray-700 text-sm font-medium" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                 </div>
               </div>
             </div>
           </div>

           <div>
             <h3 className="font-bold text-gray-800 mb-2 text-sm">Invoice Options</h3>
             <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
               <label className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 text-sm text-gray-700 font-medium"><Printer className="w-4 h-4 text-gray-500" /> Print Invoice</div>
                  <input title="Print Invoice" type="checkbox" className="w-5 h-5 accent-[#0052cc] rounded" checked={printInvoice} onChange={e => setPrintInvoice(e.target.checked)} />
               </label>
               <label className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 text-sm text-gray-700 font-medium"><MessageCircle className="w-4 h-4 text-[#25D366]" /> Send via WhatsApp</div>
                  <input title="Send via WhatsApp" type="checkbox" className="w-5 h-5 accent-[#25D366] rounded" checked={sendWhatsapp} onChange={e => setSendWhatsapp(e.target.checked)} />
               </label>
             </div>
           </div>

           <div className="pt-4">
             <button onClick={handleSaveCreditSale} disabled={isCheckingOut} className="w-full py-4 bg-[#0d8246] text-white font-bold rounded-xl flex items-center justify-center gap-2 text-base active:scale-95 transition-transform shadow-lg shadow-[#0d8246]/20">
               <FileText className="w-5 h-5" /> SAVE CREDIT SALE
             </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f4f6f8] overflow-y-auto max-w-2xl mx-auto w-full relative custom-scrollbar">
      {showScanner && (
        <BarcodeScanner onScan={async (sku) => {
          const p = await db.products.where('sku').equals(sku).first();
          if (p) { addToCart(p); setShowScanner(false); } else toast.error('Not Found');
        }} onClose={() => setShowScanner(false)} />
      )}

      {showReceipt && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white max-w-sm w-full p-0 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 pb-2 flex flex-col items-center border-b border-gray-100">
              <CheckCircle2 className="w-12 h-12 text-[#0d8246] mb-2" />
              <h2 className="text-lg font-bold text-gray-800">Payment Successful</h2>
            </div>
            <div className="max-h-[50vh] overflow-y-auto bg-white p-4">
               <Receipt {...showReceipt} />
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <button onClick={() => setShowReceipt(null)} className="w-full py-3 bg-[#0052cc] text-white rounded-xl font-bold">New Sale</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 p-4 bg-white sticky top-0 z-10 shadow-sm border-b border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            title="Search Products"
            aria-label="Search Products"
            className="w-full pl-10 pr-4 py-3 bg-[#f8f9fa] border border-gray-200 rounded-xl outline-none text-sm text-gray-700 font-medium placeholder:font-normal focus:border-[#0052cc] transition-colors" 
            placeholder="Search products by name, barcode..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          title="Scan Barcode"
          aria-label="Scan Barcode"
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-1.5 px-4 py-3 bg-white border border-gray-200 text-[#0052cc] font-bold rounded-xl active:scale-95 transition-transform"
        >
          <Scan className="w-5 h-5" /> SCAN
        </button>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-800 text-sm">Current Order</h3>
          <button title="Clear Cart" aria-label="Clear Cart" onClick={() => setCart([])} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 font-medium transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#f8f9fa] text-gray-600 font-semibold border-b border-gray-200 text-xs">
              <tr>
                <th className="text-left py-3 px-4 font-semibold">Item</th>
                <th className="text-center py-3 px-2 font-semibold">Qty</th>
                <th className="text-right py-3 px-2 font-semibold">Price</th>
                <th className="text-right py-3 px-4 font-semibold">Total</th>
                <th className="py-3 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {cart.map(item => (
                <tr key={item.product.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 px-4 text-gray-800 font-medium">{toSentenceCase(item.product.name)}</td>
                  <td className="py-3 px-2 text-center text-gray-700">{item.quantity}</td>
                  <td className="py-3 px-2 text-right text-gray-700">{item.product.sellPrice.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">{(item.product.sellPrice * item.quantity).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  <td className="py-3 px-2 text-center">
                    <button title="Remove Item" aria-label="Remove Item" onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"><X className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 text-xs font-medium">No items in order</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="p-4 bg-[#f8f9fa] border-t border-gray-200 flex flex-col items-end gap-1.5 text-sm">
            <div className="flex justify-between w-48"><span className="text-gray-600 font-medium text-xs">Subtotal</span><span className="font-semibold text-gray-800">{cartSubtotal.toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
            {taxConfig.rate > 0 && <div className="flex justify-between w-48"><span className="text-gray-600 font-medium text-xs">Tax ({taxConfig.rate}%)</span><span className="font-semibold text-gray-800">{taxAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>}
            <div className="flex justify-between w-48 text-base font-bold mt-1.5"><span className="text-gray-900">TOTAL</span><span className="text-[#0052cc]">{finalTotal.toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
          </div>
        </div>
      </div>

      <div className="p-4 pt-0">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-800 text-sm">Products</h3>
          <button title="View All Products" aria-label="View All Products" className="text-xs text-[#0052cc] font-bold hover:underline">View All</button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {products?.slice(0, 7).map(p => (
            <div key={p.id} onClick={() => addToCart(p)} className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform hover:shadow-md shadow-sm">
              <div className="w-12 h-12 flex items-center justify-center">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" /> : <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center"><Plus className="w-4 h-4 text-gray-300"/></div>}
              </div>
              <div className="text-center w-full">
                <div className="text-[11px] font-semibold text-gray-800 leading-tight truncate">{toSentenceCase(p.name)}</div>
                <div className="text-[10px] text-gray-500 font-medium mt-0.5">{p.sellPrice.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
              </div>
            </div>
          ))}
          <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer text-[#0052cc] active:scale-95 transition-transform hover:shadow-md shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[#0052cc] text-white flex items-center justify-center shadow-md shadow-[#0052cc]/20"><Plus className="w-5 h-5"/></div>
            <span className="text-[11px] font-bold">More</span>
          </div>
        </div>
      </div>

      <div className="p-4 pt-2">
        <h3 className="font-bold text-gray-800 mb-3 text-sm">Payment Options</h3>
        <div className="grid grid-cols-4 gap-2.5">
          <button onClick={() => setPaymentMode('Cash')} className={`flex flex-col items-center justify-center py-3.5 rounded-xl text-white font-bold text-[10px] sm:text-xs transition-all active:scale-95 ${paymentMode==='Cash'?'ring-2 ring-offset-2 ring-[#0d8246] shadow-md shadow-[#0d8246]/30':''} bg-[#0d8246]`}>
             <Banknote className="w-5 h-5 sm:w-6 sm:h-6 mb-1.5" /> Cash
          </button>
          <button onClick={() => setPaymentMode('Card')} className={`flex flex-col items-center justify-center py-3.5 rounded-xl text-white font-bold text-[10px] sm:text-xs transition-all active:scale-95 ${paymentMode==='Card'?'ring-2 ring-offset-2 ring-[#0052cc] shadow-md shadow-[#0052cc]/30':''} bg-[#0052cc]`}>
             <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 mb-1.5" /> Card
          </button>
          <button onClick={() => setPaymentMode('Momo')} className={`flex flex-col items-center justify-center py-3.5 rounded-xl text-white font-bold text-[10px] sm:text-xs transition-all active:scale-95 ${paymentMode==='Momo'?'ring-2 ring-offset-2 ring-[#ff8c00] shadow-md shadow-[#ff8c00]/30':''} bg-[#ff8c00]`}>
             <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 mb-1.5" /> Mobile Money
          </button>
          <button onClick={() => setPaymentMode('Credit')} className={`flex flex-col items-center justify-center py-3.5 rounded-xl text-white font-bold text-[10px] sm:text-xs transition-all active:scale-95 bg-[#8a2be2] ${paymentMode==='Credit'?'ring-2 ring-offset-2 ring-[#8a2be2] shadow-md shadow-[#8a2be2]/30':''}`}>
             <User className="w-5 h-5 sm:w-6 sm:h-6 mb-1.5" /> Credit Sale →
          </button>
        </div>
      </div>

      <div className="p-4 pt-2">
        <h3 className="font-bold text-gray-800 mb-3 text-sm">Receipt Options</h3>
        <div className="flex gap-3">
           <label className="flex-1 flex items-center justify-between p-3.5 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 transition-colors shadow-sm">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-700 font-medium"><Printer className="w-4 h-4 text-gray-500"/> Print Receipt</div>
              <input title="Print Receipt" type="checkbox" checked={printReceipt} onChange={e => setPrintReceipt(e.target.checked)} className="w-5 h-5 accent-[#0052cc] rounded" />
           </label>
           <label className="flex-1 flex items-center justify-between p-3.5 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 transition-colors shadow-sm">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-700 font-medium"><MessageCircle className="w-4 h-4 text-[#25D366]"/> Send via WhatsApp</div>
              <input title="Send via WhatsApp" type="checkbox" checked={sendWhatsapp} onChange={e => setSendWhatsapp(e.target.checked)} className="w-5 h-5 accent-[#25D366] rounded" />
           </label>
        </div>
      </div>

      <div className="p-4 pt-2 pb-10">
        <button disabled={cart.length === 0 || isCheckingOut} onClick={handleCheckout} className={clsx("w-full py-4 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-base transition-all shadow-lg", cart.length === 0 ? "bg-gray-400 cursor-not-allowed opacity-80" : "bg-[#0052cc] active:scale-95 hover:bg-[#0043a8] shadow-[#0052cc]/30")}>
          <CheckCircle2 className="w-5 h-5" /> COMPLETE SALE
        </button>
      </div>

    </div>
  );
};

export default POSPage;
