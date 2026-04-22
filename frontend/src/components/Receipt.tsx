import React from 'react';
import type { LocalProduct } from '../db/posDB';

interface ReceiptProps {
  items: { product: LocalProduct; quantity: number }[];
  total: number;
  invoiceNo: string;
  date: string;
}

export const Receipt: React.FC<ReceiptProps> = ({ items, total, invoiceNo, date }) => {
  return (
    <div className="receipt p-8 bg-white text-black font-mono w-[80mm] mx-auto text-sm">
      <div className="text-center border-b-2 border-black pb-4 mb-4">
        <h1 className="text-xl font-bold">Vendrax POS</h1>
        <p className="text-xs">Excellence in Service</p>
        <p className="text-xs mt-2">123 Business Street, Lilongwe</p>
        <p className="text-xs">Tel: +265 999 000 000</p>
      </div>

      <div className="flex justify-between mb-4 text-xs font-bold">
        <span>Inv: {invoiceNo}</span>
        <span>{new Date(date).toLocaleString()}</span>
      </div>

      <table className="w-full mb-4 border-b border-black border-dashed">
        <thead className="border-b border-black">
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
                <div className="text-[10px]">MK {item.product.sellPrice.toLocaleString()} ea</div>
              </td>
              <td className="text-center py-1">{item.quantity}</td>
              <td className="text-right py-1">MK {(item.product.sellPrice * item.quantity).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between font-bold text-lg mb-4">
        <span>Total</span>
        <span>MK {total.toLocaleString()}</span>
      </div>

      <div className="text-center border-t border-black border-dashed pt-4 mt-4">
        <p className="text-[10px] italic">Goods once sold are not returnable</p>
        <p className="font-bold mt-2">Thank you for your business!</p>
      </div>
      
      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .receipt, .receipt * { visibility: visible; }
          .receipt { 
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
