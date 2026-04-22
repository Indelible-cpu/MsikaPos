import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import type { LocalProduct } from '../db/posDB';
import { 
  Plus, 
  Search, 
  Package, 
  AlertTriangle, 
  Edit2, 
  Trash2, 
  ArrowUpRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const InventoryPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LocalProduct | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    costPrice: 0,
    sellPrice: 0,
    quantity: 0,
    categoryId: 0,
  });

  // DB Data
  const products = useLiveQuery(
    () => db.products.where('name').startsWithIgnoreCase(searchTerm).toArray(),
    [searchTerm]
  );
  const categories = useLiveQuery(() => db.categories.toArray());

  const filteredProducts = selectedCategory
    ? products?.filter(p => p.categoryId === selectedCategory)
    : products;

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await db.products.update(editingProduct.id, {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
        toast.success('Product updated');
      } else {
        const newId = Date.now() + Math.floor(Math.random() * 1000);
        await db.products.add({
          ...formData,
          id: newId,
          isService: false,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        toast.success('Product added to inventory');
      }
      setIsAddModalOpen(false);
      setEditingProduct(null);
      resetForm();
    } catch (error) {
      toast.error('Failed to save product');
    }
  };

  const deleteProduct = async (id: number) => {
    if (confirm('Are you sure you want to delete this product?')) {
      await db.products.delete(id);
      toast.success('Product removed');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      costPrice: 0,
      sellPrice: 0,
      quantity: 0,
      categoryId: categories?.[0]?.id || 0,
    });
  };

  const openEditModal = (product: LocalProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      costPrice: product.costPrice,
      sellPrice: product.sellPrice,
      quantity: product.quantity,
      categoryId: product.categoryId,
    });
    setIsAddModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      {/* Header Area */}
      <header className="p-6 bg-surface-card border-b border-surface-border sticky top-0 z-30">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter">Inventory</h1>
          </div>
          <button 
            onClick={() => { resetForm(); setEditingProduct(null); setIsAddModalOpen(true); }}
            className="btn-primary !px-4 !py-2 flex items-center gap-2 text-xs uppercase tracking-widest font-black"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by name or SKU..."
              className="input-field w-full pl-10 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button 
              onClick={() => setSelectedCategory(null)}
              className={clsx(
                "px-4 py-2 rounded-xl border text-xs font-bold uppercase transition-all whitespace-nowrap",
                !selectedCategory ? "bg-primary-600 border-primary-600 text-white shadow-lg" : "bg-surface-bg border-surface-border text-surface-text/40"
              )}
            >
              All
            </button>
            {categories?.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  "px-4 py-2 rounded-xl border text-xs font-bold uppercase transition-all whitespace-nowrap",
                  selectedCategory === cat.id ? "bg-primary-600 border-primary-600 text-white shadow-lg" : "bg-surface-bg border-surface-border text-surface-text/40"
                )}
              >
                {cat.title}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Product List */}
      <div className="p-4 md:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredProducts?.map(product => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={product.id}
                className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden group hover:border-primary-500/30 transition-all flex flex-col"
              >
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-surface-text/30">{product.sku}</div>
                    <div className="flex gap-1">
                    <button 
                      title="Edit Product"
                      aria-label="Edit Product"
                      onClick={() => openEditModal(product)} 
                      className="p-2 hover:bg-primary-500/10 rounded-lg transition-colors text-primary-400"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      title="Delete Product"
                      aria-label="Delete Product"
                      onClick={() => deleteProduct(product.id)} 
                      className="p-2 hover:bg-accent-danger/10 rounded-lg transition-colors text-accent-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    </div>
                  </div>
                  <h3 className="font-bold text-lg leading-tight mb-2 group-hover:text-primary-400 transition-colors uppercase tracking-tight">{product.name}</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-primary-400 font-black text-xl leading-none">MK {product.sellPrice.toLocaleString()}</span>
                  </div>
                  <div className={clsx(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider",
                    product.quantity <= 5 ? "bg-accent-danger/10 text-accent-danger border border-accent-danger/20" : "bg-accent-success/10 text-accent-success border border-accent-success/20"
                  )}>
                    {product.quantity <= 5 ? <AlertTriangle className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                    {product.quantity} In Stock
                  </div>
                </div>
                <div className="px-5 py-3 bg-surface-bg/50 border-t border-surface-border flex justify-between items-center text-[10px] font-bold text-surface-text/40">
                  <span>Profit/Unit: MK {(product.sellPrice - product.costPrice).toLocaleString()}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-bg/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ y: 50, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 50, scale: 0.95 }}
              className="bg-surface-card border border-surface-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleSaveProduct}>
                <div className="p-8 border-b border-surface-border bg-surface-bg/30">
                  <h2 className="text-2xl font-black tracking-tighter uppercase">{editingProduct ? 'Edit Product' : 'New Product'}</h2>
                  <p className="text-xs text-surface-text/40 font-bold uppercase tracking-widest mt-1">Item Details & Pricing</p>
                </div>
                
                <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Product Name</label>
                       <input 
                         required
                         type="text" 
                         className="input-field w-full"
                         placeholder="e.g. Samsung Galaxy S21"
                         value={formData.name}
                         onChange={(e) => setFormData({...formData, name: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-surface-text/40 ml-1">SKU / Code</label>
                       <input 
                         required
                         type="text" 
                         className="input-field w-full"
                         placeholder="PH-SAM-001"
                         value={formData.sku}
                         onChange={(e) => setFormData({...formData, sku: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Category</label>
                       <select 
                         title="Select Product Category"
                         aria-label="Product Category"
                         className="input-field w-full appearance-none bg-surface-bg"
                         value={formData.categoryId}
                         onChange={(e) => setFormData({...formData, categoryId: parseInt(e.target.value)})}
                       >
                         {categories?.map(cat => (
                           <option key={cat.id} value={cat.id}>{cat.title}</option>
                         ))}
                       </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 bg-surface-bg/30 p-4 rounded-2xl border border-surface-border">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Cost (MK)</label>
                       <input 
                         title="Enter Cost Price"
                         aria-label="Cost Price"
                         required
                         type="number" 
                         className="input-field w-full text-center"
                         placeholder="0.00"
                         value={formData.costPrice}
                         onChange={(e) => setFormData({...formData, costPrice: parseFloat(e.target.value)})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Sell (MK)</label>
                       <input 
                         title="Enter Selling Price"
                         aria-label="Selling Price"
                         required
                         type="number" 
                         className="input-field w-full text-center font-black text-primary-400"
                         placeholder="0.00"
                         value={formData.sellPrice}
                         onChange={(e) => setFormData({...formData, sellPrice: parseFloat(e.target.value)})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Stock</label>
                       <input 
                         title="Enter Stock Quantity"
                         aria-label="Stock Quantity"
                         required
                         type="number" 
                         className="input-field w-full text-center font-bold"
                         placeholder="0"
                         value={formData.quantity}
                         onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})}
                       />
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-surface-bg/30 border-t border-surface-border flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-surface-card transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 btn-primary !py-4 text-[10px] font-black uppercase tracking-widest"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InventoryPage;
