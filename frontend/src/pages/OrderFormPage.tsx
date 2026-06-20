import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import type { LocalPurchaseOrder, LocalPurchaseOrderItem } from '../db/posDB';
import { 
  ArrowLeft,
  Save,
  Printer,
  MessageSquare,
  X,
  CheckCircle,
  ShoppingCart,
  Truck
} from 'lucide-react';
import toast from 'react-hot-toast';

const generateId = () => Math.random().toString(36).substring(2, 9).toUpperCase();

const OrderFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isSmart = searchParams.get('type') === 'smart';
  
  // Database Queries
  const products = useLiveQuery(() => db.products.filter(p => !p.deleted).toArray());

  // Form State
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<LocalPurchaseOrder['status']>('Draft');
  const [items, setItems] = useState<LocalPurchaseOrderItem[]>([]);
  const [createdAt, setCreatedAt] = useState('');
  
  // Selection/Filters
  const [selectedProductToAdd, setSelectedProductToAdd] = useState('');

  // Print Preview state
  const [showPrintView, setShowPrintView] = useState(false);

  // Load existing order if in Edit Mode
  useEffect(() => {
    if (!id) return;
    
    const loadOrder = async () => {
      const order = await db.purchaseOrders.get(id);
      if (order) {
        setNotes(order.notes || '');
        setStatus(order.status);
        setItems(order.items);
        setCreatedAt(order.createdAt);
      } else {
        toast.error('Order not found');
        navigate('/staff/orders');
      }
    };
    loadOrder();
  }, [id, navigate]);

  // Generate Smart Order on load in new mode if type=smart
  useEffect(() => {
    if (id || !products) return;
    if (isSmart) {
      generateSmartOrderItems();
    }
  }, [id, isSmart, products]);

  const generateSmartOrderItems = async () => {
    if (!products) return;

    // Fetch sales history to filter slow-moving items
    const sales = await db.salesQueue.toArray();
    const productSalesMap: Record<number, { lastSaleDate: Date; totalSold: number }> = {};
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

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const lowStockItems = products.filter(p => {
      if (p.isService) return false;

      // Rule: ONLY include if Current Stock <= Reorder Level OR Current Stock == 0
      const reorderLimit = p.reorderLevel !== undefined ? p.reorderLevel : 2;
      const isLowStock = p.quantity <= reorderLimit || p.quantity === 0;
      return isLowStock;
    });

    const orderItems: LocalPurchaseOrderItem[] = lowStockItems.map(p => {
      const reorderLimit = p.reorderLevel !== undefined ? p.reorderLevel : 2;
      const baseQty = Math.max(0, reorderLimit - p.quantity);
      
      const salesInfo = productSalesMap[p.id];
      const salesLast30Days = salesInfo && salesInfo.lastSaleDate >= thirtyDaysAgo ? salesInfo.totalSold : 0;
      
      // Smart Qty: Boost quantity based on recent sales. Fast moving gets more, slow gets base.
      let finalQty = Math.max(baseQty, salesLast30Days);
      if (finalQty <= 0) finalQty = 1;

      return {
        productId: p.id,
        productName: p.name,
        currentStock: p.quantity,
        reorderLevel: reorderLimit,
        orderQty: finalQty,
        unitCost: p.costPrice || 0,
        lineTotal: finalQty * (p.costPrice || 0)
      };
    });

    setItems(orderItems);
    if (orderItems.length === 0) {
      toast.error('No items currently need auto-restocking based on your filter.');
    } else {
      toast.success(`Generated suggestions for ${orderItems.length} low-stock products.`);
    }
  };

  const handleUpdateOrderItem = (productId: number, field: keyof LocalPurchaseOrderItem, value: number) => {
    setItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const newItem = { ...item, [field]: value };
        if (field === 'orderQty' || field === 'unitCost') {
          newItem.lineTotal = newItem.orderQty * newItem.unitCost;
        }
        return newItem;
      }
      return item;
    }));
  };

  const handleRemoveOrderItem = (productId: number) => {
    setItems(prev => prev.filter(item => item.productId !== productId));
  };

  const handleAddItemToOrder = () => {
    if (!selectedProductToAdd || !products) return;
    
    const prodId = Number(selectedProductToAdd);
    const product = products.find(p => p.id === prodId);
    if (!product) return;

    const reorderLimit = product.reorderLevel !== undefined ? product.reorderLevel : 2;
    const suggestedQty = Math.max(0, reorderLimit - product.quantity);
    const finalQty = suggestedQty > 0 ? suggestedQty : 1;

    const newItem: LocalPurchaseOrderItem = {
      productId: product.id,
      productName: product.name,
      currentStock: product.quantity,
      reorderLevel: reorderLimit,
      orderQty: finalQty,
      unitCost: product.costPrice || 0,
      lineTotal: finalQty * (product.costPrice || 0)
    };

    setItems(prev => [...prev, newItem]);
    setSelectedProductToAdd('');
    toast.success(`${product.name} added`);
  };

  const orderTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [items]);

  const handleSaveOrder = async (targetStatus?: LocalPurchaseOrder['status']) => {
    if (items.length === 0) {
      toast.error('Order must have at least one item');
      return;
    }

    const finalStatus = targetStatus || status;

    const fullOrder: LocalPurchaseOrder = {
      id: id || generateId(),
      status: finalStatus,
      items,
      total: orderTotal,
      notes,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: 0
    };

    try {
      if (finalStatus === 'Received' && status !== 'Received') {
        // Handle receiving stock into inventory
        await receiveStockToInventory(fullOrder);
      }
      
      await db.purchaseOrders.put(fullOrder);
      toast.success(`Order saved as ${finalStatus}`);
      navigate('/staff/orders');
    } catch {
      toast.error('Failed to save order');
    }
  };

  const receiveStockToInventory = async (order: LocalPurchaseOrder) => {
    const promises = order.items.map(async (item) => {
      const product = await db.products.get(item.productId);
      if (product) {
        await db.products.update(item.productId, {
          quantity: Number(product.quantity) + Number(item.orderQty),
          costPrice: Number(item.unitCost),
          updatedAt: new Date().toISOString()
        });
      }
    });
    await Promise.all(promises);
    toast.success('Inventory stock updated from order', { icon: '📦' });
  };


  return (
    <div className="flex flex-col w-full px-4 md:px-12 py-6 relative pb-20">
      
      {/* ── Breadcrumbs & Back ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate('/staff/orders')}
          className="w-10 h-10 rounded-xl bg-card border border-border/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors btn-press"
          title="Back to Orders"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Purchase Ordering</span>
          <h1 className="text-xl font-black tracking-tight">{id ? `Edit Purchase Order #${id.slice(0,8)}` : 'Create New Purchase Order'}</h1>
        </div>
      </div>

      {/* ── Main Layout Grid ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Order Meta details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 border border-border/50 rounded-3xl space-y-4">
             <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border/20 pb-2 flex items-center gap-2"><Truck className="w-4 h-4 text-primary" /> Order Metadata</h2>
             

             <div className="space-y-1">
               <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="order-notes-input">Notes</label>
               <textarea 
                 id="order-notes-input" 
                 className="input-field w-full py-3 px-4 font-black min-h-[100px] resize-none" 
                 placeholder="Enter notes for this purchase request..."
                 value={notes}
                 onChange={e => setNotes(e.target.value)}
                 disabled={status === 'Received'}
               />
             </div>

             <div className="space-y-1">
               <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase">Status</label>
               <div className="flex">
                  <span className={`inline-block px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase ${
                    status === 'Draft' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                    status === 'Sent' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                    status === 'Received' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                    'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                    {status}
                  </span>
               </div>
             </div>
          </div>

          {!id && (
             <div className="glass-panel p-6 border border-border/50 rounded-3xl space-y-4">
                 <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border/20 pb-2 mb-4">Smart Generation</h2>
                <button 
                  onClick={generateSmartOrderItems}
                  className="w-full btn-secondary py-3 text-[10px] font-black tracking-widest uppercase flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border-primary/10"
                >
                  <ShoppingCart className="w-4 h-4" /> Recalculate Suggested
                </button>
             </div>
          )}
        </div>

        {/* Right Side: Items List */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Manual Add Item Form */}
          {status !== 'Received' && status !== 'Cancelled' && (
             <div className="glass-panel p-6 border border-border/50 rounded-3xl flex flex-col sm:flex-row gap-3 items-end">
               <div className="flex-1 space-y-1 w-full">
                 <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="form-prod-select">Add Product Manually</label>
                 <select 
                   id="form-prod-select"
                   className="input-field w-full py-2 px-3 text-xs font-bold"
                   value={selectedProductToAdd}
                   onChange={e => setSelectedProductToAdd(e.target.value)}
                 >
                   <option value="">-- Choose Product --</option>
                   {products?.filter(p => !p.isService && !items.some(i => i.productId === p.id)).map(p => (
                     <option key={p.id} value={p.id}>{p.name} (Stock: {p.quantity})</option>
                   ))}
                 </select>
               </div>
               <button 
                 type="button"
                 onClick={handleAddItemToOrder}
                 className="btn-secondary h-10 py-2 px-6 text-[10px] font-black tracking-widest uppercase shrink-0 w-full sm:w-auto"
               >
                 Add Item
               </button>
             </div>
          )}

          {/* Table Container */}
          <div className="glass-panel border border-border/50 rounded-3xl overflow-hidden p-1 relative">
             {status === 'Received' && (
                <div className="absolute inset-0 bg-emerald-500/5 backdrop-blur-[1px] z-10 flex items-center justify-center pointer-events-none">
                   <div className="bg-emerald-500 text-white px-8 py-3 rounded-full font-black tracking-widest uppercase shadow-2xl flex items-center gap-2">
                     <CheckCircle className="w-5 h-5" /> Stock Received & Locked
                   </div>
                </div>
             )}

             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse min-w-[600px]">
                 <thead>
                   <tr className="border-b border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-surface-bg/50">
                     <th className="p-4">Product</th>
                     <th className="p-4 text-center">In Stock</th>
                     <th className="p-4 text-center">Reorder Lvl</th>
                     <th className="p-4 text-center">Suggested</th>
                     <th className="p-4 text-center w-28">Order Qty</th>
                     <th className="p-4 text-right w-32">Unit Cost</th>
                     <th className="p-4 text-right">Total (MK)</th>
                     <th className="p-4 w-12"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border/20">
                   {items.map(item => (
                     <tr key={item.productId} className="hover:bg-muted/10 transition-colors">
                       <td className="p-4 font-bold text-sm">{item.productName}</td>
                       <td className="p-4 text-center text-xs font-black text-destructive">{item.currentStock}</td>
                       <td className="p-4 text-center text-xs font-black text-amber-500">{item.reorderLevel}</td>
                       <td className="p-4 text-center text-xs font-black text-blue-500">
                         {Math.max(0, item.reorderLevel - item.currentStock)}
                       </td>
                       <td className="p-4 text-center">
                         <input 
                           type="number" 
                           className="input-field w-20 text-center py-1.5 text-xs font-black"
                           value={item.orderQty}
                           onChange={(e) => handleUpdateOrderItem(item.productId, 'orderQty', Number(e.target.value))}
                           min="1"
                           disabled={status === 'Received'}
                         />
                       </td>
                       <td className="p-4 text-right">
                         <input 
                           type="number" 
                           className="input-field w-24 text-right py-1.5 text-xs font-black"
                           value={item.unitCost}
                           onChange={(e) => handleUpdateOrderItem(item.productId, 'unitCost', Number(e.target.value))}
                           min="0"
                           disabled={status === 'Received'}
                         />
                       </td>
                       <td className="p-4 text-right text-sm font-black text-primary">
                         {item.lineTotal.toLocaleString()}
                       </td>
                       <td className="p-4 text-center">
                         <button 
                           onClick={() => handleRemoveOrderItem(item.productId)}
                           className="p-2 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors disabled:opacity-50"
                           title="Remove item"
                           disabled={status === 'Received'}
                         >
                           <X className="w-4 h-4" />
                         </button>
                       </td>
                     </tr>
                   ))}
                   {items.length === 0 && (
                     <tr><td colSpan={8} className="p-8 text-center text-muted-foreground font-bold">No items in this order. Add products to get started!</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-border/50 pt-6">
             <div className="text-xl font-black">
               <span className="text-muted-foreground text-sm uppercase tracking-widest block mb-1">Estimated Grand Total</span>
               MK{orderTotal.toLocaleString()}
             </div>
             
             <div className="flex flex-wrap gap-3 w-full md:w-auto">
               {status !== 'Received' && status !== 'Cancelled' && (
                  <>
                    <button onClick={() => handleSaveOrder('Draft')} className="flex-1 md:flex-none btn-secondary !py-4 !px-6 text-[10px] font-black tracking-widest uppercase flex items-center justify-center gap-2">
                      <Save className="w-4 h-4" /> Save Draft
                    </button>
                    <button onClick={() => handleSaveOrder('Sent')} className="flex-1 md:flex-none btn-primary !bg-blue-500 hover:!bg-blue-600 !py-4 !px-6 text-[10px] font-black tracking-widest uppercase shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                      Mark Sent
                    </button>
                  </>
               )}
               {status === 'Sent' && (
                  <button onClick={() => {
                      if(confirm('Are you sure you want to receive this order? This will ADD the requested quantities directly into your active inventory stock.')) {
                        handleSaveOrder('Received');
                      }
                    }} className="flex-1 md:flex-none btn-primary !bg-emerald-500 hover:!bg-emerald-600 !py-4 !px-6 text-[10px] font-black tracking-widest uppercase shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Receive Stock
                  </button>
               )}
               {status !== 'Received' && status !== 'Cancelled' && id && (
                  <button onClick={() => handleSaveOrder('Cancelled')} className="flex-1 md:flex-none btn-secondary !bg-destructive/10 !text-destructive hover:!bg-destructive/20 border-destructive/20 !py-4 !px-6 text-[10px] font-black tracking-widest uppercase flex items-center justify-center gap-2">
                    Cancel Order
                  </button>
               )}
               
               {/* Document Operations */}
               {id && (
                  <>
                    <button 
                      onClick={() => setShowPrintView(true)}
                      className="flex-1 md:flex-none btn-secondary !py-4 !px-6 text-[10px] font-black tracking-widest uppercase flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" /> Document
                    </button>
                  </>
               )}
             </div>
          </div>

        </div>
      </div>

      {/* ── Document View Overlay (Print/Share) ─────────────────────────────────────────────────────────── */}
      {showPrintView && (
         <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 md:p-8 border-b border-border/50 bg-surface-bg/50 print:hidden">
               <h2 className="text-xl font-black tracking-tighter">Purchase Order Document</h2>
               <div className="flex gap-3">
                 <button 
                   onClick={() => window.print()}
                   className="btn-secondary !px-4 py-3 uppercase text-[10px] font-black tracking-widest flex items-center gap-2"
                 >
                   <Printer className="w-4 h-4" /> Print PDF
                 </button>
                 <button 
                   onClick={() => {
                     const text = `*PURCHASE ORDER REQUEST*\nOrder No: ${id?.slice(0,8).toUpperCase()}\nDate: ${new Date(createdAt).toLocaleDateString()}\n\n` + 
                       items.map(i => `- ${i.productName} (Qty: ${i.orderQty})`).join('\n') + 
                       `\n\n*Total Estimated Cost:* MK${orderTotal.toLocaleString()}`;
                     window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                   }}
                   className="btn-primary !px-4 py-3 uppercase text-[10px] font-black tracking-widest flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                 >
                   <MessageSquare className="w-4 h-4" /> WhatsApp
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
                       <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Purchase Order</h1>
                       <div className="text-sm font-bold opacity-60">Order No: {id?.slice(0,8).toUpperCase()}</div>
                       <div className="text-sm font-bold opacity-60">Date: {new Date(createdAt).toLocaleDateString()}</div>
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
                      {items.map(item => (
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
                       <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Grand Total</div>
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

export default OrderFormPage;
