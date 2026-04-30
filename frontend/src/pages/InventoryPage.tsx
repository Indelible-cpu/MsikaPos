import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import { SyncService } from '../services/SyncService';
import type { LocalProduct } from '../db/posDB';
import { 
  Plus, 
  Search, 
  Package, 
  AlertTriangle, 
  Edit2, 
  Trash2, 
  ArrowUpRight,
  Barcode,
  CheckCircle2,
  Image as ImageIcon,
  Upload,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import AiAssistant from '../components/AiAssistant';
import Modal from '../components/Modal';
import { soundService } from '../services/SoundService';
import { AuditService } from '../services/AuditService';

const generateNumericId = () => {
  return Date.now() + Math.floor(Math.random() * 1000);
};

const InventoryPage: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LocalProduct | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    costPrice: 0,
    sellPrice: 0,
    quantity: 0,
    categoryId: 0,
    isService: false,
    imageUrl: '',
    discount: 0,
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    discountValue: 0,
    discountStartDate: '',
    discountEndDate: '',
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
      const created = new Date(p.createdAt || now);
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
    const initialSku = scannedSku || generateNumericId().toString();

    setFormData({
      name: editingProduct?.name || '',
      sku: initialSku || editingProduct?.sku || '',
      costPrice: editingProduct?.costPrice || 0,
      sellPrice: editingProduct?.sellPrice || 0,
      quantity: editingProduct?.quantity || 0,
      categoryId: editingProduct?.categoryId || defaultCatId,
      isService: editingProduct?.isService || false,
      imageUrl: editingProduct?.imageUrl || '',
      discount: editingProduct?.discount || 0,
      discountType: (editingProduct?.discountType || 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED',
      discountValue: editingProduct?.discountValue || 0,
      discountStartDate: editingProduct?.discountStartDate || '',
      discountEndDate: editingProduct?.discountEndDate || '',
    });
  }, [categories, editingProduct]);

  const handleExport = () => {
    if (!products || products.length === 0) {
      toast.error('No inventory to export');
      return;
    }

    const headers = ['SKU', 'Name', 'Category', 'Cost Price', 'Sell Price', 'Quantity', 'Type'];
    const rows = products.map(p => {
      const cat = categories?.find(c => c.id === p.categoryId);
      return [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        cat?.title || 'Uncategorized',
        p.costPrice,
        p.sellPrice,
        p.quantity,
        p.isService ? 'Service' : 'Product'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `MsikaPos_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Inventory exported successfully');
  };


  const openAddModal = useCallback(async (scannedSku?: string) => {
    setEditingProduct(null);
    await resetForm(scannedSku);
    setIsAddModalOpen(true);
  }, [resetForm]);

  const openEditModal = useCallback((p: LocalProduct) => {
    setEditingProduct(p);
    setFormData({
      name: p?.name || '',
      sku: p?.sku || '',
      costPrice: p?.costPrice || 0,
      sellPrice: p?.sellPrice || 0,
      quantity: p?.quantity || 0,
      categoryId: p?.categoryId || (categories?.[0]?.id || 0),
      isService: p?.isService || false,
      imageUrl: p?.imageUrl || '',
      discount: p?.discount || 0,
      discountType: (p?.discountType || 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED',
      discountValue: p?.discountValue || 0,
      discountStartDate: p?.discountStartDate || '',
      discountEndDate: p?.discountEndDate || '',
    });
    setIsAddModalOpen(true);
  }, [categories]);

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
  }, [openAddModal, openEditModal]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        // Target size 500x500 for good quality vs size ratio
        canvas.width = 500;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const offsetX = (img.width - size) / 2;
          const offsetY = (img.height - size) / 2;
          ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, 500, 500);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // Compress
          setFormData(prev => ({ ...prev, imageUrl: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productData = {
        ...formData,
        discountType: formData.discountType as 'PERCENTAGE' | 'FIXED' | undefined,
        quantity: formData.isService ? 1 : formData.quantity,
        updatedAt: new Date().toISOString()
      };

      if (editingProduct) {
        await db.products.update(editingProduct.id, productData);
        await AuditService.log('PRODUCT_UPDATE', `Updated product: ${productData.name} (SKU: ${productData.sku})`);
        toast.success('Product updated');
      } else {
        await db.products.add({
          ...productData,
          id: generateNumericId(),
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        });
        await AuditService.log('PRODUCT_ADD', `Added product: ${productData.name} (SKU: ${productData.sku})`);
        toast.success('Product added to inventory');
      }
      
      // Sync to cloud storefront
      const productToSync = editingProduct 
        ? { ...productData, id: editingProduct.id }
        : { ...productData, id: generateNumericId() };
      
      await SyncService.pushProduct(productToSync as Parameters<typeof SyncService.pushProduct>[0]);
      
      setIsAddModalOpen(false);
      setEditingProduct(null);
    } catch {
      toast.error('Failed to save product');
    }
  };

  const deleteProduct = async (id: number) => {
    if (!isSuperAdmin) {
      toast.error('Access Denied: Only Super Admins can delete products');
      return;
    }
    setDeleteConfirmation(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmation) {
      const product = await db.products.get(deleteConfirmation);
      await db.products.delete(deleteConfirmation);
      if (product) {
        await AuditService.log('PRODUCT_DELETE', `Deleted product: ${product.name} (SKU: ${product.sku})`, 'WARNING');
      }
      toast.success('Product removed');
      setDeleteConfirmation(null);
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
    <div className="flex flex-col min-h-screen w-full bg-surface-bg transition-all pb-24 md:pb-0 px-0">
      <header className="bg-surface-card border-b border-surface-border px-6 md:px-12 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 sticky top-0 z-30">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black tracking-tighter uppercase">Inventory Manager</h1>
          <p className="text-[10px] font-black text-surface-text/40 tracking-widest uppercase">Manage stock levels and product catalog</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCategoryModalOpen(true)}
            className="btn-secondary !px-6 !py-4 uppercase text-[10px] font-black tracking-widest"
            title="Open Category Manager"
            aria-label="Open Category Manager"
          >
            Categories
          </button>
          <button 
            onClick={handleExport}
            className="btn-secondary !px-6 !py-4 uppercase text-[10px] font-black tracking-widest flex items-center gap-2"
            title="Export CSV"
            aria-label="Export CSV"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button 
            onClick={() => openAddModal()}
            className="btn-primary !px-6 !py-4 uppercase text-[10px] font-black tracking-widest shadow-lg shadow-primary-500/20"
            title="Add New Product"
            aria-label="Add New Product"
          >
            <Plus className="w-4 h-4 mr-1 inline" /> Add Product
          </button>
        </div>
      </header>
        
      <div className="px-6 md:px-12 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-0 bg-surface-card border border-surface-border rounded-3xl overflow-hidden mb-8">
          <div className="p-8 border-b md:border-b-0 md:border-r border-surface-border/50 bg-surface-card">
            <div className="card-label uppercase">Total Stock Cost</div>
            <div className="text-xl md:text-2xl font-black tracking-tighter">MK{analytics.totalCost.toLocaleString()}</div>
          </div>
          <div className="p-8 border-b md:border-b-0 md:border-r border-surface-border/50 bg-surface-card">
            <div className="card-label !text-emerald-500 uppercase">Expected Profit</div>
            <div className="text-xl md:text-2xl font-black tracking-tighter text-emerald-500">MK{analytics.totalProfit.toLocaleString()}</div>
          </div>
          <div className="p-8 border-b md:border-b-0 md:border-r border-surface-border/50 bg-surface-card">
            <div className="card-label !text-red-500 uppercase">Est. Ageing Loss</div>
            <div className="text-xl md:text-2xl font-black tracking-tighter text-red-500">MK{analytics.totalLoss.toLocaleString()}</div>
          </div>
          <div className="p-8 bg-surface-card">
            <div className="card-label !text-primary-500 uppercase">Low Stock Alert</div>
            <div className="text-xl md:text-2xl font-black tracking-tighter text-primary-500">{analytics.lowStock} <span className="text-[10px] text-surface-text/20 uppercase">Items</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-surface-text/40 w-5 h-5 group-focus-within:text-primary-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by name or SKU..."
              title="Search products"
              aria-label="Search products"
              className="input-field w-full pl-14 shadow-sm py-4"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
            <button 
              onClick={() => setSelectedCategory(null)}
              className={clsx(
                "px-8 py-3 text-[10px] font-black tracking-widest transition-all whitespace-nowrap border-b-2 uppercase",
                !selectedCategory ? "border-primary-500 text-primary-500" : "border-transparent text-surface-text/40 hover:text-surface-text"
              )}
              title="Show all categories"
              aria-label="Show all categories"
            >
              All Items
            </button>
            {categories?.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  "px-8 py-3 text-[10px] font-black tracking-widest transition-all whitespace-nowrap border-b-2 uppercase",
                  selectedCategory === cat.id ? "border-primary-500 text-primary-500" : "border-transparent text-surface-text/40 hover:text-surface-text"
                )}
                title={`Filter by ${cat.title}`}
                aria-label={`Filter by ${cat.title}`}
              >
                {cat.title}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredProducts?.map(product => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={product.id}
                className="overflow-hidden group transition-all flex flex-col bg-surface-card border border-surface-border rounded-3xl hover:border-primary-500/20 duration-500"
              >
                <div className="p-6 flex-1 flex flex-col">
                  <div className="w-full aspect-square bg-surface-bg border border-surface-border rounded-2xl mb-4 overflow-hidden relative flex items-center justify-center">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-surface-text/10" />
                    )}
                  </div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-[9px] font-black text-surface-text/30 tracking-widest uppercase">{product.sku}</div>
                    <div className="flex gap-1">
                      {product.imageUrl && (
                        <div className="flex gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setPreviewImage(product.imageUrl || null); }} 
                            className="p-2 hover:bg-emerald-500/10 rounded-xl transition-colors text-emerald-500"
                            title="View product image"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                          {isSuperAdmin && (
                            <button 
                              onClick={async (e) => { 
                                e.stopPropagation(); 
                                if (confirm('Remove product image?')) {
                                  await db.products.update(product.id, { imageUrl: '' });
                                  await SyncService.pushProduct({ ...product, imageUrl: '' });
                                  toast.success('Image removed');
                                }
                              }} 
                              className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-red-500"
                              title="Remove product image"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEditModal(product); }} 
                        className="p-2 hover:bg-primary-500/10 rounded-xl transition-colors text-primary-400"
                        title="Edit product"
                        aria-label="Edit product"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {isSuperAdmin && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteProduct(product.id); }} 
                          className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-red-500"
                          title="Delete product"
                          aria-label="Delete product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="font-black text-lg leading-tight mb-4 group-hover:text-primary-500 transition-colors tracking-tight line-clamp-2 uppercase">{product.name}</h3>
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-primary-500 font-black text-2xl leading-none tracking-tighter">MK{product.sellPrice.toLocaleString()}</span>
                  </div>
                  <div className={clsx(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black tracking-widest uppercase",
                    product.quantity <= 5 ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  )}>
                    {product.isService ? <CheckCircle2 className="w-3 h-3" /> : (product.quantity <= 5 ? <AlertTriangle className="w-3 h-3" /> : <Package className="w-3 h-3" />)}
                    {product.isService ? 'Service Item' : `${product.quantity} in stock`}
                  </div>
                </div>
                <div className="px-6 py-4 bg-surface-bg/30 border-t border-surface-border flex justify-between items-center text-[9px] font-black tracking-widest text-surface-text/40">
                  {!product.isService && isSuperAdmin ? (
                    <>
                      <span className="uppercase">Stock Profit: MK{((product.sellPrice - product.costPrice) * product.quantity).toLocaleString()}</span>
                      <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                    </>
                  ) : (
                    <span className="uppercase">Inventory Item</span>
                  )}
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
            <div className="col-span-2 flex items-center gap-6 mb-2">
              <div className="w-24 h-24 rounded-2xl bg-surface-bg border border-surface-border flex items-center justify-center overflow-hidden shrink-0 relative group">
                {formData.imageUrl ? (
                  <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-surface-text/20" />
                )}
                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white">
                  <Upload className="w-5 h-5 mb-1" />
                  <span className="text-[8px] font-black tracking-widest">UPLOAD</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
              <div>
                <p className="text-[10px] font-black tracking-widest uppercase mb-1">Product Image</p>
                <p className="text-[9px] font-bold text-surface-text/40 uppercase">Adding an image improves experience.</p>
                <p className="text-[9px] font-bold text-surface-text/40 uppercase">Optimal ratio is 1:1.</p>
                {formData.imageUrl && (
                  <button type="button" onClick={() => setFormData({...formData, imageUrl: ''})} className="text-[9px] font-black tracking-widest text-red-500 mt-2 hover:underline uppercase">
                    REMOVE IMAGE
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1 col-span-2">
              <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="product-name">Product name</label>
              <input required id="product-name" type="text" className="input-field w-full py-3 px-4 font-black" placeholder="e.g. Coca Cola 300ml" title="Product name" aria-label="Product name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="product-sku">SKU / Barcode</label>
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/30" />
                  <input required id="product-sku" type="text" className="input-field w-full pl-10 py-3 px-4 font-black" placeholder="Scan or type..." title="SKU / Barcode" aria-label="SKU / Barcode" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} />
                </div>
                <button type="button" onClick={() => setFormData({...formData, sku: generateNumericId().toString()})} className="px-4 py-3 bg-surface-bg border border-surface-border rounded-xl text-[10px] font-black uppercase hover:bg-surface-card transition-all" title="Auto-generate SKU">
                  Generate
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="product-category">Category</label>
              <select id="product-category" className="input-field w-full py-3 px-4 font-black" title="Product category" aria-label="Product category" value={formData.categoryId} onChange={(e) => setFormData({...formData, categoryId: Number(e.target.value)})}>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="product-cost">Cost price</label>
              <input 
                required 
                id="product-cost" 
                type="number" 
                className={clsx("input-field w-full py-3 px-4 font-black", !isSuperAdmin && "opacity-50 cursor-not-allowed")} 
                title="Cost price" 
                aria-label="Cost price" 
                value={formData.costPrice} 
                onChange={(e) => setFormData({...formData, costPrice: Number(e.target.value)})} 
                onFocus={(e) => e.target.select()} 
                readOnly={!isSuperAdmin}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="product-sell">Sell price</label>
              <input required id="product-sell" type="number" className="input-field w-full py-3 px-4 font-black text-primary-500" title="Sell price" aria-label="Sell price" value={formData.sellPrice} onChange={(e) => setFormData({...formData, sellPrice: Number(e.target.value)})} onFocus={(e) => e.target.select()} />
            </div>
            <div className="space-y-1 col-span-2 p-4 bg-surface-bg/50 border border-surface-border rounded-2xl">
              <div className="text-[10px] font-black tracking-widest text-surface-text/40 mb-3 uppercase">Discount Configuration</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="discount-type">Discount Type</label>
                  <select id="discount-type" title="Discount Type" aria-label="Discount Type" className="input-field w-full py-3 px-4 font-black text-rose-500 bg-rose-500/5 border-rose-500/20" value={formData.discountType} onChange={(e) => setFormData({...formData, discountType: e.target.value as 'PERCENTAGE'|'FIXED'})}>
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="discount-value">Discount Value</label>
                  <input id="discount-value" title="Discount Value" aria-label="Discount Value" placeholder="0" type="number" className="input-field w-full py-3 px-4 font-black text-rose-500 bg-rose-500/5 border-rose-500/20" value={formData.discountValue} onChange={(e) => {
                    let val = Math.max(0, Number(e.target.value));
                    if (formData.discountType === 'PERCENTAGE') val = Math.min(100, val);
                    setFormData({...formData, discountValue: val, discount: formData.discountType === 'PERCENTAGE' ? val : 0});
                  }} onFocus={(e) => e.target.select()} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="discount-start">Start Date (Optional)</label>
                  <input id="discount-start" title="Discount Start Date" aria-label="Discount Start Date" placeholder="Start Date" type="date" className="input-field w-full py-3 px-4 font-black text-surface-text/60" value={formData.discountStartDate} onChange={(e) => setFormData({...formData, discountStartDate: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="discount-end">End Date (Optional)</label>
                  <input id="discount-end" title="Discount End Date" aria-label="Discount End Date" placeholder="End Date" type="date" className="input-field w-full py-3 px-4 font-black text-surface-text/60" value={formData.discountEndDate} onChange={(e) => setFormData({...formData, discountEndDate: e.target.value})} />
                </div>
              </div>
            </div>
            {!formData.isService && (
              <div className="space-y-1 col-span-2">
                <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="product-qty">Opening Stock Quantity</label>
                <input required id="product-qty" type="number" className="input-field w-full py-3 px-4 font-black" title="Opening Stock Quantity" aria-label="Opening Stock Quantity" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})} onFocus={(e) => e.target.select()} />
              </div>
            )}
            <div className="space-y-1 col-span-2">
              <label className="flex items-center gap-3 p-4 bg-surface-bg border border-surface-border rounded-2xl cursor-pointer group hover:border-primary-500/20 transition-all">
                <input 
                  type="checkbox" 
                  checked={formData.isService} 
                  onChange={(e) => setFormData({...formData, isService: e.target.checked})}
                  className="w-5 h-5 rounded border-surface-border text-primary-500 focus:ring-primary-500"
                />
                <div>
                  <div className="text-[10px] font-black tracking-widest uppercase">Service / Non-Stock Item</div>
                  <div className="text-[9px] text-surface-text/30 font-bold uppercase">Exclude from stock alerts</div>
                </div>
              </label>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black tracking-widest uppercase" title="Cancel" aria-label="Cancel">Cancel</button>
            <button type="submit" className="flex-1 btn-primary !py-4 text-[10px] font-black tracking-widest uppercase shadow-lg shadow-primary-500/20" title="Save product" aria-label="Save product">Save product</button>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Manage Categories">
        <div className="w-full space-y-10 px-8 py-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase" htmlFor="new-category">Create new category</label>
            <div className="flex gap-2">
              <input id="new-category" type="text" className="input-field flex-1 py-3 px-4 font-black" placeholder="Category name..." title="New category name" aria-label="New category name" value={newCategoryTitle} onChange={(e) => setNewCategoryTitle(e.target.value)} />
              <button onClick={handleAddCategory} className="btn-primary !px-8 !py-3 font-black text-[10px] tracking-widest uppercase shadow-lg shadow-primary-500/20" title="Add category" aria-label="Add category">Add</button>
            </div>
          </div>
          <div className="space-y-2">
             <div className="text-[9px] font-black tracking-widest text-surface-text/40 ml-1 uppercase">Existing categories</div>
             <div className="bg-surface-bg border border-surface-border rounded-2xl divide-y divide-surface-border overflow-hidden">
                {categories?.map(cat => (
                  <div key={cat.id} className="p-4 flex justify-between items-center group hover:bg-primary-500/5 transition-colors">
                    <span className="font-bold text-sm uppercase">{cat.title}</span>
                    {isSuperAdmin && (
                      <button 
                        onClick={() => db.categories.delete(cat.id)} 
                        className="p-2 text-surface-text/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        title={`Delete ${cat.title} category`}
                        aria-label={`Delete ${cat.title} category`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
             </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirmation} onClose={() => setDeleteConfirmation(null)} title="Confirm Deletion">
        <div className="p-10 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
            <Trash2 className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tighter text-red-500 mb-2 uppercase">Delete Product?</h2>
            <p className="text-surface-text/40 text-[10px] font-black tracking-widest px-4 leading-relaxed uppercase">This action cannot be undone.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setDeleteConfirmation(null)} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black tracking-widest uppercase">Cancel</button>
            <button onClick={confirmDelete} className="flex-1 bg-red-500 text-white rounded-2xl text-[10px] font-black tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all uppercase">Delete</button>
          </div>
        </div>
      </Modal>
      {/* Image Preview Modal */}
      <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title="Product Preview">
        <div className="p-4 flex items-center justify-center bg-black/5">
          <div className="relative group w-full max-w-lg aspect-square rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white">
            <img src={previewImage || ''} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-8">
              <button onClick={() => setPreviewImage(null)} className="btn-primary !bg-white !text-black !py-3 !px-8 text-[10px] font-black tracking-widest uppercase">CLOSE PREVIEW</button>
            </div>
          </div>
        </div>
      </Modal>

      <AiAssistant type="INVENTORY_STRATEGY" context={products} />
    </div>
  );
};

export default InventoryPage;
