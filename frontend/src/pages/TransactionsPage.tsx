import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalProduct, type LocalSale } from '../db/posDB';
import api from '../api/client';
import { 
  Search, 
  ArrowLeftRight, 
  Download, 
  ArrowRightCircle
} from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../components/Modal';
import { Receipt } from '../components/Receipt';
import { Invoice } from '../components/Invoice';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import toast from 'react-hot-toast';

const TransactionsPage: React.FC = () => {
  const { isReadOnly } = useFeatureAccess();
  const readOnly = isReadOnly('SALES_HISTORY');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterToday, setFilterToday] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [serverSales, setServerSales] = useState<LocalSale[]>([]);
  const [loading, setLoading] = useState(false);

  const localSales = useLiveQuery(
    () => db.salesQueue
      .filter(s => {
        const matchesSearch = s.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) || (s.customerId || '').includes(searchTerm);
        if (!filterToday) return matchesSearch;
        
        const saleDate = new Date(s.createdAt);
        const today = new Date();
        const isToday = saleDate.getDate() === today.getDate() && 
                        saleDate.getMonth() === today.getMonth() && 
                        saleDate.getFullYear() === today.getFullYear();
        return matchesSearch && isToday;
      })
      .reverse()
      .toArray(),
    [searchTerm, filterToday]
  );

  useEffect(() => {
    const loadServerSales = async () => {
      setLoading(true);
      try {
        const params: { q: string, from?: string } = { q: searchTerm };
        if (filterToday) params.from = new Date().toISOString().split('T')[0];
        const res = await api.get('/reports/transactions', { params });
        if (res.data.success) {
          setServerSales(res.data.data);
        }
      } catch (e) {
        console.error('Failed to load server sales:', e);
      } finally {
        setLoading(false);
      }
    };
    loadServerSales();
  }, [searchTerm, filterToday]);

  // Merge local and server sales, avoiding duplicates by invoiceNo
  const sales = useMemo(() => {
    const merged = [...(localSales || [])];
    const localInvoices = new Set(merged.map(s => s.invoiceNo));
    
    serverSales.forEach(ss => {
      if (!localInvoices.has(ss.invoiceNo)) {
        merged.push(ss);
      }
    });
    
    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [localSales, serverSales]);

  const selectedSale = useMemo(() => {
    if (!selectedSaleId) return null;
    return sales.find(s => s.id === selectedSaleId);
  }, [selectedSaleId, sales]);

  const totalSalesCount = sales.length;
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);

  const handleExport = () => {
    if (!sales || sales.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Invoice No', 'Date', 'Customer', 'Items', 'Subtotal', 'Tax', 'Discount', 'Total', 'Payment Mode'];
    const rows = sales.map(s => [
      s.invoiceNo,
      format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm'),
      s.customerId || 'Walk-in',
      s.itemsCount,
      s.subtotal,
      s.tax,
      s.discount,
      s.total,
      s.paymentMode
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `MsikaPos_Transactions_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported successfully');
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0 px-0">
      <header className="bg-surface-card border-b border-surface-border px-6 md:px-12 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6 sticky top-0 z-30">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-500 border border-primary-500/20">
                <ArrowLeftRight className="w-5 h-5" />
             </div>
             <h1 className="text-2xl font-black tracking-tighter uppercase">Sales</h1>
          </div>
          <p className="text-[10px] font-black text-surface-text/30 tracking-[0.2em] uppercase">Transaction History & Records</p>
        </div>

        <div className="flex items-center gap-3">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-1 bg-primary-500/10 text-primary-500 rounded-lg animate-pulse mr-2">
              <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce"></div>
              <span className="text-[8px] font-black tracking-widest">SYNCING...</span>
            </div>
          )}
          <button 
            onClick={() => setFilterToday(!filterToday)}
            className={`px-4 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all ${
              filterToday ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'bg-surface-bg border border-surface-border text-surface-text/40 hover:text-surface-text'
            } uppercase`}
          >
            Today Only
          </button>
          {!readOnly && (
            <button 
              onClick={handleExport}
              className="btn-primary !px-6 !py-3 text-[10px] font-black tracking-widest shadow-xl shadow-primary-500/10 flex items-center gap-2 uppercase"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          )}
        </div>
      </header>

      <div className="p-6 md:px-12 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
             <div className="bg-surface-bg border border-surface-border p-4 rounded-2xl flex items-center gap-6">
                <div>
                   <div className="text-[9px] font-black tracking-widest text-surface-text/30 uppercase">Total transactions</div>
                   <div className="text-2xl font-black">{totalSalesCount}</div>
                </div>
                <div className="h-8 w-px bg-surface-border"></div>
                <div>
                   <div className="text-[9px] font-black tracking-widest text-surface-text/30 uppercase">Total revenue</div>
                   <div className="text-2xl font-black text-primary-400">MK {totalRevenue.toLocaleString()}</div>
                </div>
             </div>
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search invoice number..."
                  className="input-field w-full pl-11 text-sm h-full font-bold shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
          </div>
        </div>
      </div>

      <div className="p-0">
        <div className="bg-surface-card border-b border-surface-border overflow-hidden divide-y divide-surface-border">
          {sales?.length === 0 ? (
            <div className="p-20 text-center text-surface-text/20 font-black text-xs tracking-widest uppercase">No transactions found</div>
          ) : (
            sales?.map(sale => (
              <div key={sale.id} onClick={() => setSelectedSaleId(sale.id)} className="px-6 md:px-12 py-6 flex justify-between items-center group hover:bg-primary-500/5 transition-colors cursor-pointer">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-surface-bg border border-surface-border rounded-xl flex items-center justify-center text-surface-text/20 group-hover:text-primary-400 transition-colors">
                       <ArrowLeftRight className="w-5 h-5" />
                    </div>
                    <div>
                       <div className="font-black text-sm tracking-tight group-hover:text-primary-400 transition-colors">{sale.invoiceNo}</div>
                       <div className="text-[10px] text-surface-text/40 font-black tracking-widest uppercase">{format(new Date(sale.createdAt), 'MMM dd, HH:mm')} • {sale.itemsCount} items</div>
                    </div>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="text-right">
                       <div className="text-base font-black text-primary-400">MK {sale.total.toLocaleString()}</div>
                       <button 
                         onClick={(e) => { e.stopPropagation(); setSelectedSaleId(sale.id); }}
                         className="text-[9px] text-primary-500 font-black tracking-widest uppercase hover:underline"
                       >
                         View details
                       </button>
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
        maxWidth="max-w-2xl"
      >
        {selectedSale && (
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <div className="text-[10px] font-black  tracking-widest text-surface-text/30 ml-1">Order items</div>
              <div className="space-y-2">
                {selectedSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-surface-bg/50 rounded-2xl border border-surface-border">
                    <div>
                      <div className="font-black text-sm">{item.productName}</div>
                      <div className="text-[10px] text-surface-text/40 font-black  tracking-widest">MK {item.unitPrice.toLocaleString()} × {item.quantity}</div>
                    </div>
                    <div className="font-black text-primary-400">MK {item.lineTotal.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-bg p-6 rounded-2xl border border-surface-border flex justify-between items-center shadow-inner">
               <div className="text-sm font-black  tracking-widest">Grand total</div>
               <div className="text-3xl font-black text-primary-400">MK {selectedSale.total.toLocaleString()}</div>
            </div>

            {/* Hidden for screen, visible for print */}
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
              <button onClick={() => window.print()} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black  tracking-widest">Reprint receipt</button>
              <button onClick={() => setSelectedSaleId(null)} className="flex-1 btn-primary !py-4 text-[10px] font-black  tracking-widest shadow-lg shadow-primary-500/20">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransactionsPage;
