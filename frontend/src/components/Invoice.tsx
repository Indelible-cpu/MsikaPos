import React from 'react';
import type { LocalProduct } from '../db/posDB';

interface InvoiceProps {
  items: { product: LocalProduct; quantity: number }[];
  total: number;
  invoiceNo: string;
  date: string;
}

export const Invoice: React.FC<InvoiceProps> = ({ items, total, invoiceNo, date }) => {
  return (
    <div className="invoice relative p-8 bg-white text-black font-mono w-[80mm] mx-auto text-sm border-4 border-double border-black">
      <div className="absolute top-2 right-2 border-2 border-black px-2 py-1 font-bold text-[10px]">
        Unpaid invoice
      </div>
      
      <div className="text-center border-b-2 border-black pb-4 mb-4">
        <h1 className="text-xl font-bold">Vendrax POS</h1>
        <p className="text-xs">Excellence in Service</p>
        <p className="text-xs mt-2">123 Business Street, Lilongwe</p>
      </div>

      <div className="mb-4 text-xs">
        <div className="font-bold">Invoice: {invoiceNo}</div>
        <div>Date: {new Date(date).toLocaleString()}</div>
      </div>

      <div className="mb-4 space-y-1">
        <div className="flex gap-2 items-center">
            <span className="font-bold text-[10px] min-w-[60px]">Customer:</span>
            <div className="flex-1 border-b border-black border-dotted h-4"></div>
        </div>
        <div className="flex gap-2 items-center">
            <span className="font-bold text-[10px] min-w-[60px]">Phone:</span>
            <div className="flex-1 border-b border-black border-dotted h-4"></div>
        </div>
      </div>

      <table className="w-full mb-4 border-b border-black border-dashed">
        <thead className="border-b border-black text-[10px]">
          <tr>
            <th className="text-left pb-1">Item</th>
            <th className="text-center pb-1">Qty</th>
            <th className="text-right pb-1">Total</th>
          </tr>
        </thead>
        <tbody className="pt-2 text-[11px]">
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-1">
                <div className="font-bold">{item.product.name}</div>
                <div className="text-[9px]">MK {item.product.sellPrice.toLocaleString()}</div>
              </td>
              <td className="text-center py-1">{item.quantity}</td>
              <td className="text-right py-1">MK {(item.product.sellPrice * item.quantity).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between font-bold text-base mb-6">
        <span>Balance due</span>
        <span>MK {total.toLocaleString()}</span>
      </div>

      <div className="text-center">
        <div className="w-32 mx-auto border-t border-black mb-1"></div>
        <p className="text-[10px] font-bold">Authorized signature</p>
      </div>

      <div className="text-center pt-4 mt-4 text-[10px]">
        <p>Payment expected by due date.</p>
        <p className="font-bold">Thank you for your business!</p>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .invoice, .invoice * { visibility: visible; }
          .invoice { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 80mm;
            padding: 20px;
          }
          @page { size: 80mm auto; margin: 0; }
        }
      `}} />
    </div>
  );
};
