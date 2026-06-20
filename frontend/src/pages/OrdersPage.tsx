import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import { 
  Printer, 
  MessageSquare,
  CheckCircle,
  PackageOpen,
  X
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

  // Store user-edited quantities. Key is productId, Value is edited orderQty.
  const [overrideQuantities, setOverrideQuantities] = useState<Record<number, number>>({});
  
  // Excluded items that the user decided to manually remove from this session
  const [excludedProducts, setExcludedProducts] = useState<Set<number>>(new Set());

  // Print Preview state
  const [showPrintView, setShowPrintView] = useState(false);

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

  const receiveStockToInventory = async () => {
    if (workingList.length === 0) return;
    
    if(!confirm('Are you sure you want to receive this order? This will ADD the requested quantities directly into your active inventory stock and clear them from this list.')) {
      return;
    }

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
      toast.success('Inventory stock updated! Items removed from restocking list.', { icon: '📦' });
      
      // Clear manual overrides/exclusions for these items since they are processed
      setOverrideQuantities({});
      setExcludedProducts(new Set());
    } catch (err) {
      toast.error('Failed to update inventory.');
    }
  };


  return (
    <div className="flex flex-col w-full px-0 relative pb-20">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="glass-panel border-b border-border/50 px-4 md:px-12 py-3 sticky top-0 z-30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">Live Restocking List</h1>
            <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase">Auto-prepared based on current stock levels</p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
             <button 
               onClick={() => setShowPrintView(true)}
               disabled={workingList.length === 0}
               className="btn-secondary h-10 !px-4 uppercase text-[10px] font-black tracking-widest flex items-center gap-2 disabled:opacity-50"
             >
               <Printer className="w-4 h-4" /> <span className="hidden md:inline">Print Document</span>
             </button>
             <button 
               onClick={() => {
                 const text = `*RESTOCKING LIST*\nDate: ${new Date().toLocaleDateString()}\n\n` + 
                   workingList.map(i => `- ${i.productName} (Qty: ${i.orderQty})`).join('\n') + 
                   `\n\n*Total Estimated Cost:* MK${orderTotal.toLocaleString()}`;
                 window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
               }}
               disabled={workingList.length === 0}
               className="btn-primary h-10 !px-4 uppercase text-[10px] font-black tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20 bg-emerald-500 hover:bg-emerald-600 border-emerald-500/20 disabled:opacity-50"
             >
               <MessageSquare className="w-4 h-4" /> <span className="hidden md:inline">WhatsApp Share</span>
             </button>
             <button 
               onClick={receiveStockToInventory}
               disabled={workingList.length === 0}
               className="btn-primary h-10 !px-4 uppercase text-[10px] font-black tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
             >
               <CheckCircle className="w-4 h-4" /> <span className="hidden md:inline">Receive Stock</span>
             </button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-12 py-6">
          {/* Table Container */}
          <div className="glass-panel border border-border/50 rounded-3xl overflow-hidden p-1 relative">
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse min-w-[600px]">
                 <thead>
                   <tr className="border-b border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-surface-bg/50">
                     <th className="p-4">Product Name</th>
                     <th className="p-4 text-center">Current Stock</th>
                     <th className="p-4 text-center">Reorder Lvl</th>
                     <th className="p-4 text-center">Suggested</th>
                     <th className="p-4 text-center w-32">Order Qty</th>
                     <th className="p-4 text-right w-32">Unit Cost</th>
                     <th className="p-4 text-right">Line Total (MK)</th>
                     <th className="p-4 w-12 text-center"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border/20">
                   {workingList.map(item => (
                     <tr key={item.productId} className="hover:bg-muted/10 transition-colors">
                       <td className="p-4 font-bold text-sm">
                         {item.productName}
                       </td>
                       <td className="p-4 text-center text-xs font-black text-destructive">
                         {item.currentStock}
                       </td>
                       <td className="p-4 text-center text-xs font-black text-amber-500">
                         {item.reorderLevel}
                       </td>
                       <td className="p-4 text-center text-xs font-black text-blue-500">
                         {item.suggestedQty}
                       </td>
                       <td className="p-4 text-center">
                         <input 
                           type="number" 
                           className="input-field w-20 text-center py-1.5 text-xs font-black"
                           value={item.orderQty}
                           onChange={(e) => handleUpdateOrderItem(item.productId, Number(e.target.value))}
                           min="1"
                         />
                       </td>
                       <td className="p-4 text-right text-xs font-black text-muted-foreground">
                         {item.unitCost.toLocaleString()}
                       </td>
                       <td className="p-4 text-right text-sm font-black text-primary">
                         {item.lineTotal.toLocaleString()}
                       </td>
                       <td className="p-4 text-center">
                         <button 
                           onClick={() => handleRemoveOrderItem(item.productId)}
                           className="p-2 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                           title="Exclude from list"
                         >
                           <X className="w-4 h-4" />
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

      {/* ── Document View Overlay (Print/Share) ─────────────────────────────────────────────────────────── */}
      {showPrintView && (
         <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 md:p-8 border-b border-border/50 bg-surface-bg/50 print:hidden">
               <h2 className="text-xl font-black tracking-tighter">Restocking Document</h2>
               <div className="flex gap-3">
                 <button 
                   onClick={() => window.print()}
                   className="btn-secondary !px-4 py-3 uppercase text-[10px] font-black tracking-widest flex items-center gap-2"
                 >
                   <Printer className="w-4 h-4" /> Print PDF
                 </button>
                 <button onClick={() => setShowPrintView(false)} className="btn-secondary !px-4 py-3 uppercase text-[10px] font-black tracking-widest ml-4">
                   Close
                 </button>
               </div>
            </div>
            
            {/* Document sheet */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-muted/20">
               <style dangerouslySetInnerHTML={{__html: `
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
                 }
               `}} />
               <div id="supplier-doc-print-area" className="bg-white text-black p-8 md:p-12 max-w-4xl w-full shadow-2xl print:shadow-none print:w-full print:p-0">
                  <div className="flex justify-between items-start mb-12 border-b-2 border-black/10 pb-8">
                     <div>
                       <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Restocking List</h1>
                       <div className="text-sm font-bold opacity-60">Date: {new Date().toLocaleDateString()}</div>
                     </div>
                  </div>

                  <table className="w-full text-left border-collapse mb-12">
                    <thead>
                      <tr className="border-b-2 border-black/80 text-[10px] font-black uppercase tracking-widest">
                        <th className="py-4 pr-4">Product Name</th>
                        <th className="py-4 px-4 text-center w-32">Quantity</th>
                        <th className="py-4 px-4 text-right">Unit Price (MK)</th>
                        <th className="py-4 pl-4 text-right">Line Total (MK)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                      {workingList.map(item => (
                        <tr key={item.productId}>
                          <td className="py-4 pr-4 font-bold">{item.productName}</td>
                          <td className="py-4 px-4 text-center font-black">{item.orderQty}</td>
                          <td className="py-4 px-4 text-right text-sm">{item.unitCost.toLocaleString()}</td>
                          <td className="py-4 pl-4 text-right font-black">{item.lineTotal.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end border-t-2 border-black/80 pt-6">
                     <div className="text-right">
                       <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Estimated Grand Total</div>
                       <div className="text-3xl font-black tracking-tighter">MK{orderTotal.toLocaleString()}</div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default OrdersPage;
