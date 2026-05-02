import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalProduct, type LocalSale } from '../db/posDB';
import api from '../api/client';
import { 
  Search, 
  ArrowLeftRight, 
  Download, 
  ArrowRightCircle,
  Trash2,
  Edit,
  Printer,
  MessageSquare,
  Eye,
  FileText,
  Calendar,
  PackageSearch,
  X
} from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, isWithinInterval, endOfDay } from 'date-fns';
import Modal from '../components/Modal';
import { Receipt } from '../components/Receipt';
import { Invoice } from '../components/Invoice';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { clsx } from 'clsx';

type TimeFilter = 'Today' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annual';

const TransactionsPage: React.FC = () => {
  const { isReadOnly } = useFeatureAccess();
  const readOnly = isReadOnly('SALES_HISTORY');
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('Today');
  const [dateFilter, setDateFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [serverSales, setServerSales] = useState<LocalSale[]>([]);
  const [loading, setLoading] = useState(false);
  
  // View/Edit states
  const [viewMode, setViewMode] = useState<'receipt' | 'invoice'>('receipt');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<LocalSale | null>(null);
  const [editForm, setEditForm] = useState({ paymentMode: '', customerId: '' });

  const localSales = useLiveQuery(
    () => db.salesQueue
      .filter(s => {
        const matchesSearch = s.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (s.customerId || '').includes(searchTerm);
        
        // SKU Filter
        const matchesSku = !skuFilter || s.items.some(item => item.productName.toLowerCase().includes(skuFilter.toLowerCase()));
        
        // Date Filter
        if (dateFilter) {
          const saleDate = format(new Date(s.createdAt), 'yyyy-MM-dd');
          if (saleDate !== dateFilter) return false;
        }

        // Scope Filter
        const saleDate = new Date(s.createdAt);
        const now = new Date();
        let interval = { start: startOfDay(now), end: endOfDay(now) };

        if (timeFilter === 'Weekly') interval = { start: startOfWeek(now), end: endOfDay(now) };
        else if (timeFilter === 'Monthly') interval = { start: startOfMonth(now), end: endOfDay(now) };
        else if (timeFilter === 'Quarterly') interval = { start: startOfQuarter(now), end: endOfDay(now) };
        else if (timeFilter === 'Annual') interval = { start: startOfYear(now), end: endOfDay(now) };

        const matchesScope = isWithinInterval(saleDate, interval);

        return matchesSearch && matchesSku && matchesScope;
      })
      .reverse()
      .toArray(),
    [searchTerm, timeFilter, dateFilter, skuFilter]
  );

  useEffect(() => {
    const loadServerSales = async () => {
      setLoading(true);
      try {
        const params: { q: string; sku: string; date?: string; scope?: string } = { q: searchTerm, sku: skuFilter };
        if (dateFilter) params.date = dateFilter;
        
        // Scope Map for API
        const scopeMap: Record<TimeFilter, string> = {
          'Today': 'today',
          'Weekly': 'weekly',
          'Monthly': 'monthly',
          'Quarterly': 'quarterly',
          'Annual': 'annual'
        };
        params.scope = scopeMap[timeFilter];

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
  }, [searchTerm, timeFilter, dateFilter, skuFilter]);

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

  const handleDeleteSale = async (saleId: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction? This cannot be undone.')) return;
    try {
      // 1. Local Delete
      await db.salesQueue.delete(saleId);
      
      // 2. Server Delete (Optional, depends if it's synced)
      try {
        await api.delete(`/sales/\${saleId}`);
      } catch { /* Silent if not found on server */ }
      
      toast.success('Transaction deleted');
      setServerSales(prev => prev.filter(s => s.id !== saleId));
    } catch {
      toast.error('Failed to delete transaction');
    }
  };

  const handleEditSale = (sale: LocalSale) => {
    setEditingSale(sale);
    setEditForm({ 
      paymentMode: sale.paymentMode, 
      customerId: sale.customerId || '' 
    });
    setIsEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editingSale) return;
    try {
      const updates = { 
        paymentMode: editForm.paymentMode, 
        customerId: editForm.customerId || undefined,
        updatedAt: new Date().toISOString()
      };
      
      // Local update
      await db.salesQueue.update(editingSale.id, updates);
      
      // Server update
      try {
        await api.put(`/sales/\${editingSale.id}`, updates);
      } catch { /* Silent */ }
      
      toast.success('Sale updated');
      setIsEditOpen(false);
      // Refresh local merge by trigger
    } catch {
      toast.error('Failed to update sale');
    }
  };

  const handleShareWhatsApp = async (sale: LocalSale) => {
    try {
      const receiptElement = document.getElementById('print-container');
      if (!receiptElement) return;
      
      toast.loading('Generating shareable receipt...', { id: 'share' });
      
      // Temporarily make it visible for capture
      receiptElement.classList.remove('hidden');
      await html2canvas(receiptElement, { scale: 2 });
      receiptElement.classList.add('hidden');
      
      const itemsText = sale.items.map(i => `▫️ ${i.productName}\n   ${i.quantity} x MK ${i.unitPrice.toLocaleString()} = *MK ${i.lineTotal.toLocaleString()}*`).join('\n\n');
      const text = `*Support Receipt*\n🧾 *Order #${sale.invoiceNo}*\n\n*ITEMS:*\n${itemsText}\n\n*TOTAL: MK ${sale.total.toLocaleString()}*\n\n_Thank you for your business!_`;
      
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
      toast.success('WhatsApp opened', { id: 'share' });
    } catch {
      toast.error('Failed to share', { id: 'share' });
    }
  };

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
    link.setAttribute('download', `MsikaPos_Transactions_\${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported successfully');
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0 px-0">
      <div className="bg-surface-card border-b border-surface-border px-6 md:px-12 py-8 sticky top-0 z-30">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col">
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              {loading && (
                <div className="flex items-center gap-2 px-3 py-1 bg-primary-500/10 text-primary-500 rounded-lg animate-pulse mr-2">
                  <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce"></div>
                  <span className="text-[8px] font-black tracking-widest">SYNCING...</span>
                </div>
              )}
              
              <select 
                value={timeFilter} 
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                className="bg-surface-bg border border-surface-border text-surface-text text-[10px] font-black tracking-widest px-4 py-3 rounded-xl appearance-none cursor-pointer hover:border-primary-500/50 transition-all uppercase"
                title="Select time scope"
              >
                {['Today', 'Weekly', 'Monthly', 'Quarterly', 'Annual'].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>

              {!readOnly && (
                <button 
                  onClick={handleExport}
                  className="btn-primary !px-6 !py-3 text-[10px] font-black tracking-widest shadow-xl shadow-primary-500/10 flex items-center gap-2 uppercase"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative col-span-1 md:col-span-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search invoice or customer..."
                className="input-field w-full pl-11 text-[11px] h-12 font-black uppercase shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
              <input 
                type="date" 
                className="input-field w-full pl-11 text-[11px] h-12 font-black uppercase shadow-inner"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                title="Filter by actual date"
              />
              {dateFilter && (
                <button 
                  onClick={() => setDateFilter('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-text/40 hover:text-red-500"
                  title="Clear date filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="relative">
              <PackageSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search by SKU..."
                className="input-field w-full pl-11 text-[11px] h-12 font-black uppercase shadow-inner"
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
              />
              {skuFilter && (
                <button 
                  onClick={() => setSkuFilter('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-text/40 hover:text-red-500"
                  title="Clear SKU filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 md:px-12 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
             <div className="bg-surface-bg border border-surface-border p-5 rounded-2xl flex items-center gap-8 shadow-sm">
                <div>
                   <div className="text-[9px] font-black tracking-widest text-surface-text/30 uppercase mb-1">Volume</div>
                   <div className="text-2xl font-black">{totalSalesCount}</div>
                </div>
                <div className="h-10 w-px bg-surface-border"></div>
                <div>
                   <div className="text-[9px] font-black tracking-widest text-surface-text/30 uppercase mb-1">Net revenue</div>
                   <div className="text-2xl font-black text-primary-500">MK {totalRevenue.toLocaleString()}</div>
                </div>
             </div>
             <div className="hidden md:flex items-center justify-end px-4 text-[9px] font-black text-surface-text/20 tracking-widest uppercase">
                Filter: {timeFilter} {dateFilter ? `| \${dateFilter}` : ''} {skuFilter ? `| SKU: \${skuFilter}` : ''}
             </div>
        </div>
      </div>

      <div className="p-0">
        <div className="bg-surface-card border-b border-surface-border overflow-hidden divide-y divide-surface-border">
          {sales?.length === 0 ? (
            <div className="p-20 text-center text-surface-text/20 font-black text-xs tracking-widest uppercase">No transactions found matching your filters</div>
          ) : (
            sales?.map(sale => (
              <div key={sale.id} className="px-6 md:px-12 py-6 flex justify-between items-center group hover:bg-primary-500/[0.02] transition-colors relative">
                 <div className="flex items-center gap-6 cursor-pointer" onClick={() => { setSelectedSaleId(sale.id); setViewMode('receipt'); }}>
                    <div className="w-12 h-12 bg-surface-bg border border-surface-border rounded-2xl flex items-center justify-center text-surface-text/20 group-hover:border-primary-500/20 group-hover:text-primary-500 transition-all shadow-sm">
                       <ArrowLeftRight className="w-6 h-6" />
                    </div>
                    <div>
                       <div className="font-black text-base tracking-tight group-hover:text-primary-500 transition-colors uppercase">{sale.invoiceNo}</div>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-surface-text/40 font-black tracking-widest uppercase">{format(new Date(sale.createdAt), 'MMM dd, HH:mm')}</span>
                          <span className="text-[10px] text-surface-text/10">•</span>
                          <span className="text-[10px] text-surface-text/40 font-black tracking-widest uppercase">{sale.itemsCount} items</span>
                          <span className="text-[10px] text-surface-text/10">•</span>
                          <span className={clsx("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest", sale.paymentMode === 'Credit' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary-500/10 text-primary-500')}>
                             {sale.paymentMode}
                          </span>
                       </div>
                    </div>
                 </div>

                 <div className="flex items-center gap-8">
                    <div className="text-right hidden sm:block">
                       <div className="text-lg font-black text-primary-500 uppercase">MK {sale.total.toLocaleString()}</div>
                       <div className="text-[9px] text-surface-text/30 font-black uppercase tracking-widest">{sale.customerId || 'Walk-in customer'}</div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button 
                         onClick={() => { setSelectedSaleId(sale.id); setViewMode('receipt'); }}
                         className="p-3 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-primary-500 hover:border-primary-500/20 transition-all shadow-sm"
                         title="View Receipt"
                       >
                         <Eye className="w-4 h-4" />
                       </button>
                       {!readOnly && (
                         <>
                           <button 
                             onClick={() => handleEditSale(sale)}
                             className="p-3 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-amber-500 hover:border-amber-500/20 transition-all shadow-sm"
                             title="Edit Transaction"
                           >
                             <Edit className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => handleDeleteSale(sale.id)}
                             className="p-3 bg-surface-bg border border-surface-border rounded-xl text-surface-text/40 hover:text-red-500 hover:border-red-500/20 transition-all shadow-sm"
                             title="Delete Transaction"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </>
                       )}
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
          <div className="p-8 space-y-10">
            <div className="flex justify-center p-1 bg-surface-bg border border-surface-border rounded-2xl w-fit mx-auto shadow-sm">
              <button 
                onClick={() => setViewMode('receipt')}
                className={clsx(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center gap-2",
                  viewMode === 'receipt' ? "bg-primary-500 text-white shadow-lg" : "text-surface-text/40 hover:bg-surface-border/50"
                )}
              >
                <FileText className="w-4 h-4" /> Receipt
              </button>
              <button 
                onClick={() => setViewMode('invoice')}
                className={clsx(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center gap-2",
                  viewMode === 'invoice' ? "bg-primary-500 text-white shadow-lg" : "text-surface-text/40 hover:bg-surface-border/50"
                )}
              >
                <FileText className="w-4 h-4" /> Invoice
              </button>
            </div>

            <div id="print-container" className="bg-white rounded-[2rem] overflow-hidden shadow-inner border border-zinc-100 p-8 max-h-[50vh] overflow-y-auto text-black flex justify-center">
              {viewMode === 'invoice' ? (
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

            <div className="flex flex-col md:flex-row gap-4">
              <button 
                onClick={() => window.print()} 
                className="flex-1 py-5 bg-surface-bg border border-surface-border hover:border-primary-500/20 rounded-2xl text-[10px] font-black tracking-[0.2em] flex items-center justify-center gap-2 transition-all uppercase"
              >
                <Printer className="w-4 h-4" /> Reprint
              </button>
              <button 
                onClick={() => handleShareWhatsApp(selectedSale)}
                className="flex-1 py-5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-2xl text-[10px] font-black tracking-[0.2em] flex items-center justify-center gap-2 transition-all uppercase"
              >
                <MessageSquare className="w-4 h-4" /> Reshare WhatsApp
              </button>
              <button 
                onClick={() => setSelectedSaleId(null)} 
                className="flex-1 btn-primary !py-5 text-[10px] font-black tracking-[0.2em] shadow-xl shadow-primary-500/20 uppercase"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        title="Edit Transaction"
        maxWidth="max-w-md"
      >
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-surface-text/40 ml-1 uppercase">Payment method</label>
              <select 
                className="input-field w-full py-4 px-6 text-sm font-black uppercase"
                value={editForm.paymentMode}
                onChange={(e) => setEditForm({...editForm, paymentMode: e.target.value})}
                title="Select payment mode"
              >
                <option value="Cash">Cash</option>
                <option value="Card">Bank</option>
                <option value="Momo">MoMo</option>
                <option value="Credit">Credit</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-surface-text/40 ml-1 uppercase">Customer (Optional)</label>
              <input 
                type="text" 
                className="input-field w-full py-4 px-6 text-sm font-black uppercase"
                placeholder="Customer Name or ID"
                value={editForm.customerId}
                onChange={(e) => setEditForm({...editForm, customerId: e.target.value})}
              />
            </div>
          </div>
          <button 
            onClick={saveEdit}
            className="w-full btn-primary !py-5 text-[10px] font-black tracking-widest shadow-xl shadow-primary-500/20 uppercase"
          >
            Save changes
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default TransactionsPage;
