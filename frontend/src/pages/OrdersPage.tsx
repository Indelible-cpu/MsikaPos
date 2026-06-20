import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import type { LocalSupplier, LocalPurchaseOrder } from '../db/posDB';
import { 
  ShoppingCart, 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Printer, 
  MessageSquare,
  FileText,
  PackageOpen,
  Truck
} from 'lucide-react';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const generateId = () => Math.random().toString(36).substring(2, 9).toUpperCase();

const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders');
  
  // Suppliers State
  const suppliers = useLiveQuery(() => db.suppliers.toArray());
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<LocalSupplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', address: '' });

  // Orders State
  const orders = useLiveQuery(() => db.purchaseOrders.orderBy('createdAt').reverse().toArray());
  const [searchTerm, setSearchTerm] = useState('');
  
  // Printing/Sharing View State
  const [viewDocumentOrder, setViewDocumentOrder] = useState<LocalPurchaseOrder | null>(null);

  const orderStats = useMemo(() => {
    if (!orders) return { productsOrdered: 0, unitsOrdered: 0, totalCost: 0 };
    return orders.reduce((acc, order) => {
      // Exclude cancelled from stats
      if (order.status !== 'Cancelled') {
        acc.totalCost += order.total;
        acc.productsOrdered += order.items.length;
        acc.unitsOrdered += order.items.reduce((sum, item) => sum + item.orderQty, 0);
      }
      return acc;
    }, { productsOrdered: 0, unitsOrdered: 0, totalCost: 0 });
  }, [orders]);

  // --- Supplier Methods ---
  const openSupplierModal = (supplier?: LocalSupplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setSupplierForm({ name: supplier.name, phone: supplier.phone || '', email: supplier.email || '', address: supplier.address || '' });
    } else {
      setEditingSupplier(null);
      setSupplierForm({ name: '', phone: '', email: '', address: '' });
    }
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;

    try {
      if (editingSupplier) {
        await db.suppliers.update(editingSupplier.id, { ...supplierForm });
        toast.success('Supplier updated');
      } else {
        const newSupplier: LocalSupplier = {
          id: generateId(),
          ...supplierForm,
          createdAt: new Date().toISOString(),
          synced: 0
        };
        await db.suppliers.add(newSupplier);
        toast.success('Supplier added');
      }
      setIsSupplierModalOpen(false);
    } catch {
      toast.error('Failed to save supplier');
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (confirm('Are you sure you want to delete this supplier?')) {
      await db.suppliers.delete(id);
      toast.success('Supplier deleted');
    }
  };

  // --- Order Methods ---
  const handleDeleteOrder = async (id: string) => {
    if (confirm('Are you sure you want to delete this order?')) {
      await db.purchaseOrders.delete(id);
      toast.success('Order deleted');
    }
  };


  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => 
      o.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);


  return (
    <div className="flex flex-col w-full px-0 relative pb-20">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="glass-panel border-b border-border/50 px-4 md:px-12 py-3 sticky top-0 z-30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex bg-surface-bg p-1 rounded-xl border border-surface-border">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-6 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${
                activeTab === 'orders' ? 'bg-primary text-primary-foreground shadow-md' : 'text-surface-text/60 hover:text-primary'
              }`}
            >
              Purchase Orders
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-6 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${
                activeTab === 'suppliers' ? 'bg-primary text-primary-foreground shadow-md' : 'text-surface-text/60 hover:text-primary'
              }`}
            >
              Suppliers
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input 
                type="text" 
                placeholder={activeTab === 'orders' ? "Search orders..." : "Search suppliers..."}
                className="input-field w-full pl-10 text-xs h-10 font-bold"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {activeTab === 'orders' && (
              <div className="flex items-center gap-3 shrink-0">
                <button 
                  onClick={() => navigate('/staff/orders/new')}
                  className="btn-secondary h-10 !px-4 uppercase text-[10px] font-black tracking-widest flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> <span className="hidden md:inline">New Order</span>
                </button>
                <button 
                  onClick={() => navigate('/staff/orders/new?type=smart')}
                  className="btn-primary h-10 !px-4 uppercase text-[10px] font-black tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20"
                >
                  <ShoppingCart className="w-4 h-4" /> <span className="hidden md:inline">Smart Auto-Order</span>
                </button>
              </div>
            )}
            {activeTab === 'suppliers' && (
               <button 
                 onClick={() => openSupplierModal()}
                 className="btn-primary h-10 !px-4 uppercase text-[10px] font-black tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20 shrink-0"
               >
                 <Plus className="w-4 h-4" /> <span className="hidden md:inline">Add Supplier</span>
               </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Dashboard Summary (Orders Tab) ─────────────────────────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="px-4 md:px-12 py-6 stagger-children">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-6 glass-panel border border-border/50 rounded-2xl flex items-center justify-between">
              <div>
                <div className="card-label">Total Unique Products</div>
                <div className="text-2xl font-black">{orderStats.productsOrdered}</div>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <PackageOpen className="w-6 h-6" />
              </div>
            </div>
            <div className="p-6 glass-panel border border-border/50 rounded-2xl flex items-center justify-between">
              <div>
                <div className="card-label">Total Units Ordered</div>
                <div className="text-2xl font-black">{orderStats.unitsOrdered}</div>
              </div>
              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500">
                <ShoppingCart className="w-6 h-6" />
              </div>
            </div>
            <div className="p-6 glass-panel border border-border/50 rounded-2xl flex items-center justify-between">
              <div>
                <div className="card-label">Est. Purchase Cost</div>
                <div className="text-2xl font-black text-rose-500">MK{orderStats.totalCost.toLocaleString()}</div>
              </div>
              <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500">
                <FileText className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="glass-panel border border-border/50 rounded-2xl overflow-hidden">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="border-b border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-surface-bg/50">
                   <th className="p-4">Order ID / Date</th>
                   <th className="p-4">Supplier</th>
                   <th className="p-4 text-center">Items</th>
                   <th className="p-4 text-right">Total Cost</th>
                   <th className="p-4 text-center">Status</th>
                   <th className="p-4 text-center">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-border/20">
                 {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground font-bold">No orders found. Generate a smart order to get started!</td>
                    </tr>
                 ) : filteredOrders.map(order => (
                   <tr key={order.id} className="hover:bg-muted/5 transition-colors">
                     <td className="p-4">
                       <div className="font-bold text-sm">#{order.id.slice(0,8).toUpperCase()}</div>
                       <div className="text-[10px] text-muted-foreground font-bold uppercase">{new Date(order.createdAt).toLocaleDateString()}</div>
                     </td>
                     <td className="p-4 font-bold text-sm">{order.supplierName || 'Unknown Supplier'}</td>
                     <td className="p-4 text-center font-black">{order.items.length}</td>
                     <td className="p-4 text-right font-black text-primary">MK{order.total.toLocaleString()}</td>
                     <td className="p-4 text-center">
                       <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${
                         order.status === 'Draft' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                         order.status === 'Sent' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                         order.status === 'Received' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                         'bg-red-500/10 text-red-500 border border-red-500/20'
                       }`}>
                         {order.status}
                       </span>
                     </td>
                     <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                           {order.status !== 'Cancelled' && (
                             <button onClick={() => setViewDocumentOrder(order)} className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors" title="Print/Share Document">
                               <Printer className="w-4 h-4" />
                             </button>
                           )}
                           <button onClick={() => navigate(`/staff/orders/${order.id}`)} className="p-2 text-surface-text/40 hover:text-primary hover:bg-primary/10 rounded-xl transition-colors" title="View/Edit Order">
                             <Edit className="w-4 h-4" />
                           </button>
                           <button onClick={() => handleDeleteOrder(order.id)} className="p-2 text-surface-text/40 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors" title="Delete Order">
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </div>
      )}

      {/* ── Suppliers Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'suppliers' && (
        <div className="px-4 md:px-12 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
             {suppliers?.map(supplier => (
                <div key={supplier.id} className="glass-panel p-6 border border-border/50 rounded-3xl hover:border-primary/30 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openSupplierModal(supplier)} className="p-2 hover:bg-primary/10 hover:text-primary rounded-xl transition-colors"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteSupplier(supplier.id)} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <h3 className="font-black text-lg mb-1">{supplier.name}</h3>
                  {supplier.phone && <div className="text-xs text-muted-foreground font-bold flex items-center gap-2 mb-1"><Truck className="w-3 h-3" /> {supplier.phone}</div>}
                  {supplier.email && <div className="text-xs text-muted-foreground font-bold flex items-center gap-2">{supplier.email}</div>}
                </div>
             ))}
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      
      {/* Supplier Modal */}
      <Modal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} title={editingSupplier ? "Edit Supplier" : "New Supplier"}>
        <form onSubmit={handleSaveSupplier} className="p-8 space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="sup-name">Supplier Name</label>
            <input required id="sup-name" type="text" className="input-field w-full py-3 px-4 font-black" value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="sup-phone">Phone Number</label>
            <input id="sup-phone" type="text" className="input-field w-full py-3 px-4 font-black" value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="sup-email">Email Address</label>
            <input id="sup-email" type="email" className="input-field w-full py-3 px-4 font-black" value={supplierForm.email} onChange={e => setSupplierForm({...supplierForm, email: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="sup-address">Address</label>
            <input id="sup-address" type="text" className="input-field w-full py-3 px-4 font-black" value={supplierForm.address} onChange={e => setSupplierForm({...supplierForm, address: e.target.value})} />
          </div>
          <div className="pt-4 flex gap-4">
            <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="flex-1 btn-secondary !py-4 text-[10px] font-black tracking-widest uppercase">Cancel</button>
            <button type="submit" className="flex-1 btn-primary !py-4 text-[10px] font-black tracking-widest uppercase shadow-lg shadow-primary/20">Save Supplier</button>
          </div>
        </form>
      </Modal>



      {/* Supplier Document Overlay (Print/Share View) */}
      {viewDocumentOrder && (
         <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 md:p-8 border-b border-border/50 bg-surface-bg/50 print:hidden">
               <h2 className="text-xl font-black tracking-tighter">Purchase Order Document</h2>
               <div className="flex gap-3">
                 <button 
                   onClick={() => {
                     window.print();
                   }}
                   className="btn-secondary !px-4 py-3 uppercase text-[10px] font-black tracking-widest flex items-center gap-2"
                 >
                   <Printer className="w-4 h-4" /> Print PDF
                 </button>
                 <button 
                   onClick={() => {
                     const text = `*PURCHASE ORDER REQUEST*\nOrder No: ${viewDocumentOrder.id.slice(0,8).toUpperCase()}\nDate: ${new Date(viewDocumentOrder.createdAt).toLocaleDateString()}\n\n` + 
                       viewDocumentOrder.items.map(i => `- ${i.productName} (Qty: ${i.orderQty})`).join('\n') + 
                       `\n\n*Total Estimated Cost:* MK${viewDocumentOrder.total.toLocaleString()}`;
                     window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                   }}
                   className="btn-primary !px-4 py-3 uppercase text-[10px] font-black tracking-widest flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                 >
                   <MessageSquare className="w-4 h-4" /> WhatsApp
                 </button>
                 <button onClick={() => setViewDocumentOrder(null)} className="btn-secondary !px-4 py-3 uppercase text-[10px] font-black tracking-widest ml-4">
                   Close
                 </button>
               </div>
            </div>
            
            {/* The Document Area */}
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
                       <div className="text-sm font-bold opacity-60">Order No: {viewDocumentOrder.id.slice(0,8).toUpperCase()}</div>
                       <div className="text-sm font-bold opacity-60">Date: {new Date(viewDocumentOrder.createdAt).toLocaleDateString()}</div>
                     </div>
                     <div className="text-right">
                       <div className="font-bold text-sm uppercase tracking-widest opacity-60 mb-1">To Supplier:</div>
                       <div className="text-xl font-black">{viewDocumentOrder.supplierName || 'General Supplier'}</div>
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
                      {viewDocumentOrder.items.map(item => (
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
                       <div className="text-3xl font-black tracking-tighter">MK{viewDocumentOrder.total.toLocaleString()}</div>
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
