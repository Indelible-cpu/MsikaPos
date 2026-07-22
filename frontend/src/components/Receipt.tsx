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
  isA4?: boolean;
  documentType?: 'Receipt' | 'Invoice';
}

export const Receipt: React.FC<ReceiptProps> = ({ items, total, subtotal, tax, discount, invoiceNo, date, paid, change, mode, bankName, accountNumber, customerName, customerId, signature, isA4, documentType }) => {
  const currentBranchStr = localStorage.getItem('currentBranch');
  const branch = currentBranchStr ? JSON.parse(currentBranchStr) : null;
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const cashierName = user.fullname || user.username || 'System';

  const shopName    = branch?.name     || localStorage.getItem('companyName')    || 'MsikaPos';
  const shopAddress = branch?.address  || localStorage.getItem('companyAddress') || '';
  const shopTel     = branch?.phone    || localStorage.getItem('companyPhone')   || '';
  const shopEmail   = branch?.email    || localStorage.getItem('companyEmail')   || '';
  const shopSlogan  = branch?.slogan   || localStorage.getItem('companySlogan')  || '';
  const shopFB      = branch?.facebook || localStorage.getItem('companyFacebook')|| '';

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

  const displayDate = (() => {
    if (!date) return new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  })();

  if (isA4) {
    return (
      <div className="receipt a4-invoice bg-white text-black p-8 font-sans w-full max-w-[800px] mx-auto min-h-[1000px] flex flex-col box-border shadow-sm border border-gray-100">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
          <div className="flex items-center gap-4">
            <img src={branch?.logo || localStorage.getItem('companyLogo') || "/icon.png"} alt="logo" className="h-20 w-auto object-contain" />
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900">{shopName}</h1>
              {shopSlogan && <p className="text-sm font-medium text-gray-500 italic mt-1">"{shopSlogan}"</p>}
            </div>
          </div>
          <div className="text-right text-sm text-gray-600">
            <h2 className="text-3xl font-black text-gray-200 uppercase tracking-widest mb-2">{documentType ? documentType.toUpperCase() : (mode === 'Cash' ? 'RECEIPT' : 'INVOICE')}</h2>
            {shopAddress && <p className="font-bold text-gray-900">{shopAddress}</p>}
            {shopTel     && <p>Tel: {shopTel}</p>}
            {shopEmail   && <p>{shopEmail}</p>}
            {shopFB      && <p>FB: {shopFB}</p>}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Bill To</h3>
            {customerName ? (
              <div className="text-sm font-semibold text-gray-900">
                <p className="text-lg font-black mb-1">{customerName}</p>
                {customer?.phone && <p>Tel: {customer.phone}</p>}
                {customer?.village && <p>Address: {customer.village}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Walk-in Customer</p>
            )}
          </div>
          
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-center">
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <span className="text-gray-500 font-medium">Invoice No:</span>
              <span className="font-bold text-gray-900 text-right">{invoiceNo}</span>
              
              <span className="text-gray-500 font-medium">Date:</span>
              <span className="font-bold text-gray-900 text-right">{displayDate}</span>
              
              <span className="text-gray-500 font-medium">Branch:</span>
              <span className="font-bold text-gray-900 text-right">{branch?.name || 'Main HQ'}</span>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1">
          <table className="w-full text-sm mb-8 border-collapse">
            <thead>
              <tr className="bg-gray-900 text-white uppercase tracking-wider">
                <th className="text-left py-3 px-4 rounded-tl-lg font-bold">Item Description</th>
                <th className="text-center py-3 px-4 font-bold">Qty</th>
                <th className="text-right py-3 px-4 font-bold">Unit Price</th>
                <th className="text-right py-3 px-4 rounded-tr-lg font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const { finalPrice } = calculateEffectiveDiscount(item.product as LocalProduct);
                return (
                  <tr key={idx} className="border-b border-gray-100 last:border-b-2 last:border-gray-900">
                    <td className="py-4 px-4">
                      <div className="font-bold text-gray-900">{toSentenceCase(item.product.name)}</div>
                    </td>
                    <td className="text-center py-4 px-4 font-semibold text-gray-700">{item.quantity}</td>
                    <td className="text-right py-4 px-4 font-medium text-gray-600">Mk {finalPrice.toLocaleString()}</td>
                    <td className="text-right py-4 px-4 font-bold text-gray-900">Mk {(finalPrice * item.quantity).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end mb-12">
          <div className="w-80 bg-gray-50 p-6 rounded-2xl border border-gray-200">
            <div className="space-y-3 text-sm font-medium text-gray-600">
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
                <div className="flex justify-between text-red-500">
                  <span>Discount</span>
                  <span>- Mk {discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-black text-gray-900 border-t-2 border-gray-900 pt-3 mt-3">
                <span>Total Due</span>
                <span>Mk {total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-auto grid grid-cols-2 gap-8 pt-8 border-t border-gray-200">
          <div>
            {documentType === 'Invoice' ? (
              <>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notice</h4>
                <p className="text-sm font-medium text-gray-700">This is an invoice for the amount due. Please arrange payment.</p>
              </>
            ) : (
              <>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Payment Details</h4>
                <div className="space-y-1 text-sm font-medium text-gray-700">
                  <p>Method: <span className="font-bold text-gray-900">{mode}</span></p>
                  <p>Amount Paid: <span className="font-bold text-gray-900">Mk {paid.toLocaleString()}</span></p>
                  {mode === 'Cash' ? (
                    <p>Change: <span className="font-bold text-gray-900">Mk {change.toLocaleString()}</span></p>
                  ) : (
                    (bankName || accountNumber) && (
                      <>
                        <p>{mode === 'Momo' ? 'Provider' : 'Bank'}: <span className="font-bold">{bankName}</span></p>
                        <p>Reference: <span className="font-bold">{accountNumber}</span></p>
                      </>
                    )
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col items-center justify-center">
            {signature && (
              <div className="mb-2">
                <img src={signature} alt="Signature" className="h-16 object-contain filter grayscale" />
              </div>
            )}
            <div className="w-48 border-t border-gray-400 pt-2 text-center text-xs font-bold text-gray-500 uppercase tracking-widest">
              Authorized Signature
            </div>
          </div>
        </div>
        
        <div className="text-center mt-12 text-xs text-gray-400">
          <p className="font-bold text-gray-500 mb-1">Thank you for your business!</p>
          <p>Goods once sold are not returnable.</p>
          <p className="mt-2 text-[10px] opacity-50">Powered by MsikaPos © {new Date().getFullYear()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="receipt p-0 bg-white text-black font-mono w-full text-[11px] leading-tight shadow-sm flex flex-col items-center">
      <div className="text-center w-full border-b-2 border-black pb-4 mb-4">
        <img src={branch?.logo || localStorage.getItem('companyLogo') || "/icon.png"} alt="logo" className="h-14 w-auto mx-auto mb-2 object-contain" />
        <h1 className="text-xl font-bold tracking-tight  uppercase">{shopName}</h1>
        {shopSlogan && <p className="text-[8px]  font-bold mb-1 opacity-60">"{shopSlogan}"</p>}
        {shopAddress && <p className="text-[9px] tracking-widest">{shopAddress}</p>}
        {shopTel     && <p className="text-[9px] font-bold mt-1">Tel: {shopTel}</p>}
        {shopEmail   && <p className="text-[8px] font-bold opacity-60">{shopEmail}</p>}
        {shopFB      && <p className="text-[8px] font-bold opacity-60">FB: {shopFB}</p>}
      </div>

      <div className="flex flex-col gap-1 mb-4 font-bold text-[9px] w-full">
        <div className="flex justify-between">
          <span>{documentType ? documentType + ':' : (mode === 'Cash' ? 'Receipt:' : 'Invoice:')} {invoiceNo}</span>

          <span>{displayDate}</span>
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

      {documentType !== 'Invoice' && (
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
      )}

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
              
              {documentType !== 'Invoice' && (
                <div className="flex justify-between font-black text-primary-600 border-b border-black/5 pb-1">
                  <span>AMOUNT PAID NOW</span>
                  <span>Mk {paid.toLocaleString()}</span>
                </div>
              )}

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
           <img src={`https://barcodeapi.org/api/128/${encodeURIComponent(invoiceNo)}?height=40&width=150`} alt="barcode" className="h-10" crossOrigin="anonymous" />
           <span className="text-[8px] font-bold tracking-[0.3em] mt-1">{invoiceNo}</span>
        </div>

        <div className="mt-4 flex flex-col items-center gap-0.5 opacity-30">
          <div className="text-[6px] font-bold tracking-widest">Powered by MsikaPos</div>
          <div className="text-[7px] font-bold tracking-wider">© {new Date().getFullYear()} Indelible Technologies. All Rights Reserved.</div>
        </div>
      </div>
      
    </div>
  );
};
