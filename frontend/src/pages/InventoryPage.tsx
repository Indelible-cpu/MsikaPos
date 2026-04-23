import React, { useState, useEffect, useCallback } from 'react';
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
  ArrowUpRight,
  Barcode
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import Modal from '../components/Modal';
import { soundService } from '../services/SoundService';

const generateNumericId = () => {
  return Date.now() + Math.floor(Math.random() * 1000);
};

const InventoryPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LocalProduct | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    costPrice: 0,
    sellPrice: 0,
    quantity: 0,
    categoryId: 0,
  });

  const products = useLiveQuery(
    () => db.products.where('name').startsWithIgnoreCase(searchTerm).toArray(),
    [searchTerm]
  );
  const categories = useLiveQuery(() => db.categories.toArray());

  const filteredProducts = selectedCategory
    ? products?.filter(p => p.categoryId === selectedCategory)
    : products;

  const resetForm = useCallback(async (scannedSku?: string) => {
    const defaultCatId = categories?.[0]?.id || 0;
    let initialSku = scannedSku || '';
    
    if (!scannedSku && defaultCatId) {
      const cat = await db.categories.get(defaultCatId);
      const prefix = cat ? cat.title.substring(0, 2).toUpperCase() : 'PR';
      const productsInCat = await db.products.where('categoryId').equals(defaultCatId).toArray();
      initialSku = `${prefix}-${(productsInCat.length + 1).toString().padStart(3, '0')}`;
    }

    setFormData({
      name: '',
      sku: initialSku,
      costPrice: 0,
      sellPrice: 0,
      quantity: 0,
      categoryId: defaultCatId,
    });
  }, [categories]);

  const openAddModal = useCallback(async (scannedSku?: string) => {
    setEditingProduct(null);
    await resetForm(scannedSku);
    setIsAddModalOpen(true);
  }, [resetForm]);

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

  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      const currentTime = Date.now();
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        if (e.key !== 'Enter') return;
      }

      if (currentTime - lastKeyTime > 50) barcodeBuffer = '';
      
      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 2) {
          e.preventDefault();
          const product = await db.products.where('sku').equals(barcodeBuffer).first();
          if (product) {
            soundService.playBeep();
            toast.success(`Found: ${product.name}`, { id: 'scan-inv' });
            openEditModal(product);
          } else {
            soundService.playSuccess();
            toast.success(`New SKU detected: ${barcodeBuffer}`, { id: 'scan-inv' });
            openAddModal(barcodeBuffer);
          }
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
      lastKeyTime = currentTime;
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [openAddModal]);

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
        const newId = generateNumericId();
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
    } catch {
      toast.error('Failed to save product');
    }
  };

  const deleteProduct = async (id: number) => {
    if (confirm('Are you sure you want to delete this product?')) {
      await db.products.delete(id);
      toast.success('Product removed');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryTitle) return;
    try {
      const slug = newCategoryTitle.toLowerCase().replace(/ /g, '-');
      await db.categories.add({
        id: generateNumericId(),
        title: newCategoryTitle,
        slug: slug,
        itemCount: 0,
        createdAt: new Date().toISOString(),
      });
      setNewCategoryTitle('');
      toast.success('Category created');
    } catch {
      toast.error('Failed to create category');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <header className="px-0 py-0 md:px-6 md:py-6 bg-surface-card md:border-b border-surface-border sticky top-0 z-30">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="hidden md:flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">Inventory</h1>
            </div>
            <div className="flex flex-1 md:flex-none justify-end gap-2">
              <button 
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-6 py-4 bg-surface-bg border border-surface-border hover:bg-primary-500/5 transition-all text-surface-text rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
              >
                Categories
              </button>
              <button 
                onClick={() => openAddModal()}
                className="btn-primary !px-6 !py-4 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-500/20"
              >
                <Plus className="w-4 h-4 mr-1 inline" /> Add Product
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4 group-focus-within:text-primary-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search by name or SKU..."
                className="input-field w-full pl-11 h-14 text-sm font-bold shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
              <button 
                onClick={() => setSelectedCategory(null)}
                className={clsx(
                  "px-6 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  !selectedCategory ? "bg-primary-500 border-primary-500 text-white shadow-lg" : "bg-surface-bg border-surface-border text-surface-text/40"
                )}
              >
                All items
              </button>
              {categories?.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={clsx(
                    "px-6 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                    selectedCategory === cat.id ? "bg-primary-500 border-primary-500 text-white shadow-lg" : "bg-surface-bg border-surface-border text-surface-text/40"
                  )}
                >
                  {cat.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="p-0 md:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 md:gap-6">
          <AnimatePresence mode="popLayout">
            {filteredProducts?.map(product => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={product.id}
                className="bg-surface-card md:border border-surface-border md:rounded-3xl overflow-hidden group hover:border-primary-500/30 transition-all flex flex-col border-b border-surface-border/50"
              >
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-[9px] font-black text-surface-text/30 uppercase tracking-widest">{product.sku}</div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditModal(product)} className="p-2 hover:bg-primary-500/10 rounded-xl transition-colors text-primary-400">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteProduct(product.id)} className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-black text-lg leading-tight mb-4 group-hover:text-primary-500 transition-colors tracking-tight line-clamp-2">{product.name}</h3>
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-primary-500 font-black text-2xl leading-none tracking-tighter">MK {product.sellPrice.toLocaleString()}</span>
                  </div>
                  <div className={clsx(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest",
                    product.quantity <= 5 ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  )}>
                    {product.quantity <= 5 ? <AlertTriangle className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                    {product.quantity} in stock
                  </div>
                </div>
                <div className="px-6 py-4 bg-surface-bg/30 border-t border-surface-border flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-surface-text/40">
                  <span>Margin: MK {(product.sellPrice - product.costPrice).toLocaleString()}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Product Add/Edit Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={editingProduct ? 'Edit Product' : 'New Product'}>
        <form onSubmit={handleSaveProduct} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1 col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Product name</label>
              <input required type="text" className="input-field w-full" placeholder="e.g. Coca Cola 300ml" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/40 ml-1">SKU / Barcode</label>
              <div className="relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/30" />
                <input required type="text" className="input-field w-full pl-10" placeholder="Scan or type..." value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Category</label>
              <select className="input-field w-full font-bold" value={formData.categoryId} onChange={(e) => setFormData({...formData, categoryId: Number(e.target.value)})}>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Cost price</label>
              <input required type="number" className="input-field w-full font-bold" value={formData.costPrice} onChange={(e) => setFormData({...formData, costPrice: Number(e.target.value)})} onFocus={(e) => e.target.select()} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Sell price</label>
              <input required type="number" className="input-field w-full font-black text-primary-500" value={formData.sellPrice} onChange={(e) => setFormData({...formData, sellPrice: Number(e.target.value)})} onFocus={(e) => e.target.select()} />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Opening Stock Quantity</label>
              <input required type="number" className="input-field w-full font-black" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})} onFocus={(e) => e.target.select()} />
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black uppercase tracking-widest">Cancel</button>
            <button type="submit" className="flex-1 btn-primary !py-4 text-[10px] font-black uppercase tracking-widest">Save product</button>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Manage Categories">
        <div className="p-8 space-y-8">
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Create new category</label>
            <div className="flex gap-2">
              <input type="text" className="input-field flex-1" placeholder="Category name..." value={newCategoryTitle} onChange={(e) => setNewCategoryTitle(e.target.value)} />
              <button onClick={handleAddCategory} className="btn-primary !px-6 !py-3 font-black text-[10px] uppercase tracking-widest">Add</button>
            </div>
          </div>
          <div className="space-y-2">
             <div className="text-[9px] font-black uppercase tracking-widest text-surface-text/40 ml-1">Existing categories</div>
             <div className="bg-surface-bg border border-surface-border rounded-2xl divide-y divide-surface-border overflow-hidden">
                {categories?.map(cat => (
                  <div key={cat.id} className="p-4 flex justify-between items-center group hover:bg-primary-500/5 transition-colors">
                    <span className="font-bold text-sm">{cat.title}</span>
                    <button onClick={() => db.categories.delete(cat.id)} className="p-2 text-surface-text/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InventoryPage;
