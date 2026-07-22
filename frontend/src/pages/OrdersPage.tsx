import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import { generateUUID } from '../utils/cryptoUtils';
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
        id: generateUUID(),
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

    // html2canvas cannot capture off-screen elements — temporarily bring it on-screen
    const originalCss = printElement.style.cssText;
    printElement.style.cssText = 'position:fixed;top:0;left:0;z-index:-1;pointer-events:none;opacity:1;';
    // Let browser repaint so element is fully laid out
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
      const canvas = await html2canvas(printElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false,
        foreignObjectRendering: false,
      });
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to generate image');

      const poRef = `PO-${Date.now().toString().slice(-6)}`;
      const file = new File([blob], `Purchase-Order-${poRef}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Purchase Order - ${poRef}`,
            text: 'Please find the attached purchase order.',
          });
          toast.success('Shared successfully', { id: toastId });
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError' || shareErr?.message?.includes('Abort')) {
            toast.dismiss(toastId);
          } else if (shareErr?.name === 'NotAllowedError' || shareErr?.name === 'SecurityError') {
            toast.success('File sharing unsupported, downloading instead...', { id: toastId });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Purchase-Order-${poRef}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          } else {
            throw shareErr;
          }
        }
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Purchase-Order-${poRef}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Downloaded successfully', { id: toastId });
      }
    } catch (e: any) {
      console.error('Share error:', e);
      toast.error('Failed to share: ' + (e?.message || 'Unknown error'), { id: toastId });
    } finally {
      // Always restore element position
      printElement.style.cssText = originalCss;
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

      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Receive Stock" maxWidth="max-w-md">
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
          size: A4;
          margin: 18mm 16mm;
        }
        @media print {
          body * { visibility: hidden !important; }
          #supplier-doc-print-area, #supplier-doc-print-area * { visibility: visible !important; }
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
            /* Keep horizontal padding so content stays off the @page margin edge */
            padding-left: 0 !important;
            padding-right: 0 !important;
            padding-top: 0 !important;
          }
          /* Repeat footer on every print page */
          #supplier-doc-footer {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
          }
          /* Ensure table header repeats on new pages */
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
        }
      `}} />
      <div
        id="supplier-doc-print-area"
        style={{ position: 'fixed', top: '-9999px', left: '-9999px', zIndex: -1, width: '794px', minHeight: '1123px', background: 'white', color: 'black' }}
      >
        {/* Inner content — px-14 gives visible margin for share/WhatsApp image */}
        <div id="supplier-doc-inner" style={{ padding: '48px 56px 40px', display: 'flex', flexDirection: 'column', minHeight: '1123px' }}>

          {/* ── Professional Header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '24px', marginBottom: '28px', borderBottom: '4px solid black' }}>

            {/* Left: Company branding */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {localStorage.getItem('companyLogo') && (
                <img src={localStorage.getItem('companyLogo') || ''} alt="Logo"
                  style={{ height: '64px', width: '64px', objectFit: 'contain', borderRadius: '8px' }} />
              )}
              <div>
                <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                  {localStorage.getItem('companyName') || 'MsikaPOS'}
                </div>
                {localStorage.getItem('companyAddress') && (
                  <div style={{ fontSize: '11px', opacity: 0.55, marginTop: '2px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {localStorage.getItem('companyAddress')}
                  </div>
                )}
                {localStorage.getItem('companyPhone') && (
                  <div style={{ fontSize: '11px', opacity: 0.55 }}>{localStorage.getItem('companyPhone')}</div>
                )}
              </div>
            </div>

            {/* Right: Document title & meta */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.25em', opacity: 0.35, marginBottom: '4px' }}>Purchase Document</div>
              <h1 style={{ fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '12px', margin: '0 0 12px 0' }}>Purchase Order</h1>
              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', padding: '10px 16px', textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.45 }}>Date</span>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>
                    {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.45 }}>Ref</span>
                  <span style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '0.08em' }}>PO-{Date.now().toString().slice(-6)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Items Table ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid black', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                <th style={{ padding: '10px 12px 10px 0', textAlign: 'left' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Product Name</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '80px' }}>Qty</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Unit Price (MK)</th>
                <th style={{ padding: '10px 0 10px 12px', textAlign: 'right' }}>Line Total (MK)</th>
              </tr>
            </thead>
            <tbody>
              {workingList.map((item, idx) => (
                <tr key={item.productId} style={{ background: idx % 2 === 0 ? 'rgba(0,0,0,0.025)' : 'white', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                  <td style={{ padding: '11px 12px 11px 0', fontSize: '11px', opacity: 0.35, fontWeight: 700 }}>{String(idx + 1).padStart(2, '0')}</td>
                  <td style={{ padding: '11px 12px', fontWeight: 700, fontSize: '13px' }}>{item.productName}</td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', fontWeight: 900, fontSize: '13px' }}>{item.orderQty}</td>
                  <td style={{ padding: '11px 12px', textAlign: 'right', fontSize: '13px' }}>{item.unitCost.toLocaleString()}</td>
                  <td style={{ padding: '11px 0 11px 12px', textAlign: 'right', fontWeight: 900, fontSize: '13px' }}>{item.lineTotal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Grand Total ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid black', paddingTop: '18px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.45, marginBottom: '4px' }}>Estimated Grand Total</div>
              <div style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-0.04em' }}>MK {orderTotal.toLocaleString()}</div>
            </div>
          </div>

          {/* ── Footer (inline — also becomes fixed in @media print) ── */}
          <div id="supplier-doc-footer" style={{ marginTop: 'auto', paddingTop: '36px' }}>
            <AppFooter />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;
