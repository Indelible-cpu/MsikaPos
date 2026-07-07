import React, { useState, useEffect, useRef } from 'react';
import { Package, Search, ShoppingBag, User as UserIcon, Heart, Plus, Minus, ShoppingCart, X, ArrowRight, Settings, Bookmark, Loader2, RefreshCw, Check, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuditService } from '../services/AuditService';
import { formatCurrency } from '../utils/phoneUtils';
import { db } from '../db/posDB';
import toast from 'react-hot-toast';
import api from '../api/client';
import CustomerAuthModal from '../components/CustomerAuthModal';
import AppFooter from '../components/AppFooter';
import { toSentenceCase } from '../utils/stringUtils';
import { calculateEffectiveDiscount } from '../utils/discountUtils';
import { useThemeStore } from '../hooks/useThemeStore';

interface StoreProduct {
  id: number;
  name: string;
  sellPrice?: number;
  imageUrl?: string;
  description?: string;
  isService?: boolean;
  quantity?: number;
  soldCount?: number;
  discount?: number;
  discount_rate?: number;
  discountType?: 'PERCENTAGE' | 'FIXED' | string;
  discountValue?: number;
  discountStartDate?: string;
  discountEndDate?: string;
  createdAt: string;
  updatedAt: string;
  category?: { name?: string; title?: string };
  rating?: number;
}

