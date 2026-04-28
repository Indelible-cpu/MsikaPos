import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalSale, type LocalSaleItem, type LocalProduct } from '../db/posDB';
import api from '../api/client';
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
import { formatCurrency } from '../utils/phoneUtils';

const SalesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<LocalSale | null>(null);
  const [serverSales, setServerSales] = useState<LocalSale[]>([]);
  const [loading, setLoading] = useState(false);

  const localSales = useLiveQuery(() => db.salesQueue.reverse().toArray());

  useEffect(() => {
    const loadServerSales = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports/transactions');
        if (res.data.success) setServerSales(res.data.data);
      } catch (e) {
        console.error('Failed to load server sales:', e);
      } finally {
        setLoading(false);
      }
    };
    loadServerSales();
  }, []);

  const sales = useMemo(() => {
    const merged = [...(localSales || [])];
    const localInvoices = new Set(merged.map(s => s.invoiceNo));
    serverSales.forEach(ss => {
      if (!localInvoices.has(ss.invoiceNo)) merged.push(ss);
    });
    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [localSales, serverSales]);

  const filteredSales = sales.filter(s => 
    s.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.paymentMode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const today = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(s => s.createdAt.startsWith(today)) || [];
  const totalDiscounts = todaySales.reduce((sum, s) => sum + Number(s.discount || 0), 0);
  const totalRevenue = todaySales.reduce((sum, s) => sum + Number(s.total), 0);
  const totalProfit = todaySales.reduce((sum, s) => {
    const saleProfit = s.items.reduce((pSum: number, item: LocalSaleItem) => pSum + (Number(item.profit) || 0), 0);
    return sum + saleProfit;
  }, 0);

  return (
    <div className="flex flex-col w-full bg-surface-bg transition-all pb-24 md:pb-0">
      <div className="p-6 md:p-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
          <div className="bg-surface-card border border-surface-border p-5 rounded-2xl shadow-sm">
             <div className="flex items-center gap-2 mb-2 text-surface-text/40">
                <DollarSign className="w-3 h-3" />
                <span className="text-[10px] font-bold">Revenue</span>
             </div>
             <div className="text-xl font-black text-primary-400">{formatCurrency(totalRevenue)}</div>
          </div>
          <div className="bg-surface-card border border-surface-border p-5 rounded-2xl shadow-sm">
             <div className="flex items-center gap-2 mb-2 text-surface-text/40">
                <TrendingUp className="w-3 h-3" />
                <span className="text-[10px] font-bold">Profit</span>
             </div>
             <div className="text-xl font-black text-emerald-500">{formatCurrency(totalProfit)}</div>
          </div>
          <div className="bg-surface-card border border-surface-border p-5 rounded-2xl shadow-sm">
             <div className="flex items-center gap-2 mb-2 text-surface-text/40">
                <ReceiptIcon className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-bold">Discounts</span>
             </div>
             <div className="text-xl font-black text-amber-500">{formatCurrency(totalDiscounts)}</div>
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

        <div className="mt-8 relative flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-5 h-5" />
            <input type="text" placeholder="Search invoices..." className="input-field w-full pl-12 py-4 text-sm font-medium shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {loading && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-500/10 text-primary-500 rounded-xl animate-pulse">
               <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
               <span className="text-[10px] font-bold">Syncing cloud logs...</span>
            </div>
          )}
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
                  <div className="font-black text-base text-primary-400">{formatCurrency(sale.total)}</div>
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
                      <div className="text-[10px] text-surface-text/40 font-bold">{formatCurrency(item.unitPrice)} × {item.quantity}</div>
                    </div>
                    <div className="font-black text-primary-400">{formatCurrency(item.lineTotal)}</div>
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
                <span className="text-2xl font-black text-primary-400">{formatCurrency(selectedSale.total)}</span>
              </div>
            </div>

            {/* Print Container for Reprints */}
            <div id="print-container" className="hidden">
              {selectedSale.paymentMode === 'Credit' ? (
                <Invoice 
                  items={selectedSale.items.map(item => ({ product: { name: item.productName, sellPrice: item.unitPrice } as unknown as LocalProduct, quantity: item.quantity }))}
                  total={selectedSale.total}
                  subtotal={selectedSale.subtotal || selectedSale.total}
                  discount={selectedSale.discount || 0}
                  tax={selectedSale.tax || 0}
                  invoiceNo={selectedSale.invoiceNo}
                  date={selectedSale.createdAt}
                  customerName={selectedSale.customerId ? 'Fetching...' : undefined}
                  customerId={selectedSale.customerId}
                />
              ) : (
                <Receipt 
                  items={selectedSale.items.map(item => ({ product: { name: item.productName, sellPrice: item.unitPrice } as unknown as LocalProduct, quantity: item.quantity }))}
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
                  customerId={selectedSale.customerId}
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
