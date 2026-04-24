import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    isService: false,
  });

  const products = useLiveQuery(
    () => db.products.where('name').startsWithIgnoreCase(searchTerm).toArray(),
    [searchTerm]
  );
  const categories = useLiveQuery(() => db.categories.toArray());

  const filteredProducts = selectedCategory
    ? products?.filter(p => p.categoryId === selectedCategory)
    : products;

  // Inventory Analytics
  const analytics = useMemo(() => {
    if (!products) return { totalCost: 0, totalProfit: 0, totalLoss: 0, lowStock: 0 };
    
    let cost = 0;
    let profit = 0;
    let loss = 0;
    let low = 0;

    const now = new Date();

    products.forEach(p => {
      if (p.isService) return;

      const pCost = p.costPrice * p.quantity;
      const pProfit = (p.sellPrice - p.costPrice) * p.quantity;
      
      cost += pCost;
      profit += pProfit;

      // Loss evaluation based on ageing
      const created = new Date(p.createdAt || Date.now());
      const ageInDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 3600 * 24));
      
      let depreciationRate = 0;
      if (ageInDays > 180) depreciationRate = 0.3; // 30% loss for items > 6 months
      else if (ageInDays > 90) depreciationRate = 0.1; // 10% loss for items > 3 months
      else if (ageInDays > 60) depreciationRate = 0.05; // 5% loss for items > 2 months

      loss += pCost * depreciationRate;

      if (p.quantity <= 5) low++;
    });

    return { totalCost: cost, totalProfit: profit, totalLoss: loss, lowStock: low };
  }, [products]);

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
      isService: false,
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
      isService: product.isService || false,
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
      });
      setNewCategoryTitle('');
      toast.success('Category created');
    } catch {
      toast.error('Failed to create category');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <header className="px-4 py-4 md:px-10 md:py-10 bg-surface-card md:border-b border-surface-border sticky top-0 z-30 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h2 className="section-title !mb-0">
            <Package className="w-6 h-6 text-primary-500" />
            Inventory Intelligence
          </h2>
          <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsCategoryModalOpen(true)}
                className="btn-secondary !px-6 !py-4"
                title="Open Category Manager"
                aria-label="Open Category Manager"
              >
                Categories
              </button>
              <button 
                onClick={() => openAddModal()}
                className="btn-primary !px-6 !py-4"
                title="Add New Product"
                aria-label="Add New Product"
              >
                <Plus className="w-4 h-4 mr-1 inline" /> Add Product
              </button>
          </div>
        </div>
          
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
          <div className="bg-surface-bg border border-surface-border p-8 rounded-[2rem] shadow-sm">
            <div className="card-label">Total Stock Cost</div>
            <div className="text-2xl font-black tracking-tighter italic">MK {analytics.totalCost.toLocaleString()}</div>
          </div>
          <div className="bg-surface-bg border border-surface-border p-8 rounded-[2rem] shadow-sm">
            <div className="card-label !text-emerald-500">Expected Profit</div>
            <div className="text-2xl font-black tracking-tighter italic text-emerald-500">MK {analytics.totalProfit.toLocaleString()}</div>
          </div>
          <div className="bg-surface-bg border border-surface-border p-8 rounded-[2rem] shadow-sm">
            <div className="card-label !text-red-500">Est. Ageing Loss</div>
            <div className="text-2xl font-black tracking-tighter italic text-red-500">MK {analytics.totalLoss.toLocaleString()}</div>
          </div>
          <div className="bg-surface-bg border border-surface-border p-8 rounded-[2rem] shadow-sm">
            <div className="card-label !text-primary-500">Low Stock (Real)</div>
            <div className="text-2xl font-black tracking-tighter italic text-primary-500">{analytics.lowStock} <span className="text-[10px] text-surface-text/20">Items</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-surface-text/40 w-5 h-5 group-focus-within:text-primary-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by name or SKU..."
              title="Search products"
              aria-label="Search products"
              className="input-field w-full pl-14 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
            <button 
              onClick={() => setSelectedCategory(null)}
              className={clsx(
                "px-8 py-3 rounded-2xl border text-[10px] font-black tracking-widest transition-all whitespace-nowrap",
                !selectedCategory ? "bg-primary-500 border-primary-500 text-white shadow-lg" : "bg-surface-bg border-surface-border text-surface-text/40"
              )}
              title="Show all categories"
              aria-label="Show all categories"
            >
              ALL ITEMS
            </button>
            {categories?.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  "px-8 py-3 rounded-2xl border text-[10px] font-black tracking-widest transition-all whitespace-nowrap",
                  selectedCategory === cat.id ? "bg-primary-500 border-primary-500 text-white shadow-lg" : "bg-surface-bg border-surface-border text-surface-text/40"
                )}
                title={`Filter by ${cat.title}`}
                aria-label={`Filter by ${cat.title}`}
              >
                {cat.title.toUpperCase()}
              </button>
            ))}
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
                className="bg-surface-card md:border border-surface-border md:rounded-[2rem] overflow-hidden group hover:border-primary-500/30 transition-all flex flex-col border-b border-surface-border/50 shadow-sm hover:shadow-xl hover:-translate-y-1 duration-500"
              >
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-[9px] font-black text-surface-text/30  tracking-widest">{product.sku}</div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => openEditModal(product)} 
                        className="p-2 hover:bg-primary-500/10 rounded-xl transition-colors text-primary-400"
                        title="Edit product"
                        aria-label="Edit product"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteProduct(product.id)} 
                        className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-red-500"
                        title="Delete product"
                        aria-label="Delete product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-black text-lg leading-tight mb-4 group-hover:text-primary-500 transition-colors tracking-tight line-clamp-2">{product.name}</h3>
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-primary-500 font-black text-2xl leading-none tracking-tighter">MK {product.sellPrice.toLocaleString()}</span>
                  </div>
                  <div className={clsx(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black  tracking-widest",
                    product.quantity <= 5 ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  )}>
                    {product.quantity <= 5 ? <AlertTriangle className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                    {product.quantity} in stock
                  </div>
                </div>
                <div className="px-6 py-4 bg-surface-bg/30 border-t border-surface-border flex justify-between items-center text-[9px] font-black  tracking-widest text-surface-text/40">
                  <span>Stock Profit: MK {((product.sellPrice - product.costPrice) * product.quantity).toLocaleString()}</span>
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
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
              <label className="text-[9px] font-black  tracking-widest text-surface-text/40 ml-1" htmlFor="product-name">Product name</label>
              <input required id="product-name" type="text" className="input-field w-full" placeholder="e.g. Coca Cola 300ml" title="Product name" aria-label="Product name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black  tracking-widest text-surface-text/40 ml-1" htmlFor="product-sku">SKU / Barcode</label>
              <div className="relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/30" />
                <input required id="product-sku" type="text" className="input-field w-full pl-10" placeholder="Scan or type..." title="SKU / Barcode" aria-label="SKU / Barcode" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black  tracking-widest text-surface-text/40 ml-1" htmlFor="product-category">Category</label>
              <select id="product-category" className="input-field w-full font-bold" title="Product category" aria-label="Product category" value={formData.categoryId} onChange={(e) => setFormData({...formData, categoryId: Number(e.target.value)})}>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black  tracking-widest text-surface-text/40 ml-1" htmlFor="product-cost">Cost price</label>
              <input required id="product-cost" type="number" className="input-field w-full font-bold" title="Cost price" aria-label="Cost price" value={formData.costPrice} onChange={(e) => setFormData({...formData, costPrice: Number(e.target.value)})} onFocus={(e) => e.target.select()} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black  tracking-widest text-surface-text/40 ml-1" htmlFor="product-sell">Sell price</label>
              <input required id="product-sell" type="number" className="input-field w-full font-black text-primary-500" title="Sell price" aria-label="Sell price" value={formData.sellPrice} onChange={(e) => setFormData({...formData, sellPrice: Number(e.target.value)})} onFocus={(e) => e.target.select()} />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-[9px] font-black  tracking-widest text-surface-text/40 ml-1" htmlFor="product-qty">Opening Stock Quantity</label>
              <input required id="product-qty" type="number" className="input-field w-full font-black" title="Opening Stock Quantity" aria-label="Opening Stock Quantity" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})} onFocus={(e) => e.target.select()} />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="flex items-center gap-3 p-4 bg-surface-bg border border-surface-border rounded-2xl cursor-pointer group hover:border-primary-500/20 transition-all">
                <input 
                  type="checkbox" 
                  checked={formData.isService} 
                  onChange={(e) => setFormData({...formData, isService: e.target.checked})}
                  className="w-5 h-5 rounded border-surface-border text-primary-500 focus:ring-primary-500"
                />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest">Service / Non-Stock Item</div>
                  <div className="text-[9px] text-surface-text/30 font-bold">Exclude from stock alerts and inventory value</div>
                </div>
              </label>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black  tracking-widest" title="Cancel" aria-label="Cancel">Cancel</button>
            <button type="submit" className="flex-1 btn-primary !py-4 text-[10px] font-black  tracking-widest" title="Save product" aria-label="Save product">Save product</button>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Manage Categories">
        <div className="p-8 space-y-8">
          <div className="space-y-2">
            <label className="text-[9px] font-black  tracking-widest text-surface-text/40 ml-1" htmlFor="new-category">Create new category</label>
            <div className="flex gap-2">
              <input id="new-category" type="text" className="input-field flex-1" placeholder="Category name..." title="New category name" aria-label="New category name" value={newCategoryTitle} onChange={(e) => setNewCategoryTitle(e.target.value)} />
              <button onClick={handleAddCategory} className="btn-primary !px-6 !py-3 font-black text-[10px]  tracking-widest" title="Add category" aria-label="Add category">Add</button>
            </div>
          </div>
          <div className="space-y-2">
             <div className="text-[9px] font-black  tracking-widest text-surface-text/40 ml-1">Existing categories</div>
             <div className="bg-surface-bg border border-surface-border rounded-2xl divide-y divide-surface-border overflow-hidden">
                {categories?.map(cat => (
                  <div key={cat.id} className="p-4 flex justify-between items-center group hover:bg-primary-500/5 transition-colors">
                    <span className="font-bold text-sm">{cat.title}</span>
                    <button 
                      onClick={() => db.categories.delete(cat.id)} 
                      className="p-2 text-surface-text/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title={`Delete ${cat.title} category`}
                      aria-label={`Delete ${cat.title} category`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