export const PublicStorefront: React.FC = () => {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [shopName, setShopName] = useState(() => localStorage.getItem('companyName') || 'Marketplace');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [customer, setCustomer] = useState<{ id?: number; fullname: string; role: string; [key: string]: unknown } | null>(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      if (u.role === 'CUSTOMER') return u;
    }
    return null;
  });
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cartItems, setCartItems] = useState<{ product: StoreProduct; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { theme, setTheme: setStoreTheme } = useThemeStore();

  const [likedItems, setLikedItems] = useState<Set<number>>(new Set());
  const [savedItems, setSavedItems] = useState<Set<number>>(new Set());
  const settingsRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('fontSize') || 'medium');
  const [taxConfig, setTaxConfig] = useState<{ rate: number, inclusive: boolean }>({ rate: 0, inclusive: true });
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingProduct, setRatingProduct] = useState<StoreProduct | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (!selectedProduct?.imageUrl) return;
    const images = selectedProduct.imageUrl.split('|');
    if (images.length <= 1) return;
    
    if (distance > 50) setCurrentImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
    if (distance < -50) setCurrentImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const CUSTOM_CATEGORIES = [
    'Phone Accessories',
    'Stationery Services',
    'Stationery Items',
    'Phones and Computer Tech Solutions'
  ];





  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [categories]);

  const logCustomerAction = async (action: string, product: StoreProduct) => {
    try {
      await AuditService.log('CUSTOMER_ACTION', `Customer ${action} product: ${product.name}`);
      await api.post('/public/actions', {
        action,
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl?.split('|')[0] || null,
        discount: product.discount || 0,
        discount_rate: product.discount_rate || product.discount || 0,
        timestamp: new Date().toISOString()
      });
      
      try {
        const p = await db.products.get(product.id);
        if (p) {
          await db.products.update(product.id, {
            soldCount: (p.soldCount || 0) + 1,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error("Failed to update soldCount", e);
      }
    } catch (err) {
      console.error("Failed to add interaction", err);
    }
  };

  const handleFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem('fontSize', size);
    document.documentElement.setAttribute('data-font-size', size);
    setIsSettingsOpen(false);
  };

  const toggleLike = (id: number) => {
    const newLiked = new Set(likedItems);
    const isLiking = !newLiked.has(id);
    if (isLiking) newLiked.add(id);
    else newLiked.delete(id);
    setLikedItems(newLiked);
    toast.success(isLiking ? 'Added to favorites' : 'Removed from favorites');
    
    if (isLiking) {
      const product = products.find(p => p.id === id);
      if (product) logCustomerAction('LIKE', product);
    }
  };

  const addToCart = (product: StoreProduct, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!product.isService && (product.quantity === 0 || product.quantity === undefined)) {
      toast.error('This item is currently out of stock');
      return;
    }
    setCartItems(prev => {
      const exists = prev.find(item => item.product.id === product.id);
      if (exists) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      toast.success(`${product.name} added to cart`);
      return [...prev, { product, quantity: 1 }];
    });
    logCustomerAction('ADD_TO_CART', product);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.product.id === id) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const toggleSave = (id: number) => {
    const newSaved = new Set(savedItems);
    const isSaving = !newSaved.has(id);
    if (isSaving) newSaved.add(id);
    else newSaved.delete(id);
    setSavedItems(newSaved);
    toast.success(isSaving ? 'Saved for later' : 'Removed from saved items');
    
    if (isSaving) {
      const product = products.find(p => p.id === id);
      if (product) logCustomerAction('SAVE_FOR_LATER', product);
    }
  };


  const removeFromCart = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCartItems(prev => prev.filter(item => item.product.id !== id));
    toast.success('Removed from cart');
  };

  const scrollToProduct = (id: number) => {
    setIsCartOpen(false);
    const element = document.getElementById(`product-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-4', 'ring-primary-500', 'ring-opacity-50');
      setTimeout(() => {
        element.classList.remove('ring-4', 'ring-primary-500', 'ring-opacity-50');
      }, 2000);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart !== null) {
      const touchEnd = e.changedTouches[0].clientY;
      const distance = touchEnd - touchStart;
      if (distance > 150) {
        loadStorefront(true);
      }
      setTouchStart(null);
    }
  };

  const [whatsappNumber, setWhatsappNumber] = useState('+265993732694');
  const [shopLogo, setShopLogo] = useState('');

  const loadStorefront = async (background = false) => {
    if (!background) setLoading(true);
    else setIsRefreshing(true);

    try {
      const [productsRes, settingsRes] = await Promise.all([
        api.get('/public/products'),
        api.get('/public/settings'),
      ]);

      if (productsRes.data.success) {
        const data = productsRes.data.data;
        const localProducts = await db.products.toArray();
        const mergedData = data.map((p: StoreProduct) => {
          const localP = localProducts.find(lp => lp.id === p.id);
          return {
            ...p,
            discount: p.discount ?? p.discount_rate ?? localP?.discount ?? 0,
            discountType: p.discountType ?? localP?.discountType,
            discountValue: p.discountValue ?? localP?.discountValue,
            discountStartDate: p.discountStartDate ?? localP?.discountStartDate,
            discountEndDate: p.discountEndDate ?? localP?.discountEndDate,
            rating: p.rating ?? 1,
          };
        });
        setProducts(mergedData);
        const cats = Array.from(new Set(mergedData.map((p: StoreProduct) => p.category?.name || 'Uncategorized')))
          .filter((c: unknown) => c !== 'Uncategorized') as string[];
        setCategories(cats);
      }

      if (settingsRes.data.success && settingsRes.data.data) {
        const s = settingsRes.data.data;
        if (s.companyName) setShopName(s.companyName);
        if (s.whatsapp) setWhatsappNumber(s.whatsapp);
        if (s.logo) setShopLogo(s.logo);
        
        // Load tax and discount settings from server
        if (s.tax_config) setTaxConfig(typeof s.tax_config === 'string' ? JSON.parse(s.tax_config) : s.tax_config);
        
        if (s.global_discount !== undefined) setGlobalDiscount(Number(s.global_discount));
      }
    } catch (err) {
      console.error('Storefront load error (falling back to offline data):', err);
      
      // OFFLINE FALLBACK: Load from local IndexedDB
      const [localProducts, localCats, localTax, localDiscount, localCompany] = await Promise.all([
        db.products.toArray(),
        db.categories.toArray(),
        db.settings.get('tax_config'),
        db.settings.get('global_discount'),
        db.settings.get('company_config')
      ]);

      if (localProducts.length > 0) {
        const productsWithCats = localProducts.map(p => ({
          ...p,
          category: { name: localCats.find(c => c.id === p.categoryId)?.title || 'Uncategorized' }
        }));
        setProducts(productsWithCats as unknown as StoreProduct[]);
        const cats = Array.from(new Set(productsWithCats.map((p) => p.category.name)))
          .filter((c) => c !== 'Uncategorized') as string[];
        setCategories(cats);
        toast('Operating in offline mode', { icon: '📡' });
      } else {
        toast.error('Marketplace is offline and no local data found.');
      }

      if (localTax?.value) setTaxConfig(localTax.value as { rate: number; inclusive: boolean });
      if (localDiscount?.value) setGlobalDiscount(localDiscount.value as number);
      if (localCompany?.value) setShopName((localCompany.value as { name: string }).name);

    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };


  const handleAuthSuccess = (_token: string, user: { fullname: string; role: string; [key: string]: unknown }) => {
    setCustomer(user);
    setSelectedProduct(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCustomer(null);
    toast.success('Signed out');
  };

  const handleOpenRating = (product: StoreProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    setRatingProduct(product);
    setIsRatingModalOpen(true);
  };

  const submitRating = async () => {
    if (!ratingProduct) return;
    try {
      await api.post(`/public/products/${ratingProduct.id}/rate`, {
        productId: ratingProduct.id,
        rating: ratingValue,
        comment: ratingComment,
        customerId: customer?.id
      });
      
      await AuditService.log('PRODUCT_RATED', `Customer rated ${ratingProduct.name} with ${ratingValue} stars. Comment: ${ratingComment}`);
      
      // Update local state to reflect the new rating count immediately
      setProducts(prev => prev.map(p => 
        p.id === ratingProduct.id ? { ...p, rating: (p.rating || 1) + 1 } : p
      ));

      toast.success("Thank you for your rating!");
      setIsRatingModalOpen(false);
      setRatingComment('');
      setRatingValue(5);
    } catch (err) {
      console.error("Rating error:", err);
      toast.error("Failed to submit rating");
    }
  };

  useEffect(() => {
    loadStorefront();
    const interval = setInterval(() => loadStorefront(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const catName = p.category?.title || p.category?.name || 'Uncategorized';
    const matchesCategory = selectedCategory === 'All' || catName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div 
      className="h-screen flex flex-col bg-background text-foreground transition-colors duration-300 selection:bg-primary/30 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {isRefreshing && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] glass-panel text-primary p-2 rounded-full shadow-xl flex items-center justify-center animate-in fade-in slide-in-from-top-4 duration-500 border border-border/50">
          <RefreshCw className="w-4 h-4 animate-spin" />
        </div>
      )}

      <div className="fixed top-0 left-0 right-0 z-50">
        <header className="bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="w-full px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-primary/20 bg-muted/10 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
              {shopLogo ? (
                <img src={shopLogo} alt={shopName} className="w-full h-full object-cover" />
              ) : (
                <ShoppingBag className="w-4 h-4 text-primary" />
              )}
            </div>
            <h1 className="text-lg font-medium tracking-tighter">{shopName}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {customer && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden md:block">
                  <div className="flex items-center justify-end gap-1 mb-0.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[8px] font-medium tracking-widest text-muted-foreground/60 capitalize">Online</span>
                  </div>
                  <p className="text-[10px] font-medium">{customer.fullname}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-8 h-8 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all"
                  title="Sign Out"
                >
                  <UserIcon className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="w-8 h-8 glass-card border border-border/50 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-all btn-press"
                title="Settings & Accessibility"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative group"
              >
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                {cartItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-medium rounded-full flex items-center justify-center border-2 border-background">
                    {cartItems.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

        {/* Unified compact toolbar: title | category dropdown | search — fixed below header */}
        <div className="w-full bg-background/95 backdrop-blur-xl border-b border-border/50">
          <div className="w-full px-4 py-3 flex items-center justify-between gap-3">

            {/* Market Place title */}
            <div className="shrink-0">
              <h2 className="text-xs font-medium tracking-tighter leading-none text-primary">Market Place</h2>
              <p className="text-[8px] font-medium text-muted-foreground/50 mt-0.5 tracking-widest">Premium Products &amp; Services</p>
            </div>

            <div className="flex items-center justify-end gap-2 md:gap-3 flex-1 min-w-0">
              {/* Category dropdown */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setIsCategoryOpen(v => !v)}
                  className="flex items-center gap-1.5 h-8 px-3 bg-surface-card border border-border rounded-full text-[10px] font-medium text-foreground hover:border-primary transition-all"
                >
                  <span className="max-w-[80px] md:max-w-[120px] truncate">
                    {selectedCategory === 'All' ? 'All Items' : selectedCategory}
                  </span>
                  <svg className="w-3 h-3 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isCategoryOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsCategoryOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-50 bg-surface-card border border-border/50 rounded-2xl shadow-2xl py-1.5 min-w-[180px] overflow-hidden">
                      {['All', ...CUSTOM_CATEGORIES, ...categories.filter(c => !CUSTOM_CATEGORIES.includes(c))].map(cat => (
                        <button
                          key={cat}
                          onClick={() => { setSelectedCategory(cat === 'All' ? 'All' : cat); setIsCategoryOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-[10px] font-medium tracking-wide transition-colors ${
                            selectedCategory === (cat === 'All' ? 'All' : cat)
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          }`}
                        >
                          {cat === 'All' ? 'All Items' : cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Search */}
              <div className="relative w-full max-w-[130px] sm:max-w-[200px] md:max-w-xs lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Search"
                  className="w-full h-8 py-0 pl-9 pr-8 bg-surface-card border border-border rounded-full outline-none focus:border-primary font-medium text-xs shadow-sm transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-muted-foreground/40 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
    </div>

    <main className="flex-1 overflow-y-auto overflow-x-hidden w-full pt-[136px] md:pt-[136px]">

      <div className="py-4">
        {loading ? (
          <div className="py-32 text-center flex flex-col items-center gap-8">
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-primary" />
              <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full animate-pulse"></div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] font-medium tracking-[0.5em] text-muted-foreground/30 capitalize animate-pulse">Establishing Connection...</p>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Package className="w-16 h-16 text-muted-foreground/10 mb-4" />
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground/30">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filteredProducts.map(p => {
              const { hasDiscount, finalPrice, badgeText } = calculateEffectiveDiscount(p as unknown as Parameters<typeof calculateEffectiveDiscount>[0]);

              return (
                <div key={p.id} className="px-1.5 pb-1.5 mb-1.5 border-b border-surface-border/30">
                  <div 
                    id={`product-${p.id}`}
                    onClick={() => { setSelectedProduct(p as StoreProduct); setCurrentImageIndex(0); }}
                    className="group relative bg-surface-card border-2 border-surface-border rounded-[1.5rem] md:rounded-[2rem] overflow-hidden transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1 flex flex-col h-full cursor-pointer"
                  >


                  <div className="aspect-square bg-muted/10 border-b border-border/30 flex items-center justify-center relative overflow-hidden shrink-0">
                    <img 
                      src={p.imageUrl?.split('|')[0] || "/premium-item.png"} 
                      alt={p.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    />

                  </div>
                  
                  <div className="p-4 md:p-6 flex flex-col flex-1">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="text-[7px] md:text-[9px] font-medium text-primary tracking-[0.3em] opacity-60">
                          {p.category?.name || 'FEATURED'}
                        </div>
                      </div>
                      <h3 className="font-medium text-xs md:text-lg tracking-tight leading-tight group-hover:text-primary transition-colors mb-2 flex flex-wrap items-center gap-2">
                        {toSentenceCase(p.name)}
                        {(p.soldCount || 0) > 0 && (
                          <span className="text-[7px] md:text-[9px] font-medium text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">
                            {p.soldCount}+ sold
                          </span>
                        )}
                      </h3>
                      {!p.isService && p.quantity !== undefined && (
                        <div className={`text-[9px] font-medium tracking-widest ${p.quantity > 5 ? 'text-emerald-500' : p.quantity > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                          {p.quantity > 5 ? 'In Stock' : p.quantity > 0 ? 'Low Stock' : 'Out of Stock'}
                        </div>
                      )}
                    </div>
                      <div className="mt-auto pt-3 border-t border-border/30 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            {hasDiscount && (
                              <p className="font-medium text-muted-foreground/40 line-through text-[9px]">
                                {formatCurrency(Number(p.sellPrice ?? 0))}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              <p className={`font-medium tracking-tighter leading-none ${hasDiscount ? 'text-sm text-red-500' : 'text-sm text-primary'}`}>
                                {formatCurrency(hasDiscount ? finalPrice : Number(p.sellPrice ?? 0))}
                              </p>
                              {hasDiscount && (
                                <span className="bg-red-500 text-white text-[7px] font-medium px-1.5 py-0.5 rounded">{badgeText}</span>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); addToCart(p, e); }}
                            title="Add to cart"
                            className="shrink-0 h-9 px-3 bg-primary text-primary-foreground rounded-xl flex items-center gap-1.5 text-[10px] font-medium transition-all active:scale-95 shadow-md shadow-primary/20 hover:-translate-y-0.5"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" /> Add
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleLike(p.id); }}
                            title={likedItems.has(p.id) ? "Unlike" : "Favourite"}
                            className={`py-2.5 rounded-xl flex items-center justify-center transition-all btn-press ${
                              likedItems.has(p.id) 
                                ? 'bg-rose-500 text-white' 
                                : 'glass-card border border-border/50 text-muted-foreground hover:text-rose-500'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${likedItems.has(p.id) ? 'fill-current' : ''}`} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const number = whatsappNumber || '265993732694';
                              const msg = encodeURIComponent(`Hello, I'm interested in ${p.name} priced at ${formatCurrency(finalPrice)}. Is it available?`);
                              window.open(`https://wa.me/${number.replace('+', '')}?text=${msg}`, '_blank');
                            }}
                            className="py-2.5 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 rounded-xl hover:bg-[#25D366] hover:text-white transition-all flex items-center justify-center active:scale-95"
                            title="WhatsApp"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleSave(p.id); }}
                            className={`py-2.5 rounded-xl flex items-center justify-center transition-all btn-press ${
                              savedItems.has(p.id) 
                                ? 'bg-primary text-primary-foreground' 
                                : 'glass-card border border-border/50 text-muted-foreground hover:text-primary'
                            }`}
                            title="Save"
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${savedItems.has(p.id) ? 'fill-current' : ''}`} />
                          </button>
                          <button 
                            onClick={(e) => handleOpenRating(p, e)}
                            className="py-2.5 glass-card border border-border/50 rounded-xl text-muted-foreground hover:text-amber-500 hover:border-amber-500/30 transition-all flex items-center justify-center gap-1 btn-press"
                            title="Rate"
                          >
                            <svg className="w-3 h-3 fill-current text-amber-500" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            <span className="text-[9px] font-medium text-amber-500">{p.rating || 1}</span>
                          </button>
                        </div>
                      </div>
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>

      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setIsCartOpen(false)}></div>
          
          <div className="relative w-full max-w-xl glass-panel border border-border/50 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-medium tracking-tighter">Your selection</h3>
                <p className="text-[10px] font-medium tracking-widest text-muted-foreground/60 mt-1 capitalize">Review items in your cart</p>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                title="Close cart"
                className="w-10 h-10 glass-card border border-border/50 rounded-full flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-all btn-press"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6 md:p-8 space-y-4 no-scrollbar">
              {cartItems.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground/10 mb-4" />
                  <p className="text-[10px] font-medium tracking-widest text-muted-foreground/30">Your cart is empty</p>
                </div>
              ) : (
                cartItems.map(item => (
                  <div 
                    key={item.product.id} 
                    className="group glass-card border border-border/50 p-4 rounded-2xl flex items-center gap-4 hover:border-primary/30 transition-all cursor-pointer"
                    onClick={() => scrollToProduct(item.product.id)}
                  >
                    <div className="w-16 h-16 glass-card border border-border/30 rounded-xl overflow-hidden shrink-0">
                      <img src={item.product.imageUrl?.split('|')[0] || '/premium-item.png'} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-primary tracking-widest mb-0.5">{item.product.category?.name ? item.product.category.name.charAt(0).toUpperCase() + item.product.category.name.slice(1).toLowerCase() : 'Item'}</p>
                      <h4 className="font-medium text-sm truncate">{item.product.name.charAt(0).toUpperCase() + item.product.name.slice(1).toLowerCase()}</h4>
                      <div className="flex items-center gap-4 mt-2">
                        <p className="text-xs font-medium text-muted-foreground/60">{formatCurrency(Number(item.product.sellPrice ?? 0))}</p>
                        <div className="flex items-center bg-muted/10 rounded-lg border border-border/30 p-1" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => updateQuantity(item.product.id, -1)}
                            title="Decrease quantity"
                            aria-label="Decrease quantity"
                            className="w-6 h-6 flex items-center justify-center hover:bg-primary/10 rounded-md transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-[10px] font-medium">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.product.id, 1)}
                            title="Increase quantity"
                            aria-label="Increase quantity"
                            className="w-6 h-6 flex items-center justify-center hover:bg-primary/10 rounded-md transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); scrollToProduct(item.product.id); }}
                        title="View product"
                        className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => removeFromCart(item.product.id, e)}
                        title="Remove from cart"
                        className="w-8 h-8 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-8 bg-muted/5 border-t border-border/50 flex flex-col gap-4">
              {(() => {
                const subtotal = cartItems.reduce((acc, item) => {
                  const { finalPrice } = calculateEffectiveDiscount(item.product as unknown as Parameters<typeof calculateEffectiveDiscount>[0]);
                  return acc + (finalPrice * item.quantity);
                }, 0);
                
                let taxAmount = 0;
                // Force tax to be added on top (exclusive) to match user's expected math: 7500 + 37.31 = 7537.31
                if (taxConfig.rate > 0) {
                  taxAmount = subtotal * (taxConfig.rate / 100);
                }
                const total = subtotal + taxAmount;
                return (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground/60 tracking-widest">
                      <span>Subtotal {globalDiscount > 0 && `(with ${globalDiscount}% discount)`}</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {taxConfig.rate > 0 && (
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground/60 tracking-widest">
                        <span>Tax ({taxConfig.rate}% added)</span>
                        <span>+ {formatCurrency(taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-border/50 pt-4 mt-2">
                      <div>
                        <p className="text-sm font-medium text-foreground tracking-widest capitalize">Grand total</p>
                        <p className="text-[10px] font-medium text-muted-foreground/40 capitalize tracking-widest">Total including taxes</p>
                      </div>
                      <p className="text-3xl font-medium text-primary tracking-tighter">
                        {formatCurrency(total)}
                      </p>
                    </div>
                  </div>
                );
              })()}
              <div className="flex flex-col gap-3">

                <button 
                  onClick={() => {
                    if (cartItems.length === 0) return;
                    let message = '*NEW BUY REQUEST*\n\nHello! I would like to buy:\n\n';
                    cartItems.forEach((item, index) => {
                      message += `${index + 1}. *${item.product.name}* (Qty: ${item.quantity})\n`;
                    });
                    const encodedMessage = encodeURIComponent(message);
                    window.open(`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`, '_blank');
                  }}
                  className="w-full py-5 bg-[#25D366] text-white rounded-2xl text-xs font-medium tracking-[0.2em] shadow-xl shadow-[#25D366]/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Confirm Buy via WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setSelectedProduct(null)}></div>
            <div className="relative w-full max-w-4xl bg-surface-card border border-border/50 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col md:flex-row max-h-[90vh]">


              <div className="w-full md:w-1/2 bg-gradient-to-br from-muted/10 to-muted/30 flex items-center justify-center p-12 relative shrink-0 min-h-[300px]">
                 {(() => {
                   const { hasDiscount, badgeText } = calculateEffectiveDiscount(selectedProduct as unknown as Parameters<typeof calculateEffectiveDiscount>[0]);
                   return (
                     <div className="absolute top-6 left-6 flex flex-col gap-2 pointer-events-none z-10">
                       <span className={`text-[10px] font-medium px-4 py-1.5 rounded-full shadow-lg capitalize tracking-widest border border-white/20 backdrop-blur-md w-fit ${selectedProduct.isService ? 'bg-primary text-primary-foreground' : 'bg-emerald-600 text-white'}`}>
                         {selectedProduct.isService ? 'Service' : 'Product'}
                       </span>
                       {hasDiscount && (
                         <span className="bg-red-500 text-white text-[10px] font-medium px-4 py-1.5 rounded-full shadow-lg capitalize tracking-widest border border-white/20 backdrop-blur-md w-fit animate-pulse">
                           {badgeText}
                         </span>
                       )}
                       {selectedProduct.discountEndDate && new Date(selectedProduct.discountEndDate) > new Date() && (
                         <span className="bg-amber-500 text-white text-[10px] font-medium px-4 py-1.5 rounded-full shadow-lg capitalize tracking-widest border border-white/20 backdrop-blur-md w-fit">
                           ⏳ Limited Time Offer
                         </span>
                       )}
                     </div>
                   );
                 })()}
                
                <div 
                  className="flex flex-col items-center w-full max-w-[90vw] md:max-w-[50vw] flex-1"
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  <div className="w-full flex-1 relative mb-4 flex items-center justify-center min-h-[300px] cursor-pointer group">
                    {selectedProduct.imageUrl && selectedProduct.imageUrl.split('|').length > 1 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev === 0 ? selectedProduct.imageUrl!.split('|').length - 1 : prev - 1); }}
                        className="absolute left-2 md:left-4 z-10 p-2 rounded-full bg-black/20 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/40"
                      >
                        <ChevronRight className="w-6 h-6 rotate-180" />
                      </button>
                    )}
                    
                    <img 
                      onClick={() => {
                        if (selectedProduct.imageUrl) {
                          const images = selectedProduct.imageUrl.split('|');
                          if (images.length > 1) {
                            setCurrentImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
                          }
                        }
                      }}
                      src={selectedProduct.imageUrl?.split('|')[currentImageIndex] || selectedProduct.imageUrl?.split('|')[0] || '/premium-item.png'} 
                      className="max-w-full max-h-[50vh] md:max-h-[75vh] w-auto h-auto object-contain drop-shadow-2xl transition-transform duration-500" 
                      alt={selectedProduct.name} 
                    />

                    {selectedProduct.imageUrl && selectedProduct.imageUrl.split('|').length > 1 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev === selectedProduct.imageUrl!.split('|').length - 1 ? 0 : prev + 1); }}
                        className="absolute right-2 md:right-4 z-10 p-2 rounded-full bg-black/20 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/40"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                  {selectedProduct.imageUrl && selectedProduct.imageUrl.split('|').length > 1 && (
                    <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar w-full justify-center mt-auto">
                      {selectedProduct.imageUrl.split('|').map((img, i) => (
                        <button 
                          title={`View image ${i + 1}`} aria-label={`View image ${i + 1}`}
                          key={i} 
                          onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i); }}
                          className={`w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${currentImageIndex === i ? 'border-primary shadow-lg scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        >
                          <img src={img} className="w-full h-full object-cover" alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col overflow-y-auto custom-scrollbar">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-medium text-primary tracking-[0.2em] capitalize bg-primary/10 px-3 py-1 rounded-full">{selectedProduct.category?.name || 'FEATURED'}</p>
                  <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span className="text-[11px] font-medium mt-0.5">{selectedProduct.soldCount ? (selectedProduct.soldCount * 4.8).toFixed(1) : '4.9'}</span>
                  </div>
                </div>
                
                <h2 className="text-2xl md:text-3xl font-medium tracking-tighter leading-tight mb-6">{toSentenceCase(selectedProduct.name)}</h2>
                
                {(() => {
                   const { hasDiscount, finalPrice } = calculateEffectiveDiscount(selectedProduct as unknown as Parameters<typeof calculateEffectiveDiscount>[0]);
                   return (
                     <div className="flex items-end gap-3 mb-8 p-5 bg-gradient-to-r from-primary/5 to-transparent rounded-2xl border-l-4 border-primary">
                       {hasDiscount ? (
                         <>
                           <p className="text-4xl font-medium text-red-500 tracking-tighter">{formatCurrency(finalPrice)}</p>
                           <p className="text-sm font-medium text-muted-foreground/40 line-through mb-1.5">{formatCurrency(Number(selectedProduct.sellPrice ?? 0))}</p>
                         </>
                       ) : (
                         <p className="text-4xl font-medium text-primary tracking-tighter">{formatCurrency(Number(selectedProduct.sellPrice ?? 0))}</p>
                       )}
                     </div>
                   );
                })()}

                <div className="mb-8 flex-1">
                  <h4 className="text-[10px] font-medium text-muted-foreground/60 capitalize tracking-widest mb-4 flex items-center gap-2">
                     <span className="w-6 h-px bg-muted-foreground/30"></span> Description
                  </h4>
                  <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                    {selectedProduct.description || `Experience the best of ${toSentenceCase(selectedProduct.name)}. This premium ${selectedProduct.isService ? 'service' : 'item'} is designed to deliver exceptional value and quality. Enjoy top-tier craftsmanship and reliable performance that meets all your expectations.`}
                  </p>
                  
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 bg-muted/10 p-3 rounded-xl border border-border/50">
                       <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4 text-emerald-500" />
                       </div>
                       <span className="text-[10px] font-medium capitalize tracking-widest text-foreground/70">Premium Quality</span>
                    </div>
                    <div className="flex items-center gap-3 bg-muted/10 p-3 rounded-xl border border-border/50">
                       <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4 text-emerald-500" />
                       </div>
                       <span className="text-[10px] font-medium capitalize tracking-widest text-foreground/70">Verified & Trusted</span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-border/50 flex gap-4 bg-surface-card sticky bottom-0">
                  <button 
                    title={likedItems.has(selectedProduct.id) ? "Unlike" : "Like"} aria-label={likedItems.has(selectedProduct.id) ? "Unlike" : "Like"}
                    onClick={() => {
                       toggleLike(selectedProduct.id);
                    }}
                    className={`h-14 w-14 rounded-2xl border-2 flex items-center justify-center transition-all btn-press shrink-0 ${
                      likedItems.has(selectedProduct.id) 
                        ? 'bg-rose-50 text-rose-500 border-rose-200' 
                        : 'bg-background text-muted-foreground border-border/50 hover:bg-muted/10 hover:border-border'
                    }`}
                  >
                    <Heart className={`w-6 h-6 ${likedItems.has(selectedProduct.id) ? 'fill-current' : ''}`} />
                  </button>
                  <button 
                    onClick={(e) => {
                       addToCart(selectedProduct, e);
                       setSelectedProduct(null);
                    }}
                    className="flex-1 h-14 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center gap-3 text-[11px] font-medium tracking-[0.2em] capitalize shadow-xl shadow-primary/20 hover:-translate-y-1 transition-all btn-press"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <CustomerAuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onSuccess={handleAuthSuccess}
      />

      <AnimatePresence>
        {isRatingModalOpen && ratingProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setIsRatingModalOpen(false)}></div>
            <div className="relative w-full max-w-sm glass-panel border border-border/50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-medium tracking-tighter">Rate this {ratingProduct.isService ? 'service' : 'product'}</h3>
                <p className="text-[10px] font-medium tracking-widest text-muted-foreground/40 capitalize mt-1">Your feedback helps others</p>
              </div>

              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map(star => (
                  <button 
                    key={star}
                    onClick={() => setRatingValue(star)}
                    title={`Rate ${star} stars`}
                    aria-label={`Rate ${star} stars`}
                    className={`transition-all ${ratingValue >= star ? 'text-amber-500 scale-125' : 'text-muted-foreground/10'}`}
                  >
                    <svg className="w-8 h-8 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
              </div>

              <textarea 
                placeholder="Write a brief comment (optional)..."
                className="w-full p-4 bg-muted/10 border border-border/50 rounded-2xl text-[10px] font-medium outline-none focus:border-primary min-h-[100px] mb-6 resize-none"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
              />

              <div className="flex flex-col gap-3">
                <button 
                  onClick={submitRating}
                  className="w-full py-4 bg-primary text-primary-foreground rounded-2xl text-[10px] font-medium tracking-widest shadow-xl shadow-primary/30 btn-press transition-all capitalize"
                >
                  Submit Feedback
                </button>
                <button 
                  onClick={() => setIsRatingModalOpen(false)}
                  className="w-full py-4 glass-card text-muted-foreground rounded-2xl text-[10px] font-medium tracking-widest transition-all capitalize btn-press"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-background/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-surface-card border border-border/50 rounded-3xl shadow-2xl relative z-10 p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-medium tracking-tighter text-primary">Settings</h3>

              </div>
              
              <div className="space-y-8">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground/60 mb-3 ml-1 capitalize">Theme</p>
                  <div className="flex gap-3">
                    {['light', 'dark', 'system'].map(t => (
                      <button 
                        key={t}
                        onClick={() => {
                          setStoreTheme(t as any);
                          setIsSettingsOpen(false);
                        }} 
                        className={`flex-1 py-3 rounded-xl text-[10px] font-medium capitalize tracking-widest transition-all btn-press ${theme === t ? 'bg-primary text-primary-foreground shadow-lg' : 'glass-card border border-border/50 text-muted-foreground hover:bg-muted/50'}`}
                      >
                        {t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : '💻 System'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-medium text-muted-foreground/60 mb-3 ml-1 capitalize">Font size</p>
                  <div className="flex gap-3">
                    {['small', 'medium', 'large'].map(s => (
                      <button 
                        key={s}
                        onClick={() => { handleFontSize(s); setIsSettingsOpen(false); }}
                        className={`flex-1 py-3 text-[10px] font-medium rounded-xl transition-all btn-press ${fontSize === s ? 'bg-primary text-primary-foreground shadow-lg' : 'glass-card border border-border/50 text-muted-foreground hover:bg-muted/50'}`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <p className="text-[10px] font-medium text-muted-foreground/60 mb-3 ml-1 capitalize">App Access</p>
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                    <p className="text-xs font-medium text-primary leading-relaxed">
                      For the best experience, add this store to your home screen via your browser menu (Install App or Add to Home Screen).
                    </p>
                  </div>
                </div>

                {customer && (
                  <div className="pt-6 border-t border-border/20">
                    <button 
                      onClick={async () => {
                        if (confirm("Are you sure you want to PERMANENTLY DELETE your account? This action cannot be undone.")) {
                          try {
                            await api.delete('/customer/account');
                            handleLogout();
                            setIsSettingsOpen(false);
                            toast.success("Account deleted successfully");
                          } catch {
                            toast.error("Failed to delete account");
                          }
                        }
                      }}
                      className="w-full py-4 bg-rose-500/10 text-rose-500 rounded-xl text-[10px] font-medium capitalize tracking-widest hover:bg-rose-500 hover:text-white transition-all btn-press"
                    >
                      Delete Account
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AppFooter />
    </div>

  );
};

export default PublicStorefront;
