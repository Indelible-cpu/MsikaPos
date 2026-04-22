import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import { 
  TrendingUp, 
  Search, 
  ArrowLeftRight, 
  RotateCcw, 
  Download, 
  Eye, 
  AlertCircle,
  History,
  ArrowRightCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import Modal from '../components/Modal';

const TransactionsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const sales = useLiveQuery(
    () => db.salesQueue
      .filter(s => s.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) || (s.customerId || '').includes(searchTerm))
      .reverse()
      .toArray(),
    [searchTerm]
  );

  const selectedSale = useLiveQuery(
    () => selectedSaleId ? db.salesQueue.get(selectedSaleId) : null,
    [selectedSaleId]
  );

  const totalSalesCount = sales?.length || 0;
  const totalRevenue = sales?.reduce((sum, s) => sum + s.total, 0) || 0;

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <header className="p-6 bg-surface-card border-b border-surface-border sticky top-0 z-30">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center">
              <History className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase">Transactions</h1>
          </div>
          <button className="btn-primary !px-4 !py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
           <div className="bg-surface-bg border border-surface-border p-4 rounded-2xl flex items-center gap-6">
              <div>
                 <div className="text-[9px] font-black uppercase tracking-widest text-surface-text/30">Total Transactions</div>
                 <div className="text-xl font-black">{totalSalesCount}</div>
              </div>
              <div className="h-8 w-px bg-surface-border"></div>
              <div>
                 <div className="text-[9px] font-black uppercase tracking-widest text-surface-text/30">Total Revenue</div>
                 <div className="text-xl font-black text-primary-400">MK {totalRevenue.toLocaleString()}</div>
              </div>
           </div>
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search invoice number..."
                className="input-field w-full pl-11 text-sm h-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
        </div>
      </header>

      <div className="p-4 md:p-8">
        <div className="bg-surface-card border border-surface-border rounded-3xl overflow-hidden divide-y divide-surface-border">
          {sales?.length === 0 ? (
            <div className="p-20 text-center text-surface-text/20 uppercase font-black text-xs tracking-widest">No transactions found</div>
          ) : (
            sales?.map(sale => (
              <div key={sale.id} onClick={() => setSelectedSaleId(sale.id)} className="p-6 flex justify-between items-center group hover:bg-primary-500/5 transition-colors cursor-pointer">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-surface-bg border border-surface-border rounded-xl flex items-center justify-center text-surface-text/20 group-hover:text-primary-400 transition-colors">
                       <ArrowLeftRight className="w-5 h-5" />
                    </div>
                    <div>
                       <div className="font-black text-sm uppercase group-hover:text-primary-400 transition-colors">{sale.invoiceNo}</div>
                       <div className="text-[10px] text-surface-text/40 font-bold uppercase tracking-widest">{format(new Date(sale.createdAt), 'MMM dd, HH:mm')} • {sale.itemsCount} ITEMS</div>
                    </div>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="text-right">
                       <div className="text-base font-black text-primary-400">MK {sale.total.toLocaleString()}</div>
                       <div className="text-[9px] text-surface-text/30 font-black uppercase tracking-widest">{sale.paymentMode}</div>
                    </div>
                    <ArrowRightCircle className="w-5 h-5 text-surface-text/10 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                 </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal 
        isOpen={!!selectedSaleId} 
        onClose={() => setSelectedSaleId(null)} 
        title={selectedSale?.invoiceNo || ''}
      >
        {selectedSale && (
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-surface-text/30">Order Items</div>
              <div className="space-y-2">
                {selectedSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-surface-bg/50 rounded-2xl border border-surface-border">
                    <div>
                      <div className="font-bold text-sm uppercase">{item.productName}</div>
                      <div className="text-[10px] text-surface-text/40 font-bold">MK {item.unitPrice.toLocaleString()} × {item.quantity}</div>
                    </div>
                    <div className="font-black text-primary-400">MK {item.lineTotal.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-bg p-6 rounded-2xl border border-surface-border flex justify-between items-center">
               <div className="text-sm font-black uppercase">Grand Total</div>
               <div className="text-2xl font-black text-primary-400">MK {selectedSale.total.toLocaleString()}</div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => window.print()} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black uppercase tracking-widest">Reprint Receipt</button>
              <button onClick={() => setSelectedSaleId(null)} className="flex-1 btn-primary !py-4 text-[10px] font-black uppercase tracking-widest">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransactionsPage;
