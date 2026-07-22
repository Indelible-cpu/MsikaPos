import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalProduct, type LocalSale } from '../db/posDB';
import api from '../api/client';
import { 
  Search, 
  Download, 
  Trash2,
  Edit,
  Printer,
  MessageSquare,
  Eye,
  FileText,
  Calendar,
  RotateCcw,
  CheckSquare,
  Square
} from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, isWithinInterval, endOfDay } from 'date-fns';
import Modal from '../components/Modal';
import { Receipt } from '../components/Receipt';
import { Invoice } from '../components/Invoice';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { useAuthStore } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { clsx } from 'clsx';

type TimeFilter = 'All' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annual';

const TransactionsPage: React.FC = () => {
  const { isReadOnly } = useFeatureAccess();
  const user = useAuthStore(state => state.user);
  const readOnly = isReadOnly('SALES_HISTORY') || user?.role === 'CASHIER';
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('Daily');
  const [dateFilter, setDateFilter] = useState('');
  const [skuFilter] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [serverSales, setServerSales] = useState<LocalSale[]>([]);
  
  // View/Edit states
  const [viewMode, setViewMode] = useState<'receipt' | 'invoice'>('receipt');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<LocalSale | null>(null);
  const [editForm, setEditForm] = useState({ paymentMode: '', customerId: '' });

  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [refundingSale, setRefundingSale] = useState<LocalSale | null>(null);
  const [refundReason, setRefundReason] = useState('');

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const localSales = useLiveQuery(
    () => db.salesQueue
      .filter(s => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = !term ||
          s.invoiceNo.toLowerCase().includes(term) ||
          (s.customerId || '').toLowerCase().includes(term) ||
          s.items.some(item => item.productName.toLowerCase().includes(term));
        
        // SKU Filter
        const matchesSku = !skuFilter || s.items.some(item => item.productName.toLowerCase().includes(skuFilter.toLowerCase()));
        
        // Date Filter
        if (dateFilter) {
          const saleDate = format(new Date(s.createdAt), 'yyyy-MM-dd');
          if (saleDate !== dateFilter) return false;
        }

        // Scope Filter — skip entirely when 'All' is selected
        let matchesScope = true;
        if (timeFilter !== 'All') {
          const saleDate = new Date(s.createdAt);
          const now = new Date();
          let interval = { start: startOfDay(now), end: endOfDay(now) };

          if (timeFilter === 'Weekly') interval = { start: startOfWeek(now), end: endOfDay(now) };
          else if (timeFilter === 'Monthly') interval = { start: startOfMonth(now), end: endOfDay(now) };
          else if (timeFilter === 'Quarterly') interval = { start: startOfQuarter(now), end: endOfDay(now) };
          else if (timeFilter === 'Annual') interval = { start: startOfYear(now), end: endOfDay(now) };

          matchesScope = isWithinInterval(saleDate, interval);
        }

        return matchesSearch && matchesSku && matchesScope && s.status !== 'DELETED';
      })
      .reverse()
      .toArray(),
    [searchTerm, timeFilter, dateFilter, skuFilter]
  );

  useEffect(() => {
    const clearOldLocalTransactions = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      try {
        const oldSales = await db.salesQueue.where('createdAt').below(thirtyDaysAgo.toISOString()).toArray();
        if (oldSales.length > 0) {
          const ids = oldSales.map(s => s.id);
          await db.salesQueue.bulkDelete(ids);
          console.log(`Auto-cleared ${ids.length} transactions older than 30 days`);
        }
      } catch (err) {
        console.error('Failed to auto-clear old transactions', err);
      }
    };
    clearOldLocalTransactions();
  }, []);

  useEffect(() => {
    const loadServerSales = async () => {
      try {
        const params: { q: string; sku: string; date?: string; scope?: string } = { q: searchTerm, sku: skuFilter };
        if (dateFilter) params.date = dateFilter;
        
        // Scope Map for API
        const scopeMap: Record<TimeFilter, string> = {
          'All': 'all',
          'Daily': 'daily',
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
        // loading state removed
      }
    };
    loadServerSales();
  }, [searchTerm, timeFilter, dateFilter, skuFilter]);

  // Merge local and server sales, avoiding duplicates by invoiceNo
  const sales = useMemo(() => {
    const merged = [...(localSales || [])];
    const localInvoices = new Set(merged.map(s => s.invoiceNo));

    // Build the same date interval used by the local filter
    const now = new Date();
    let scopeStart: Date | null = startOfDay(now);
    if (timeFilter === 'Weekly') scopeStart = startOfWeek(now);
    else if (timeFilter === 'Monthly') scopeStart = startOfMonth(now);
    else if (timeFilter === 'Quarterly') scopeStart = startOfQuarter(now);
    else if (timeFilter === 'Annual') scopeStart = startOfYear(now);
    else if (timeFilter === 'All') scopeStart = null; // no date restriction

    serverSales.forEach(ss => {
      if (ss.status === 'DELETED') return;
      if (localInvoices.has(ss.invoiceNo)) return;

      // Apply scope filter to server sales too
      if (scopeStart !== null) {
        const saleDate = new Date(ss.createdAt);
        if (saleDate < scopeStart || saleDate > endOfDay(now)) return;
      }

      // Apply specific date filter if set
      if (dateFilter) {
        const saleDate = format(new Date(ss.createdAt), 'yyyy-MM-dd');
        if (saleDate !== dateFilter) return;
      }

      merged.push(ss);
    });
    
    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [localSales, serverSales, timeFilter, dateFilter]);

  const selectedSale = useMemo(() => {
    if (!selectedSaleId) return null;
    return sales.find(s => s.id === selectedSaleId);
  }, [selectedSaleId, sales]);

  const totalSalesCount = sales.length;
  const totalRevenue = sales.reduce((sum, s) => sum + (s.status === 'REFUNDED' ? 0 : Number(s.total)), 0);

  const handleDeleteSale = async (saleId: string) => {
    const toastId = toast.loading('Deleting transaction...');
    try {
      await db.salesQueue.delete(saleId);
      try { await api.delete(`/sales/${saleId}`); } catch { /* silent */ }
      toast.success('Transaction deleted', { id: toastId });
      setServerSales(prev => prev.filter(s => s.id !== saleId));
    } catch {
      toast.error('Failed to delete', { id: toastId });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const toastId = toast.loading(`Deleting ${selectedIds.size} transaction(s)...`);
    setIsBulkDeleting(true);
    try {
      const idsArray = Array.from(selectedIds);
      
      // Run API deletions in parallel instead of one by one
      const deletePromises = idsArray.map(id => api.delete(`/sales/${id}`).catch(() => { /* silent */ }));
      await Promise.all(deletePromises);
      
      // Bulk delete locally
      await db.salesQueue.bulkDelete(idsArray);
      
      setServerSales(prev => prev.filter(s => !selectedIds.has(s.id)));
      toast.success(`${idsArray.length} transaction(s) deleted`, { id: toastId });
      setSelectedIds(new Set());
    } catch {
      toast.error('Bulk delete failed', { id: toastId });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sales.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sales.map(s => s.id)));
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
        await api.put(`/sales/${editingSale.id}`, updates);
      } catch { /* Silent */ }
      
      toast.success('Sale updated');
      setIsEditOpen(false);
      setServerSales(prev => prev.map(s => s.id === editingSale.id ? { ...s, paymentMode: updates.paymentMode, customerId: updates.customerId } : s));
    } catch {
      toast.error('Failed to update sale');
    }
  };

  const handleRefundSale = (sale: LocalSale) => {
    setRefundingSale(sale);
    setRefundReason('');
    setIsRefundOpen(true);
  };

  const saveRefund = async () => {
    if (!refundingSale) return;
    if (!refundReason.trim()) {
      toast.error('Refund reason is required');
      return;
    }
    try {
      const updates = { 
        status: 'REFUNDED',
        refundReason: refundReason,
        updatedAt: new Date().toISOString()
      };
      
      // Local update
      await db.salesQueue.update(refundingSale.id, updates);
      
      // Server update
      try {
        await api.put(`/sales/${refundingSale.id}`, updates);
      } catch { /* Silent */ }
      
      toast.success('Sale marked as refunded');
      setIsRefundOpen(false);
      setServerSales(prev => prev.map(s => s.id === refundingSale.id ? { ...s, status: 'REFUNDED', refundReason } : s));
    } catch {
      toast.error('Failed to refund sale');
    }
  };

  const handleShareWhatsApp = async (sale: LocalSale) => {
    try {
      const receiptElement = document.getElementById('print-container');
      if (!receiptElement) return;
      
      toast.loading('Generating shareable receipt...', { id: 'share' });
      
      // Temporarily make it visible for capture if it was hidden
      const canvas = await html2canvas(receiptElement, { scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: false });
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      
      if (!blob) throw new Error('Failed to generate image');

      const file = new File([blob], `Receipt-${sale.invoiceNo}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Receipt',
          text: `Receipt from ${localStorage.getItem('companyName') || 'MsikaPos'} - Order #${sale.invoiceNo}`
        });
        toast.success('Shared successfully', { id: 'share' });
      } else {
        // Fallback to text if file share not supported
        const itemsText = sale.items.map(i => `▫️ ${i.productName}\n   ${i.quantity} x MK ${i.unitPrice.toLocaleString()} = *MK ${i.lineTotal.toLocaleString()}*`).join('\n\n');
        const companyName = localStorage.getItem('companyName') || 'MsikaPos';
        const text = `*Receipt from ${companyName}*\n🧾 *Order #${sale.invoiceNo}*\n\n*Items:*\n${itemsText}\n\n*Total: MK ${sale.total.toLocaleString()}*\n\n_Thank you for your business!_`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        toast.success('WhatsApp opened (Text fallback)', { id: 'share' });
      }
    } catch (err: any) {
      console.error(err);
      if (err?.name === 'AbortError' || err?.message?.includes('Abort') || err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
          // Fallback to text if user gesture lost
          const itemsText = sale.items.map(i => `▫️ ${i.productName}\n   ${i.quantity} x MK ${i.unitPrice.toLocaleString()} = *MK ${i.lineTotal.toLocaleString()}*`).join('\n\n');
          const companyName = localStorage.getItem('companyName') || 'MsikaPos';
          const text = `*Receipt from ${companyName}*\n🧾 *Order #${sale.invoiceNo}*\n\n*Items:*\n${itemsText}\n\n*Total: MK ${sale.total.toLocaleString()}*\n\n_Thank you for your business!_`;
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          toast.success('WhatsApp opened (Text fallback)', { id: 'share' });
        } else {
          toast.dismiss('share');
        }
      } else {
        toast.error('Failed to share: ' + (err?.message || 'Unknown error'), { id: 'share' });
      }
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
    link.setAttribute('download', `MsikaPos_Transactions_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported successfully');
  };

  return (
    <div className="flex flex-col transition-all px-0 relative">

      <div className="bg-background border-b border-border/50 px-4 md:px-12 py-3 sticky top-0 z-40">
        <div className="flex flex-row flex-nowrap items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar pb-1">
          {/* Main Search */}
          <div className="relative flex-[2] min-w-[150px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search invoice or customer..."
              className="input-field w-full pl-11 text-[11px] h-10 font-bold capitalize shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Date Filter */}
          <div className="relative flex-1 min-w-[120px] md:w-44">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
            <input 
              type="date" 
              className="input-field w-full pl-9 text-[10px] h-9 font-bold capitalize shadow-inner"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          {/* Scope Select */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <select 
              value={timeFilter} 
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              className="bg-card/50 border border-border/50 text-foreground text-[9px] font-bold tracking-tight px-3 h-9 rounded-xl appearance-none cursor-pointer hover:border-primary/50 transition-all capitalize btn-press"
            >
              {[{ value: 'Daily', label: 'Daily' }, { value: 'Weekly', label: 'Weekly' }, { value: 'Monthly', label: 'Monthly' }, { value: 'Quarterly', label: 'Quarterly' }, { value: 'Annual', label: 'Annual' }, { value: 'All', label: 'All Sales' }].map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            {!readOnly && (
              <button 
                onClick={handleExport}
                className="btn-primary !px-4 h-9 text-[9px] font-bold tracking-tight shadow-xl shadow-primary/10 flex items-center gap-2 capitalize btn-press shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 md:px-12 pt-6 stagger-children">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
             <div className="glass-card border border-border/50 p-5 rounded-2xl flex items-center gap-8 shadow-sm">
                <div>
                   <div className="text-[9px] font-bold tracking-widest text-muted-foreground capitalize mb-1">
                     {timeFilter === 'All' ? 'All-Time Sales' : `${timeFilter} Sales`}
                   </div>
                   <div className="text-2xl font-bold text-foreground">{totalSalesCount} transactions</div>
                </div>
                <div className="h-10 w-px bg-border/50"></div>
                <div>
                   <div className="text-[9px] font-bold tracking-widest text-muted-foreground capitalize mb-1">
                     {timeFilter === 'All' ? 'Cumulative Revenue' : `${timeFilter} Revenue`}
                   </div>
                   <div className="text-2xl font-bold text-primary">MK {totalRevenue.toLocaleString()}</div>
                </div>
             </div>
             <div className="hidden md:flex items-center justify-end px-4 text-[9px] font-bold text-muted-foreground/20 tracking-widest capitalize">
                Filter: {timeFilter} {dateFilter ? `| ${dateFilter}` : ''} {skuFilter ? `| SKU: ${skuFilter}` : ''}
             </div>
        </div>
      </div>

      <div className="p-0 stagger-children">
        {/* Bulk delete bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-6 md:px-12 py-3 bg-destructive/10 border-b border-destructive/20 animate-in slide-in-from-top-1">
            <span className="text-[10px] font-bold text-destructive tracking-widest">{selectedIds.size} selected</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedIds(new Set())} className="text-[10px] font-bold text-muted-foreground hover:text-foreground tracking-widest capitalize">Cancel</button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-destructive text-white text-[10px] font-bold tracking-widest rounded-xl shadow-sm btn-press disabled:opacity-50 capitalize"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete selected
              </button>
            </div>
          </div>
        )}
        <div className="glass-panel border-b border-border/50 overflow-hidden divide-y divide-border/30">
          {/* Header row with select all */}
          {!readOnly && sales?.length > 0 && (
            <div className="px-4 md:px-8 py-2 flex items-center gap-3 bg-muted/5 border-b border-border/30">
              <button onClick={toggleSelectAll} className="text-muted-foreground/40 hover:text-primary transition-colors">
                {selectedIds.size === sales.length ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
              </button>
              <span className="text-[9px] font-bold tracking-widest text-muted-foreground/40 capitalize">{selectedIds.size === sales.length ? 'Deselect all' : 'Select all'}</span>
            </div>
          )}
          {sales?.length === 0 ? (
             <div className="p-20 text-center text-muted-foreground/20 font-bold text-[10px] tracking-widest capitalize">No transactions found matching your filters</div>
          ) : (
            sales?.map(sale => (
              <div key={sale.id} className={clsx("px-4 md:px-8 py-4 flex justify-between items-center hover:bg-primary/5 transition-all", selectedIds.has(sale.id) && 'bg-primary/5')}>
                 {/* Left: checkbox + info */}
                 <div className="flex items-center gap-3 flex-1 min-w-0">
                    {!readOnly && (
                      <button onClick={(e) => { e.stopPropagation(); toggleSelect(sale.id); }} className="shrink-0 text-muted-foreground/30 hover:text-primary transition-colors">
                        {selectedIds.has(sale.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                      </button>
                    )}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedSaleId(sale.id); setViewMode('receipt'); }}>
                       <div className="font-bold text-sm tracking-tight hover:text-primary transition-colors">{sale.invoiceNo}</div>
                       <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                          <span className="text-[9px] text-muted-foreground font-bold tracking-widest">{format(new Date(sale.createdAt), 'MMM dd, HH:mm')}</span>
                          <span className="text-muted-foreground/20">•</span>
                          <span className="text-[9px] text-muted-foreground font-bold tracking-widest">{sale.itemsCount} items</span>
                          <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest", sale.paymentMode === 'Credit' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary')}>
                             {sale.paymentMode}
                          </span>
                          {sale.status === 'REFUNDED' && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest bg-red-500/10 text-red-500" title={sale.refundReason}>Refunded</span>
                          )}
                          {/* Product names hint */}
                          <span className="text-[8px] text-muted-foreground/30 font-bold truncate max-w-[140px] hidden sm:inline">{sale.items?.map(i => i.productName).join(', ')}</span>
                       </div>
                    </div>
                 </div>

                 {/* Right: amount + actions */}
                 <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                        <div className="text-base font-bold text-primary">MK {sale.total.toLocaleString()}</div>
                        <div className="text-[9px] text-muted-foreground font-bold tracking-widest">{sale.customerId || 'Walk-in'}</div>
                    </div>
                    <div className="flex items-center gap-1">
                       <button 
                         onClick={(e) => { e.stopPropagation(); setSelectedSaleId(sale.id); setViewMode('receipt'); }}
                         className="p-2 rounded-xl text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all btn-press"
                         title="View Receipt"
                       >
                         <Eye className="w-4 h-4" />
                       </button>
                       {!readOnly && (
                         <>
                           {sale.status !== 'REFUNDED' && (
                             <button 
                               onClick={(e) => { e.stopPropagation(); handleRefundSale(sale); }}
                               className="p-2 rounded-xl text-muted-foreground/40 hover:text-blue-500 hover:bg-blue-500/10 transition-all btn-press"
                               title="Refund Transaction"
                             >
                               <RotateCcw className="w-4 h-4" />
                             </button>
                           )}
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleEditSale(sale); }}
                             className="p-2 rounded-xl text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10 transition-all btn-press"
                             title="Edit Transaction"
                           >
                             <Edit className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteSale(sale.id); }}
                             className="p-2 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all btn-press"
                             title="Delete Transaction"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </>
                       )}
                    </div>
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
        <div className="space-y-6">
            <div className="flex justify-center p-1 bg-surface-bg border border-surface-border rounded-2xl w-fit mx-auto shadow-sm mt-6">
              <button 
                onClick={() => setViewMode('receipt')}
                className={clsx(
                  "px-6 py-2.5 rounded-xl text-[10px] font-bold tracking-widest transition-all flex items-center gap-2",
                  viewMode === 'receipt' ? "bg-primary-500 text-white shadow-lg" : "text-surface-text/40 hover:bg-surface-border/50"
                )}
              >
                <FileText className="w-4 h-4" /> Receipt
              </button>
              <button 
                onClick={() => setViewMode('invoice')}
                className={clsx(
                  "px-6 py-2.5 rounded-xl text-[10px] font-bold tracking-widest transition-all flex items-center gap-2",
                  viewMode === 'invoice' ? "bg-primary-500 text-white shadow-lg" : "text-surface-text/40 hover:bg-surface-border/50"
                )}
              >
                <FileText className="w-4 h-4" /> Invoice
              </button>
            </div>

            <div id="print-container" className="bg-white overflow-hidden border-y border-zinc-100 text-black w-full">
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

            <div className="flex flex-col md:flex-row gap-4 px-6 pb-6">
              <button 
                onClick={() => window.print()} 
                className="flex-1 py-5 bg-surface-bg border border-surface-border hover:border-primary-500/20 rounded-2xl text-[10px] font-bold tracking-[0.2em] flex items-center justify-center gap-2 transition-all capitalize"
              >
                <Printer className="w-4 h-4" /> Reprint
              </button>
              <button 
                onClick={() => handleShareWhatsApp(selectedSale)}
                className="flex-1 py-5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-2xl text-[10px] font-bold tracking-[0.2em] flex items-center justify-center gap-2 transition-all capitalize"
              >
                <MessageSquare className="w-4 h-4" /> Reshare WhatsApp
              </button>
              <button 
                onClick={() => setSelectedSaleId(null)} 
                className="flex-1 btn-primary !py-5 text-[10px] font-bold tracking-[0.2em] shadow-xl shadow-primary-500/20 capitalize"
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
              <label className="text-[10px] font-bold tracking-widest text-surface-text/40 ml-1 capitalize">Payment method</label>
              <select 
                className="input-field w-full py-4 px-6 text-sm font-bold capitalize"
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
              <label className="text-[10px] font-bold tracking-widest text-surface-text/40 ml-1 capitalize">Customer (Optional)</label>
              <input 
                type="text" 
                className="input-field w-full py-4 px-6 text-sm font-bold capitalize"
                placeholder="Customer Name or ID"
                value={editForm.customerId}
                onChange={(e) => setEditForm({...editForm, customerId: e.target.value})}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsEditOpen(false)}
              className="flex-1 btn-cancel py-5 text-[10px] capitalize"
            >
              Cancel
            </button>
            <button 
              onClick={saveEdit}
              className="flex-1 btn-primary !py-5 text-[10px] font-bold tracking-widest shadow-xl shadow-primary-500/20 capitalize"
            >
              Save changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Refund Modal */}
      <Modal 
        isOpen={isRefundOpen} 
        onClose={() => setIsRefundOpen(false)} 
        title="Refund Transaction"
        maxWidth="max-w-md"
      >
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-widest text-surface-text/40 ml-1 capitalize">Refund Reason</label>
              <textarea 
                className="input-field w-full py-4 px-6 text-sm font-bold resize-none h-24"
                placeholder="E.g., Customer returned item due to defect..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsRefundOpen(false)}
              className="flex-1 btn-cancel py-5 text-[10px] capitalize"
            >
              Cancel
            </button>
            <button 
              onClick={saveRefund}
              className="flex-1 btn-danger !py-5 text-[10px] capitalize"
            >
              Confirm Refund
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TransactionsPage;
