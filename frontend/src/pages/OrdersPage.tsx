import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import AppFooter from '../components/AppFooter';
import Modal from '../components/Modal';
import html2canvas from 'html2canvas';
import { 
  Printer, 
  CheckCircle,
  PackageOpen,
  X,
  Share2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WorkingListItem {
  productId: number;
  productName: string;
  currentStock: number;
  reorderLevel: number;
  suggestedQty: number;
  orderQty: number;
  unitCost: number;
  lineTotal: number;
}

const OrdersPage: React.FC = () => {
  const products = useLiveQuery(() => db.products.filter(p => !p.deleted).toArray());
  const sales = useLiveQuery(() => db.salesQueue.toArray());

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [overrideQuantities, setOverrideQuantities] = useState<Record<number, number>>({});
  const [excludedProducts, setExcludedProducts] = useState<Set<number>>(new Set());

  // Generate the live working list
  const workingList = useMemo<WorkingListItem[]>(() => {
    if (!products) return [];

    const productSalesMap: Record<number, { lastSaleDate: Date; totalSold: number }> = {};
    if (sales) {
      sales.forEach(sale => {
        const saleDate = new Date(sale.createdAt);
        sale.items.forEach(item => {
          const prev = productSalesMap[item.productId];
          if (!prev || saleDate > prev.lastSaleDate) {
            productSalesMap[item.productId] = {
              lastSaleDate: saleDate,
              totalSold: (prev?.totalSold || 0) + item.quantity
            };
          } else {
            prev.totalSold += item.quantity;
          }
        });
      });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const lowStockItems = products.filter(p => {
      if (p.isService) return false;
      if (excludedProducts.has(p.id)) return false;

      // Rule: ONLY include if Current Stock <= Reorder Level OR Current Stock == 0
      const reorderLimit = p.reorderLevel !== undefined ? p.reorderLevel : 2;
      return p.quantity <= reorderLimit || p.quantity === 0;
    });

    return lowStockItems.map(p => {
      const reorderLimit = p.reorderLevel !== undefined ? p.reorderLevel : 2;
      const baseQty = Math.max(0, reorderLimit - p.quantity);
      
      const salesInfo = productSalesMap[p.id];
      const salesLast30Days = salesInfo && salesInfo.lastSaleDate >= thirtyDaysAgo ? salesInfo.totalSold : 0;
      
      // Smart Qty: Boost quantity based on recent sales. Fast moving gets more, slow gets base.
      let suggestedQty = Math.max(baseQty, salesLast30Days);
      if (suggestedQty <= 0) suggestedQty = 1;

      // Apply manual override if exists
      const finalQty = overrideQuantities[p.id] !== undefined ? overrideQuantities[p.id] : suggestedQty;

      return {
        productId: p.id,
        productName: p.name,
        currentStock: p.quantity,
        reorderLevel: reorderLimit,
        suggestedQty: suggestedQty,
        orderQty: finalQty,
        unitCost: p.costPrice || 0,
        lineTotal: finalQty * (p.costPrice || 0)
      };
    });
  }, [products, sales, overrideQuantities, excludedProducts]);

  const orderTotal = useMemo(() => {
    return workingList.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [workingList]);

  const handleUpdateOrderItem = (productId: number, value: number) => {
    setOverrideQuantities(prev => ({ ...prev, [productId]: value }));
  };

  const handleRemoveOrderItem = (productId: number) => {
    setExcludedProducts(prev => {
      const newSet = new Set(prev);
      newSet.add(productId);
      return newSet;
    });
    // also clear override if exists
    setOverrideQuantities(prev => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  const receiveStockToInventory = () => {
    if (workingList.length === 0) return;
    setShowConfirmModal(true);
  };

  const confirmReceiveStockToInventory = async () => {
    setShowConfirmModal(false);
    try {
      const promises = workingList.map(async (item) => {
        const product = await db.products.get(item.productId);
        if (product) {
          await db.products.update(item.productId, {
            quantity: Number(product.quantity) + Number(item.orderQty),
            costPrice: Number(item.unitCost), // update cost to latest
            updatedAt: new Date().toISOString()
          });
        }
      });
      await Promise.all(promises);
      
      const poRef = `PO-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
      await db.expenses.add({
        id: crypto.randomUUID(),
        amount: orderTotal,
        category: 'Inventory Restock',
        description: `Order ${poRef}`,
        paymentMethod: 'Cash',
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        synced: 0
      });

      toast.success('Inventory stock updated and expense recorded!', { icon: '📦' });
      
      // Clear manual overrides/exclusions for these items since they are processed
      setOverrideQuantities({});
      setExcludedProducts(new Set());
    } catch (err) {
      toast.error('Failed to update inventory.');
    }
  };

  const shareOrderList = async () => {
    const printElement = document.getElementById('supplier-doc-print-area');
    if (!printElement) return;

    const toastId = toast.loading('Generating shareable document...');
    try {
      const canvas = await html2canvas(printElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to generate image');
      
      const poRef = `PO-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
      const file = new File([blob], `Restocking-List-${poRef}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Restocking List - ${poRef}`,
          text: 'Please find the attached restocking order list.'
        });
        toast.success('Shared successfully', { id: toastId });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Restocking-List-${poRef}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Downloaded document', { id: toastId });
      }
    } catch (e) {
      toast.error('Failed to generate document', { id: toastId });
    }
  };

  return (
    <div className="flex flex-col w-full px-0 relative pb-20">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-background border-b border-border/50 px-2 md:px-12 py-3 sticky top-0 z-40">
        <div className="flex overflow-x-auto no-scrollbar gap-2 w-full">
             <button 
               onClick={shareOrderList}
               disabled={workingList.length === 0}
               className="btn-secondary h-10 px-3 uppercase text-[9px] md:text-[10px] font-black tracking-widest flex items-center gap-1.5 disabled:opacity-50 shrink-0"
             >
               <Share2 className="w-4 h-4" /> <span>Share</span>
             </button>
             <button 
               onClick={() => window.print()}
               disabled={workingList.length === 0}
               className="btn-secondary h-10 px-3 uppercase text-[9px] md:text-[10px] font-black tracking-widest flex items-center gap-1.5 disabled:opacity-50 shrink-0"
             >
               <Printer className="w-4 h-4" /> <span>Print</span>
             </button>
             <button 
               onClick={receiveStockToInventory}
               disabled={workingList.length === 0}
               className="btn-primary h-10 px-3 uppercase text-[9px] md:text-[10px] font-black tracking-widest flex items-center gap-1.5 shadow-lg shadow-primary/20 disabled:opacity-50 shrink-0"
             >
               <CheckCircle className="w-4 h-4" /> <span>Receive Stock</span>
             </button>
        </div>
      </div>

      <div className="px-1 md:px-12 py-6">
           {/* Table Container */}
           <div className="glass-panel border border-border/50 rounded-xl overflow-x-auto p-0 relative">
              <div className="w-full">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border/50 text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-tight bg-surface-bg/50">
                      <th className="px-2 py-3 md:p-4 w-[35%]">Product Name</th>
                      <th className="px-2 py-3 md:p-4 text-center">Stock</th>
                      <th className="px-2 py-3 md:p-4 text-center">Reorder</th>
                      <th className="px-2 py-3 md:p-4 text-center">Sugg.</th>
                      <th className="px-2 py-3 md:p-4 text-center w-24">Order Qty</th>
                      <th className="px-2 py-3 md:p-4 text-right">Cost</th>
                      <th className="px-2 py-3 md:p-4 text-right">Total</th>
                      <th className="px-2 w-8 md:w-12 text-center"></th>
                    </tr>
                  </thead>
                 <tbody className="divide-y divide-border/20">
                   {workingList.map(item => (
                     <tr key={item.productId} className="hover:bg-muted/10 transition-colors lowercase first-letter:uppercase">
                       <td className="px-2 py-2 md:p-4 font-bold text-[10px] md:text-sm whitespace-normal break-words">
                         {item.productName}
                       </td>
                       <td className="px-2 py-2 md:p-4 text-center text-[10px] md:text-xs font-black text-destructive">
                         {item.currentStock}
                       </td>
                       <td className="px-2 py-2 md:p-4 text-center text-[10px] md:text-xs font-black text-amber-500">
                         {item.reorderLevel}
                       </td>
                       <td className="px-2 py-2 md:p-4 text-center text-[10px] md:text-xs font-black text-blue-500">
                         {item.suggestedQty}
                       </td>
                       <td className="px-2 py-2 md:p-4 text-center">
                         <input 
                           type="number" 
                           className="input-field w-12 md:w-16 text-center py-1 md:py-1.5 px-0 text-[10px] md:text-xs font-black mx-auto"
                           value={item.orderQty}
                           onChange={(e) => handleUpdateOrderItem(item.productId, Number(e.target.value))}
                           min="1"
                         />
                       </td>
                       <td className="px-2 py-2 md:p-4 text-right text-[10px] md:text-xs font-black text-muted-foreground whitespace-nowrap">
                         {item.unitCost.toLocaleString()}
                       </td>
                       <td className="px-2 py-2 md:p-4 text-right text-[10px] md:text-sm font-black text-primary whitespace-nowrap">
                         {item.lineTotal.toLocaleString()}
                       </td>
                       <td className="p-1 md:p-4 text-center">
                         <button 
                           onClick={() => handleRemoveOrderItem(item.productId)}
                           className="p-1 md:p-2 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                           title="Exclude from list"
                         >
                           <X className="w-3 h-3 md:w-4 md:h-4" />
                         </button>
                       </td>
                     </tr>
                   ))}
                   {workingList.length === 0 && (
                     <tr>
                       <td colSpan={8} className="p-16 text-center text-muted-foreground">
                         <PackageOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                         <div className="font-black text-lg">Inventory is looking healthy!</div>
                         <div className="text-sm font-bold opacity-60">No items are currently below their reorder levels.</div>
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
             
             {workingList.length > 0 && (
                <div className="bg-surface-bg/50 border-t border-border/50 p-6 flex justify-end">
                   <div className="text-right">
                     <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Estimated Grand Total</div>
                     <div className="text-2xl font-black text-primary">MK{orderTotal.toLocaleString()}</div>
                   </div>
                </div>
             )}
          </div>
      </div>

      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Receive Stock">
        <div className="p-6">
          <p className="text-sm font-bold text-surface-text mb-6">
            Are you sure you want to receive this order? This will ADD the requested quantities directly into your active inventory stock and clear them from this list.
          </p>
          <div className="flex gap-3">
             <button onClick={() => setShowConfirmModal(false)} className="flex-1 btn-secondary py-3 text-[10px] font-black uppercase tracking-widest">Cancel</button>
             <button onClick={confirmReceiveStockToInventory} className="flex-1 btn-primary py-3 bg-emerald-500 shadow-emerald-500/20 text-white text-[10px] font-black uppercase tracking-widest">Yes, Receive Stock</button>
          </div>
        </div>
      </Modal>

      {/* ── Document View For PDF/Print ─────────────────────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{__html: `
        @page {
          margin: 20mm 18mm;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #supplier-doc-print-area, #supplier-doc-print-area * {
            visibility: visible !important;
          }
          #supplier-doc-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
          #supplier-doc-inner {
            padding: 0 !important;
          }
        }
      `}} />
      <div id="supplier-doc-print-area" className="bg-white text-black max-w-[794px] w-[794px] flex flex-col fixed top-[-9999px] left-[-9999px] z-[-1] min-h-[1123px]">
        {/* Inner padding wrapper — keeps margins for share/canvas capture */}
        <div id="supplier-doc-inner" className="flex flex-col flex-1 px-14 pt-12 pb-10">

          {/* ── Professional Header ── */}
          <div className="flex items-start justify-between pb-6 mb-8 border-b-4 border-black">
            {/* Left: Company branding */}
            <div className="flex items-center gap-4">
              {localStorage.getItem('companyLogo') && (
                <img src={localStorage.getItem('companyLogo') || ''} alt="Logo" className="h-16 w-16 object-contain rounded-lg" />
              )}
              <div>
                <div className="text-2xl font-black tracking-tight leading-tight">{localStorage.getItem('companyName') || 'MsikaPOS'}</div>
                {localStorage.getItem('companyAddress') && (
                  <div className="text-xs mt-0.5 opacity-60 whitespace-pre-wrap leading-relaxed">{localStorage.getItem('companyAddress')}</div>
                )}
                {localStorage.getItem('companyPhone') && (
                  <div className="text-xs opacity-60">{localStorage.getItem('companyPhone')}</div>
                )}
              </div>
            </div>

            {/* Right: Document title & meta */}
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] opacity-40 mb-1">Document</div>
              <h1 className="text-3xl font-black uppercase tracking-tight leading-none mb-3">Purchase Order</h1>
              <div className="inline-flex flex-col gap-1 bg-black/5 rounded-lg px-4 py-2.5 text-right">
                <div className="flex gap-6 items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-50">Date</span>
                  <span className="text-xs font-bold">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex gap-6 items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-50">Ref</span>
                  <span className="text-xs font-black tracking-wider">PO-{Math.floor(Date.now() / 1000).toString().slice(-6)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Items Table ── */}
          <table className="w-full text-left border-collapse mb-10">
            <thead>
              <tr className="border-b-2 border-black text-[9px] font-black uppercase tracking-[0.15em]">
                <th className="py-3 pr-4">#</th>
                <th className="py-3 pr-4">Product Name</th>
                <th className="py-3 px-4 text-center w-28">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price (MK)</th>
                <th className="py-3 pl-4 text-right">Line Total (MK)</th>
              </tr>
            </thead>
            <tbody>
              {workingList.map((item, idx) => (
                <tr key={item.productId} className={idx % 2 === 0 ? 'bg-black/[0.025]' : 'bg-white'}>
                  <td className="py-3 pr-4 text-xs opacity-40 font-bold">{String(idx + 1).padStart(2, '0')}</td>
                  <td className="py-3 pr-4 font-bold text-sm">{item.productName}</td>
                  <td className="py-3 px-4 text-center font-black text-sm">{item.orderQty}</td>
                  <td className="py-3 px-4 text-right text-sm">{item.unitCost.toLocaleString()}</td>
                  <td className="py-3 pl-4 text-right font-black text-sm">{item.lineTotal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Grand Total ── */}
          <div className="flex justify-end border-t-2 border-black pt-5">
            <div className="text-right">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50 mb-1">Estimated Grand Total</div>
              <div className="text-4xl font-black tracking-tighter">MK {orderTotal.toLocaleString()}</div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="mt-auto pt-10">
            <AppFooter />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;
