import React from 'react';
import type { LocalProduct } from '../db/posDB';

interface InvoiceProps {
  items: { product: LocalProduct; quantity: number }[];
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  invoiceNo: string;
  date: string;
  customerName?: string;
}

export const Invoice: React.FC<InvoiceProps> = ({ items, total, subtotal, tax, discount, invoiceNo, date, customerName }) => {
  const currentBranchStr = localStorage.getItem('currentBranch');
  const branch = currentBranchStr ? JSON.parse(currentBranchStr) : null;
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const shopAddress = branch?.address || 'Excellence in Service'; 
  const shopTel = branch?.phone || '+265 999 000 000';
  const shopEmail = branch?.email;
  const shopSlogan = branch?.slogan;
  const cashierName = user.fullname || user.username || 'System';
  
  return (
    <div className="invoice relative p-6 bg-white text-black font-mono w-[80mm] mx-auto text-[11px] border-4 border-double border-black leading-tight shadow-sm">
      <div className="absolute top-2 right-2 border border-black px-2 py-0.5 font-black text-[8px] tracking-tighter bg-black text-white">
        Credit Note
      </div>
      
      <div className="text-center border-b-2 border-black pb-4 mb-4">
        <div className="w-14 h-14 mx-auto mb-2 rounded-full border border-black/10 flex items-center justify-center overflow-hidden">
           <img src={branch?.logo || localStorage.getItem('companyLogo') || "/icon.png"} alt="logo" className="w-full h-full object-contain grayscale" />
        </div>
        <h1 className="text-xl font-bold tracking-tight italic">{localStorage.getItem('companyName') || 'MsikaPos'}</h1>
        {shopSlogan && <p className="text-[8px] italic font-bold mb-1 opacity-60">"{shopSlogan}"</p>}
        <p className="text-[9px] tracking-widest">{shopAddress}</p>
        <p className="text-[9px] font-bold mt-1">Tel: {shopTel}</p>
        {shopEmail && <p className="text-[8px] font-bold opacity-60">{shopEmail}</p>}
      </div>

      <div className="mb-4 text-[9px] space-y-1">
        <div className="font-bold flex justify-between">
           <span>Inv: {invoiceNo}</span>
           <span>{(() => {
             if (!date) return new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
             const d = new Date(date);
             return isNaN(d.getTime()) ? new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
           })()}</span>
        </div>
        <div>Cashier: {cashierName}</div>
      </div>

      <div className="mb-4 space-y-1 p-2 bg-zinc-50 border border-black border-dotted">
        <div className="flex gap-2 items-center">
            <span className="font-black text-[9px] min-w-[60px]">Client:</span>
            <span className="font-bold">{customerName || 'N/A'}</span>
        </div>
      </div>

      <table className="w-full mb-4 border-b border-black border-dashed">
        <thead className="border-b border-black text-[9px]">
          <tr>
            <th className="text-left pb-1">Item</th>
            <th className="text-center pb-1">Qty</th>
            <th className="text-right pb-1">Total</th>
          </tr>
        </thead>
        <tbody className="pt-2">
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-1">
                <div className="font-bold">{item.product.name}</div>
                <div className="text-[9px]">MK {item.product.sellPrice.toLocaleString()}</div>
              </td>
              <td className="text-center py-1 font-bold">{item.quantity}</td>
              <td className="text-right py-1 font-bold">MK {(item.product.sellPrice * item.quantity).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-1 font-bold text-[10px] mb-6">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>MK {subtotal.toLocaleString()}</span>
        </div>
        {tax > 0 && (
          <div className="flex justify-between">
            <span>Tax (VAT)</span>
            <span>MK {tax.toLocaleString()}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>- MK {discount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-black border-t-2 border-black pt-1 mt-1">
          <span>Balance due</span>
          <span>MK {total.toLocaleString()}</span>
        </div>
      </div>

      <div className="text-center mb-6 flex flex-col items-center">
        <div className="w-32 mx-auto border-t border-black mb-1"></div>
        <p className="text-[9px] font-black tracking-widest">Authorized Signature</p>
        
        {/* Barcode Section */}
        <div className="mt-6 flex flex-col items-center">
           <img src={`https://barcodeapi.org/api/128/${invoiceNo}?height=40&width=150`} alt="barcode" className="h-10 grayscale invert brightness-0" />
           <span className="text-[8px] font-bold tracking-[0.3em] mt-1">{invoiceNo}</span>
        </div>
      </div>

      <div className="text-center pt-4 mt-4 border-t border-black border-dashed">
        <p className="text-[9px] font-bold italic">Payment expected by due date.</p>
        <p className="text-[11px] font-black mt-2">Thank you for your business!</p>
        <div className="mt-4 opacity-30 text-[7px] font-bold tracking-widest">Powered by MsikaPos Cloud POS</div>
      </div>
      
    </div>
  );
};
