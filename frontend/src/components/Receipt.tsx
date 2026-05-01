import React from 'react';
import type { LocalProduct, LocalCustomer } from '../db/posDB';
import { toSentenceCase } from '../utils/stringUtils';
import { calculateEffectiveDiscount } from '../utils/discountUtils';

interface ReceiptProps {
  items: { product: LocalProduct; quantity: number }[];
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  invoiceNo: string;
  date: string;
  paid: number;
  change: number;
  mode: string;
  bankName?: string;
  accountNumber?: string;
  customerName?: string;
  customerId?: string;
  signature?: string;
}

export const Receipt: React.FC<ReceiptProps> = ({ items, total, subtotal, tax, discount, invoiceNo, date, paid, change, mode, bankName, accountNumber, customerName, customerId, signature }) => {
  const currentBranchStr = localStorage.getItem('currentBranch');
  const branch = currentBranchStr ? JSON.parse(currentBranchStr) : null;
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const shopAddress = branch?.address || 'Excellence in Service'; 
  const shopTel = branch?.phone || '+265 999 000 000';
  const shopEmail = branch?.email;
  const shopSlogan = branch?.slogan;
  const shopFB = branch?.facebook;
  const cashierName = user.fullname || user.username || 'System';

  const [customer, setCustomer] = React.useState<LocalCustomer | null>(null);

  React.useEffect(() => {
    if (customerId) {
      import('../db/posDB').then(({ db }) => {
        db.customers.get(customerId).then(c => setCustomer(c || null));
      });
    }
  }, [customerId]);

  return (
    <div className="receipt p-0 bg-white text-black font-mono w-full text-[11px] leading-tight shadow-sm flex flex-col items-center">
      <div className="text-center w-full border-b-2 border-black pb-4 mb-4">
        <div className="w-14 h-14 mx-auto mb-2 rounded-full border border-black/10 flex items-center justify-center overflow-hidden">
           <img src={branch?.logo || localStorage.getItem('companyLogo') || "/icon.png"} alt="logo" className="w-full h-full object-contain grayscale" />
        </div>
        <h1 className="text-xl font-bold tracking-tight  uppercase">{localStorage.getItem('companyName') || 'MsikaPos'}</h1>
        {shopSlogan && <p className="text-[8px]  font-bold mb-1 opacity-60">"{shopSlogan}"</p>}
        <p className="text-[9px] tracking-widest">{shopAddress}</p>
        <p className="text-[9px] font-bold mt-1">Tel: {shopTel}</p>
        {shopEmail && <p className="text-[8px] font-bold opacity-60">{shopEmail}</p>}
        {shopFB && <p className="text-[8px] font-bold opacity-60">FB: {shopFB}</p>}
      </div>

      <div className="flex flex-col gap-1 mb-4 font-bold text-[9px] w-full">
        <div className="flex justify-between">
          <span>{mode === 'Cash' ? 'Rec:' : 'Inv:'} {invoiceNo}</span>
          <span>{(() => {
            if (!date) return new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            const d = new Date(date);
            return isNaN(d.getTime()) ? new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
          })()}</span>
        </div>
        <div className="flex justify-between uppercase">
          <span>Cashier: {cashierName}</span>
          <span>Branch: {branch?.name || 'Main HQ'}</span>
        </div>
        {customerName && <div className="text-right">Cust: {customerName}</div>}
      </div>

      <table className="w-full mb-4 border-b border-black border-dashed">
        <thead className="border-b border-black">
          <tr className=" text-[9px]">
            <th className="text-left pb-1">Item</th>
            <th className="text-center pb-1">Qty</th>
            <th className="text-right pb-1">Total</th>
          </tr>
        </thead>
        <tbody className="pt-2">
          {items.map((item, idx) => {
            const { finalPrice } = calculateEffectiveDiscount(item.product as LocalProduct);
            return (
              <tr key={idx}>
                <td className="py-1 pr-2">
                  <div className="font-bold ">{toSentenceCase(item.product.name)}</div>
                  <div className="text-[9px]">MK {finalPrice.toLocaleString()}</div>
                </td>
                <td className="text-center py-1 font-bold">{item.quantity}</td>
                <td className="text-right py-1 font-bold">MK {(finalPrice * item.quantity).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="space-y-1 font-bold  text-[10px]">
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
        <div className="flex justify-between text-base font-black border-t border-black pt-1 mt-1">
          <span>Total</span>
          <span>MK {total.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-4 pt-2 border-t border-black border-dotted space-y-1 text-[10px]">
        <div className="flex justify-between font-bold">
          <span>Paid ({mode})</span>
          <span>MK {paid.toLocaleString()}</span>
        </div>
        {mode === 'Cash' ? (
          <div className="flex justify-between font-bold">
            <span>Change</span>
            <span>MK {change.toLocaleString()}</span>
          </div>
        ) : (
          (bankName || accountNumber) && (
            <div className="pt-1 border-t border-black/10 mt-1">
              <div className="flex justify-between ">
                <span>{mode === 'Momo' ? 'Provider' : 'Bank'}</span>
                <span>{bankName}</span>
              </div>
              <div className="flex justify-between ">
                <span>Account/Ref</span>
                <span>{accountNumber}</span>
              </div>
            </div>
          )
        )}
      </div>

      <div className="text-center mt-6 border-t border-black border-dashed pt-4 flex flex-col items-center w-full">
        {customer && (
          <div className="w-full py-3 mb-4 border border-black border-dotted flex flex-col items-center gap-2">
            <div className="text-[8px] font-black tracking-widest opacity-40 uppercase">Customer Verification</div>
            <div className="flex items-center gap-4">
              {customer.livePhoto && (
                <img src={customer.livePhoto} alt="cust" className="w-10 h-10 rounded-lg object-cover border border-black/10 grayscale" />
              )}
              <div className="text-left">
                <div className="font-bold text-[9px]">{customer.name}</div>
                <div className="text-[7px] font-bold opacity-60">ID: {customer.idNumber || 'N/A'}</div>
                {customer.fingerprintData && (
                  <div className="text-[7px] font-black text-emerald-600 mt-0.5">✓ BIOMETRIC SECURED</div>
                )}
              </div>
            </div>
          </div>
        )}

        {signature && (
          <div className="w-full flex flex-col items-center mb-4 mt-2">
            <div className="text-[7px] font-black tracking-widest opacity-30 uppercase mb-1 text-center">Digital Signature</div>
            <img src={signature} alt="sign" className="h-10 w-auto grayscale contrast-200" />
            <div className="w-24 border-t border-black/30 mt-1"></div>
            <div className="text-[8px] font-black mt-1 uppercase">{cashierName}</div>
          </div>
        )}

        <p className="text-[9px] font-bold ">Goods once sold are not returnable</p>
        <p className="text-[11px] font-black mt-2">Thank you for your business!</p>
        
        {/* Barcode Section */}
        <div className="mt-4 flex flex-col items-center">
           <img src={`https://barcodeapi.org/api/128/${invoiceNo}?height=40&width=150`} alt="barcode" className="h-10 grayscale invert brightness-0" />
           <span className="text-[8px] font-bold tracking-[0.3em] mt-1">{invoiceNo}</span>
        </div>

        <div className="mt-4 opacity-30 text-[7px] font-bold tracking-widest">Powered by MsikaPos Cloud POS</div>
      </div>
      
    </div>
  );
};
