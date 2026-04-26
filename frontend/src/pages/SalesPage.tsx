import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalSale, type LocalSaleItem } from '../db/posDB';
import { 
  Receipt as ReceiptIcon, 
  Search, 
  TrendingUp, 
  DollarSign, 
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../components/Modal';
import { Receipt } from '../components/Receipt';
import { Invoice } from '../components/Invoice';

const SalesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<LocalSale | null>(null);

  const sales = useLiveQuery(() => db.salesQueue.reverse().toArray());
  const filteredSales = sales?.filter(s => 
    s.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.paymentMode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const today = new Date().toISOString().split('T')[0];
  const todaySales = sales?.filter(s => s.createdAt.startsWith(today)) || [];
  const totalRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const totalProfit = todaySales.reduce((sum, s) => {
    const saleProfit = s.items.reduce((pSum, item) => pSum + (item.profit || 0), 0);
    return sum + saleProfit;
  }, 0);

  return (
    <div className="flex flex-col w-full bg-surface-bg transition-all pb-24 md:pb-0">
      <div className="p-6 md:p-10">
        <header className="hidden md:flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter">Sales & profit</h1>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <div className="bg-surface-card border border-surface-border p-5 rounded-2xl shadow-sm">
             <div className="flex items-center gap-2 mb-2 text-surface-text/40">
                <DollarSign className="w-3 h-3" />
                <span className="text-[10px] font-bold">Revenue</span>
             </div>
             <div className="text-xl font-black text-primary-400">MK {totalRevenue.toLocaleString()}</div>
          </div>
          <div className="bg-surface-card border border-surface-border p-5 rounded-2xl shadow-sm">
             <div className="flex items-center gap-2 mb-2 text-surface-text/40">
                <TrendingUp className="w-3 h-3" />
                <span className="text-[10px] font-bold">Profit</span>
             </div>
             <div className="text-xl font-black text-emerald-500">MK {totalProfit.toLocaleString()}</div>
          </div>
          <div className="hidden lg:block bg-surface-card border border-surface-border p-5 rounded-2xl shadow-sm">
             <div className="flex items-center gap-2 mb-2 text-surface-text/40">
                <ReceiptIcon className="w-3 h-3" />
                <span className="text-[10px] font-bold">Orders</span>
             </div>
             <div className="text-xl font-black">{todaySales.length}</div>
          </div>
          <div className="hidden lg:block bg-surface-card border border-surface-border p-5 rounded-2xl shadow-sm">
             <div className="flex items-center gap-2 mb-2 text-surface-text/40">
                <Package className="w-3 h-3" />
                <span className="text-[10px] font-bold">Items sold</span>
             </div>
             <div className="text-xl font-black">{todaySales.reduce((sum, s) => sum + s.itemsCount, 0)}</div>
          </div>
        </div>

        <div className="mt-8 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-5 h-5" />
          <input type="text" placeholder="Search invoices..." className="input-field w-full pl-12 py-4 text-sm font-medium shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="p-0 md:p-8">
        <div className="bg-surface-card border-y md:border md:rounded-3xl border-surface-border overflow-hidden divide-y divide-surface-border">
          {filteredSales?.length === 0 ? (
            <div className="p-20 flex flex-col items-center justify-center text-surface-text/20 font-bold text-sm">
              <ReceiptIcon className="w-16 h-16 mb-4 opacity-20" /> No transactions found
            </div>
          ) : (
            filteredSales?.map((sale) => (
              <div key={sale.id} onClick={() => setSelectedSale(sale)} className="group hover:bg-primary-500/5 transition-all cursor-pointer p-6 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="font-bold text-sm tracking-tight group-hover:text-primary-400 transition-colors">{sale.invoiceNo}</span>
                  <span className="text-[10px] text-surface-text/40 font-bold">{format(new Date(sale.createdAt), 'MMM dd, HH:mm')} • {sale.itemsCount} items</span>
                </div>
                <div className="text-right">
                  <div className="font-black text-base text-primary-400">MK {sale.total.toLocaleString()}</div>
                  <div className="text-[9px] text-surface-text/30 font-bold">{sale.paymentMode}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal 
        isOpen={!!selectedSale} 
        onClose={() => setSelectedSale(null)} 
        title={selectedSale?.invoiceNo || ''}
        maxWidth="max-w-2xl"
      >
        {selectedSale && (
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-surface-text/30 flex items-center gap-2">
                <Package className="w-3 h-3" /> Items purchased
              </h3>
              <div className="space-y-2">
                {selectedSale.items.map((item: LocalSaleItem, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-surface-bg/40 rounded-2xl border border-surface-border">
                    <div>
                      <div className="font-bold text-sm">{item.productName}</div>
                      <div className="text-[10px] text-surface-text/40 font-bold">MK {item.unitPrice.toLocaleString()} × {item.quantity}</div>
                    </div>
                    <div className="font-black text-primary-400">MK {item.lineTotal.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-bg/60 p-6 rounded-2xl border border-surface-border space-y-3">
              <div className="flex justify-between text-xs font-bold text-surface-text/40">
                <span>Payment method</span>
                <span className="text-surface-text">{selectedSale.paymentMode}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t-2 border-surface-border">
                <span className="text-lg font-black tracking-tighter">Grand total</span>
                <span className="text-2xl font-black text-primary-400">MK {selectedSale.total.toLocaleString()}</span>
              </div>
            </div>

            {/* Hidden for screen, visible for print */}
            <div className="hidden">
              {selectedSale.paymentMode === 'Credit' ? (
                <Invoice 
                  items={selectedSale.items.map(item => ({ product: { name: item.productName, sellPrice: item.unitPrice } as any, quantity: item.quantity }))}
                  total={selectedSale.total}
                  subtotal={selectedSale.subtotal || selectedSale.total}
                  discount={selectedSale.discount || 0}
                  tax={selectedSale.tax || 0}
                  invoiceNo={selectedSale.invoiceNo}
                  date={selectedSale.createdAt}
                />
              ) : (
                <Receipt 
                  items={selectedSale.items.map(item => ({ product: { name: item.productName, sellPrice: item.unitPrice } as any, quantity: item.quantity }))}
                  total={selectedSale.total}
                  subtotal={selectedSale.subtotal || selectedSale.total}
                  discount={selectedSale.discount || 0}
                  tax={selectedSale.tax || 0}
                  invoiceNo={selectedSale.invoiceNo}
                  date={selectedSale.createdAt}
                  paid={selectedSale.amountReceived || selectedSale.total}
                  change={selectedSale.changeDue || 0}
                  mode={selectedSale.paymentMode}
                  bankName={selectedSale.bankName}
                  accountNumber={selectedSale.accountNumber}
                />
              )}
            </div>

            <div className="flex gap-4">
              <button onClick={() => window.print()} className="flex-1 py-4 bg-surface-card border border-surface-border rounded-2xl text-[10px] font-bold">Reprint receipt</button>
              <button onClick={() => setSelectedSale(null)} className="flex-1 btn-primary !py-4 text-[10px] font-bold">Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SalesPage;
