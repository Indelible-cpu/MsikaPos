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
  paymentHistory?: { date: string; amount: number; method: string }[];
}

export const Receipt: React.FC<ReceiptProps> = ({ items, total, subtotal, tax, discount, invoiceNo, date, paid, change, mode, bankName, accountNumber, customerName, customerId, signature }) => {
  const currentBranchStr = localStorage.getItem('currentBranch');
  const branch = currentBranchStr ? JSON.parse(currentBranchStr) : null;
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const cashierName = user.fullname || user.username || 'System';

  const shopName = branch?.name || localStorage.getItem('companyName') || 'MsikaPos';
  const shopAddress = branch?.address || localStorage.getItem('companyAddress') || 'Excellence in Service'; 
  const shopTel = branch?.phone || localStorage.getItem('companyPhone') || '+265 999 000 000';
  const shopEmail = branch?.email || localStorage.getItem('companyEmail');
  const shopSlogan = branch?.slogan || localStorage.getItem('companySlogan');
  const shopFB = branch?.facebook || localStorage.getItem('companyFacebook');

  const [customer, setCustomer] = React.useState<LocalCustomer | null>(null);
  const [history, setHistory] = React.useState<{ createdAt: string; amount: number; paymentMethod: string }[]>([]);

  React.useEffect(() => {
    if (customerId) {
      import('../db/posDB').then(({ db }) => {
        db.customers.get(customerId).then(c => setCustomer(c || null));
        db.debtPayments
          .where('customerId').equals(customerId)
          .sortBy('createdAt')
          .then(payments => setHistory(payments));
      });
    }
  }, [customerId]);

  return (
    <div className="receipt p-0 bg-white text-black font-mono w-full text-[11px] leading-tight shadow-sm flex flex-col items-center">
      <div className="text-center w-full border-b-2 border-black pb-4 mb-4">
        <img src={branch?.logo || localStorage.getItem('companyLogo') || "/icon.png"} alt="logo" className="h-14 w-auto mx-auto mb-2 object-contain" />
        <h1 className="text-xl font-bold tracking-tight  uppercase">{shopName}</h1>
        {shopSlogan && <p className="text-[8px]  font-bold mb-1 opacity-60">"{shopSlogan}"</p>}
        <p className="text-[9px] tracking-widest">{shopAddress}</p>
        <p className="text-[9px] font-bold mt-1">Tel: {shopTel}</p>
        {shopEmail && <p className="text-[8px] font-bold opacity-60">{shopEmail}</p>}
        {shopFB && <p className="text-[8px] font-bold opacity-60">FB: {shopFB}</p>}
      </div>

      <div className="flex flex-col gap-1 mb-4 font-bold text-[9px] w-full">
        <div className="flex justify-between">
          <span>{mode === 'Cash' ? 'Receipt:' : 'Invoice:'} {invoiceNo}</span>

          <span>{(() => {
            if (!date) return new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            const d = new Date(date);
            return isNaN(d.getTime()) ? new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
          })()}</span>
        </div>
        <div className="flex justify-between uppercase">
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
                  <div className="text-[9px]">Mk {finalPrice.toLocaleString()}</div>
                </td>
                <td className="text-center py-1 font-bold">{item.quantity}</td>
                <td className="text-right py-1 font-bold">Mk {(finalPrice * item.quantity).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="space-y-1 font-bold  text-[10px]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>Mk {subtotal.toLocaleString()}</span>
        </div>
        {tax > 0 && (
          <div className="flex justify-between">
            <span>Tax (VAT)</span>
            <span>Mk {tax.toLocaleString()}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>- Mk {discount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-black border-t border-black pt-1 mt-1">
          <span>Total</span>
          <span>Mk {total.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-4 pt-2 border-t border-black border-dotted space-y-1 text-[10px]">
        <div className="flex justify-between font-bold">
          <span>Paid ({mode})</span>
          <span>Mk {paid.toLocaleString()}</span>
        </div>
        {mode === 'Cash' ? (
          <div className="flex justify-between font-bold">
            <span>Change</span>
            <span>Mk {change.toLocaleString()}</span>
          </div>
        ) : (
          (bankName || accountNumber) && (
            <div className="pt-1 border-t border-black/10 mt-1">
              <div className="flex justify-between ">
                <span>{mode === 'Momo' ? 'Provider' : 'Bank'}</span>
                <span>{bankName}</span>
              </div>
              <div className="flex justify-between ">
                <span>Account or Reference</span>
                <span>{accountNumber}</span>
              </div>

            </div>
          )
        )}
      </div>

      <div className="text-center mt-6 border-t border-black border-dashed pt-4 flex flex-col items-center w-full">
        {customer && (
          <div className="w-full py-4 mb-4 border border-black border-dotted flex flex-col items-center gap-3">
            <div className="text-[8px] font-bold tracking-widest opacity-40 capitalize">Credit Summary</div>
            
            <div className="flex items-center gap-4 w-full px-4 mb-2">
              {customer.livePhoto && (
                <img src={customer.livePhoto} alt="cust" className="w-10 h-10 rounded-lg object-cover border border-black/10" />
              )}
              <div className="text-left flex-1">
                <div className="font-bold text-[10px]">{customer.name}</div>
                <div className="text-[7px] font-bold opacity-60">ID: {customer.idNumber || 'N/A'}</div>
                {customer.fingerprintData && (
                  <div className="text-[7px] font-black text-emerald-600 mt-0.5 uppercase tracking-tighter">✓ Biometric Identity Secured</div>
                )}
              </div>
            </div>

            <div className="w-full px-4 space-y-1 text-[9px] border-t border-black/10 pt-2">
              <div className="flex justify-between font-bold opacity-60">
                <span>Original Credit Total</span>
                <span>Mk {(customer.totalCreditAmount || customer.balance).toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between font-black text-primary-600 border-b border-black/5 pb-1">
                <span>AMOUNT PAID NOW</span>
                <span>Mk {paid.toLocaleString()}</span>
              </div>

              {history.length > 0 && (
                <div className="py-2 space-y-1 border-b border-black/5 mb-1">
                  <div className="text-[7px] font-black opacity-30 uppercase mb-1">Cumulative History</div>
                  {history.map((h, i) => (
                    <div key={i} className="flex justify-between text-[8px] opacity-70">
                      <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                      <span className="font-bold">Mk {h.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between font-bold text-emerald-700">
                <span>Total Paid to Date</span>
                <span>Mk {(customer.totalPaidAmount || 0).toLocaleString()}</span>
              </div>
               <div className="flex justify-between font-black text-[13px] border-t-2 border-black pt-2 mt-1 bg-black/5 px-1 py-1">
                <span>NEW BALANCE</span>
                <span>Mk {customer.balance.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {signature && (
          <div className="w-full flex flex-col items-center mb-4 mt-2">
            <div className="text-[7px] font-black tracking-widest opacity-30 uppercase mb-1 text-center">Digital Signature</div>
            <img src={signature} alt="sign" className="h-10 w-auto contrast-200" />
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

        <div className="mt-4 flex flex-col items-center gap-0.5 opacity-30">
          <div className="text-[7px] font-bold tracking-widest">Powered by MsikaPos</div>
          <div className="text-[6px] font-bold tracking-wider">© {new Date().getFullYear()} indelible technologies. all rights reserved.</div>
        </div>
      </div>
      
    </div>
  );
};
