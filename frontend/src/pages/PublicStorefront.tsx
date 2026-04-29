import React, { useState, useEffect, useRef } from 'react';
import { Package, Search, MessageSquare, ShoppingBag, Loader2, User as UserIcon, Heart, Plus, ShoppingCart, X, ArrowRight, Settings, Bookmark } from 'lucide-react';
import { SyncService } from '../services/SyncService';
import { AuditService } from '../services/AuditService';
import { formatCurrency } from '../utils/phoneUtils';
import { db } from '../db/posDB';
import toast from 'react-hot-toast';
import api from '../api/client';
import CustomerAuthModal from '../components/CustomerAuthModal';
import { calculateEffectiveDiscount } from '../utils/discountUtils';

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
}

export const PublicStorefront: React.FC = () => {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [shopName, setShopName] = useState(() => localStorage.getItem('companyName') || 'Marketplace');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [customer, setCustomer] = useState<{ fullname: string; role: string; [key: string]: unknown } | null>(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      if (u.role === 'CUSTOMER') return u;
    }
    return null;
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cartItems, setCartItems] = useState<StoreProduct[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null) || 'system';
  });
  const [likedItems, setLikedItems] = useState<Set<number>>(new Set());
  const [savedItems, setSavedItems] = useState<Set<number>>(new Set());
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('fontSize') || 'medium');
  const [taxConfig, setTaxConfig] = useState<{ rate: number, inclusive: boolean }>({ rate: 0, inclusive: true });
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);

  const CUSTOM_CATEGORIES = [
    'Phone Accessories',
    'Stationery Services',
    'Stationery Items',
    'Phones and Computer Tech Solutions'
  ];

  useEffect(() => {
    const activeTheme = theme;
    if (activeTheme !== 'system') {
      document.documentElement.classList.toggle('dark', activeTheme === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, [theme]);

  const toggleTheme = () => {
    let newTheme: 'light' | 'dark' | 'system';
    if (theme === 'system') newTheme = 'light';
    else if (theme === 'light') newTheme = 'dark';
    else newTheme = 'system';

    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    }
  };

  const checkCategoryScroll = () => {
    const el = categoryNavRef.current;
    if (!el) return;
    const leftFade = document.getElementById('fade-left');
    const rightFade = document.getElementById('fade-right');
    if (leftFade) leftFade.style.opacity = el.scrollLeft > 20 ? '1' : '0';
    if (rightFade) rightFade.style.opacity = el.scrollLeft < (el.scrollWidth - el.clientWidth - 20) ? '1' : '0';
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    checkCategoryScroll();
    window.addEventListener('resize', checkCategoryScroll);
    return () => {
      window.removeEventListener('resize', checkCategoryScroll);
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
        imageUrl: product.imageUrl || null,
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
    setCartItems(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) return prev;
      toast.success(`${product.name} added to cart`);
      return [...prev, product];
    });
    logCustomerAction('ADD_TO_CART', product);
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
    setCartItems(prev => prev.filter(item => item.id !== id));
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
        else {
          const localTax = await db.settings.get('tax_config');
          if (localTax?.value) setTaxConfig(localTax.value as { rate: number; inclusive: boolean });
        }

        if (s.global_discount !== undefined) setGlobalDiscount(Number(s.global_discount));
        else {
          const localDiscount = await db.settings.get('global_discount');
          if (localDiscount?.value) setGlobalDiscount(localDiscount.value as number);
        }
      }
    } catch (err) {
      console.error('Storefront load error:', err);
      toast.error('Failed to load marketplace. Please refresh.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };


  const handleInquiry = async (product: StoreProduct) => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    if (!token || user?.role !== 'CUSTOMER') {
      await SyncService.pushProduct(product as unknown as Parameters<typeof SyncService.pushProduct>[0]);
      setSelectedProduct(product);
      setIsAuthOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/inquiries', {
        items: [{ id: product.id, name: product.name, price: Number(product.sellPrice ?? 0) }]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Inquiry sent successfully!');
    } catch {
      toast.error('Failed to send inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuthSuccess = (_token: string, user: { fullname: string; role: string; [key: string]: unknown }) => {
    setCustomer(user);
    if (selectedProduct) {
      handleInquiry(selectedProduct);
      setSelectedProduct(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCustomer(null);
    toast.success('Signed out');
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
      className="min-h-screen flex flex-col bg-surface-bg text-surface-text transition-colors duration-300 selection:bg-primary-500/30 overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {isRefreshing && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-primary-500 text-white p-3 rounded-full shadow-2xl flex items-center justify-center animate-in fade-in slide-in-from-top-4 duration-500 border-2 border-white/20">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      <div className="fixed top-0 left-0 right-0 z-50">
        <header className="bg-surface-bg/80 backdrop-blur-xl border-b border-surface-border">
        <div className="w-full px-6 md:px-12 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-primary-500/20 bg-surface-bg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
              {shopLogo ? (
                <img src={shopLogo} alt={shopName} className="w-full h-full object-cover" />
              ) : (
                <ShoppingBag className="w-4 h-4 text-primary-500" />
              )}
            </div>
            <h1 className="text-lg font-black tracking-tighter">{shopName}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {customer && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden md:block">
                  <div className="flex items-center justify-end gap-1 mb-0.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[8px] font-black tracking-widest text-surface-text/30 uppercase">Online</span>
                  </div>
                  <p className="text-[10px] font-black">{customer.fullname}</p>
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
              <div className="relative" ref={settingsRef}>
                <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="w-8 h-8 bg-surface-card border border-surface-border rounded-full flex items-center justify-center text-surface-text/60 hover:text-primary-500 transition-all text-xs"
                  title="Settings & Accessibility"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {isSettingsOpen && (
                  <div className="absolute top-12 right-0 w-56 bg-surface-card border border-surface-border rounded-2xl shadow-2xl p-6 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <h4 className="text-[10px] font-black tracking-widest uppercase text-primary-500 mb-5">Personalization</h4>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-bold text-surface-text/40 mb-3 ml-1">Theme</p>
                        <button 
                          onClick={() => { toggleTheme(); setIsSettingsOpen(false); }} 
                          className="w-full py-3 bg-surface-bg border border-surface-border rounded-xl text-[10px] font-black hover:bg-primary-500 hover:text-white transition-all uppercase tracking-widest"
                        >
                          {theme === 'light' ? '☀️ Light' : theme === 'dark' ? '🌙 Dark' : '💻 System'}
                        </button>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-surface-text/40 mb-3 ml-1">Font size</p>
                        <div className="flex gap-2">
                          {['small', 'medium', 'large'].map(s => (
                            <button 
                              key={s}
                              onClick={() => { handleFontSize(s); setIsSettingsOpen(false); }}
                              className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${fontSize === s ? 'bg-primary-500 text-white shadow-lg' : 'bg-surface-bg border border-surface-border text-surface-text/40 hover:bg-surface-border/50'}`}
                            >
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative group"
              >
                <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                {cartItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-surface-bg">
                    {cartItems.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full bg-surface-bg/80 backdrop-blur-xl border-b border-surface-border relative">
        <div id="fade-left" className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-surface-bg via-surface-bg/60 to-transparent z-10 pointer-events-none opacity-0 transition-opacity duration-500"></div>
        <div id="fade-right" className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-surface-bg via-surface-bg/60 to-transparent z-10 pointer-events-none transition-opacity duration-500"></div>

        <div 
          ref={categoryNavRef}
          className="w-full px-6 md:px-12 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth relative"
          onScroll={checkCategoryScroll}
        >
          <button 
            onClick={() => setSelectedCategory('All')}
            className={`px-6 py-2 rounded-full text-[9px] font-black tracking-widest transition-all whitespace-nowrap ${
              selectedCategory === 'All' 
                ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' 
                : 'bg-surface-card border border-surface-border text-surface-text/40 hover:text-surface-text'
            }`}
          >
            ALL ITEMS
          </button>
          {CUSTOM_CATEGORIES.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-2 rounded-full text-[9px] font-black tracking-widest transition-all whitespace-nowrap ${
                selectedCategory === cat 
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' 
                  : 'bg-surface-card border border-surface-border text-surface-text/40 hover:text-surface-text'
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
          {categories.filter(c => !CUSTOM_CATEGORIES.includes(c)).map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-2 rounded-full text-[9px] font-black tracking-widest transition-all whitespace-nowrap ${
                selectedCategory === cat 
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' 
                  : 'bg-surface-card border border-surface-border text-surface-text/40 hover:text-surface-text'
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>

    <main className="flex-1 w-full pt-[130px] md:pt-[150px]">
      <div className="w-full bg-surface-bg border-b border-surface-border/50 transition-colors">
        <div className="w-full px-6 md:px-12 py-6 md:py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="text-xl md:text-3xl font-black tracking-tighter leading-none text-primary-500">Market Place</h2>
            <p className="text-[10px] md:text-[14px] font-black text-surface-text/60 mt-1"> Premium Products & Services</p>
          </div>
          
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search"
              className="w-full py-4 pl-14 pr-12 bg-surface-card border border-surface-border rounded-full outline-none focus:border-primary-500 font-bold text-xs shadow-lg transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-surface-text/20 hover:text-rose-500 transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 md:px-12 py-8">
        {loading ? (
          <div className="py-32 text-center flex flex-col items-center gap-8">
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-primary-500" />
              <div className="absolute inset-0 blur-2xl bg-primary-500/20 rounded-full animate-pulse"></div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] font-black tracking-[0.5em] text-surface-text/30 uppercase animate-pulse">Establishing Connection...</p>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Package className="w-16 h-16 text-surface-text/10 mb-4" />
            <p className="text-[10px] font-black tracking-widest text-surface-text/30">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filteredProducts.map(p => {
              const { hasDiscount, finalPrice, badgeText } = calculateEffectiveDiscount(p as unknown as Parameters<typeof calculateEffectiveDiscount>[0]);

              return (
                <div key={p.id} className="px-1.5 pb-1.5 mb-1.5 border-b border-surface-border/30">
                  <div 
                    id={`product-${p.id}`}
                    className="group relative bg-surface-card border border-surface-border rounded-[1.5rem] md:rounded-[2rem] overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 flex flex-col h-full"
                  >
                    <div className="absolute top-3 md:top-6 left-3 md:left-6 right-3 md:right-6 z-10 flex justify-between items-start pointer-events-none">
                    <div className={`px-3 md:px-5 py-1 md:py-2 rounded-full text-[8px] md:text-[10px] font-black tracking-widest backdrop-blur-md shadow-xl pointer-events-auto border-2 ${
                      p.isService 
                        ? 'bg-primary-500 text-white border-white/20' 
                        : 'bg-emerald-600 text-white border-white/20'
                    }`}>
                      {p.isService ? 'Service' : 'Product'}
                    </div>
                    
                    <div className="flex flex-col gap-2 pointer-events-auto">
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleLike(p.id); }}
                        title={likedItems.has(p.id) ? "Remove from favorites" : "Add to favorites"}
                        className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                          likedItems.has(p.id) 
                            ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20' 
                            : 'bg-white/10 text-white/40 border-white/10 hover:bg-white/20 hover:text-white'
                        }`}
                      >
                        <Heart className={`w-3 md:w-4 h-3 md:h-4 ${likedItems.has(p.id) ? 'fill-current' : ''}`} />
                      </button>
                      
                      <button 
                        onClick={(e) => addToCart(p, e)}
                        title="Add to cart"
                        className="p-2 rounded-full backdrop-blur-md border bg-primary-500/20 text-white border-white/10 hover:bg-primary-500 hover:border-primary-500 transition-all active:scale-90"
                      >
                        <Plus className="w-3 md:w-4 h-3 md:h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="aspect-square bg-surface-bg border-b border-surface-border/30 flex items-center justify-center relative overflow-hidden shrink-0">
                    <img 
                      src={p.imageUrl || "/premium-item.png"} 
                      alt={p.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-card/60 via-transparent to-transparent"></div>
                  </div>
                  
                  <div className="p-4 md:p-6 flex flex-col flex-1">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="text-[7px] md:text-[9px] font-black text-primary-500 tracking-[0.3em] opacity-60">
                          {p.category?.name || 'FEATURED'}
                        </div>
                      </div>
                      <h3 className="font-black text-xs md:text-lg tracking-tight leading-tight group-hover:text-primary-500 transition-colors mb-2 flex flex-wrap items-center gap-2">
                        {p.name.charAt(0).toUpperCase() + p.name.slice(1).toLowerCase()}
                        {(p.soldCount || 0) > 0 && (
                          <span className="text-[7px] md:text-[9px] font-black text-primary-500/60 bg-primary-500/5 px-2 py-0.5 rounded-full">
                            {p.soldCount}+ sold
                          </span>
                        )}
                      </h3>
                      {!p.isService && p.quantity !== undefined && (
                        <div className={`text-[9px] font-black tracking-widest ${p.quantity > 2 ? 'text-green-500' : 'text-yellow-500'}`}>
                          {p.quantity > 2 ? '(In Stock)' : '(Low Stock)'}
                        </div>
                      )}
                    </div>
                      <div className="mt-auto pt-4 border-t border-surface-border/50 flex flex-col gap-3">
                        <div className="flex flex-col gap-1 w-full">
                          <div className="flex items-center justify-between">
                            <span className="text-[7px] md:text-[9px] font-black text-surface-text/20 uppercase tracking-widest">
                              {hasDiscount ? 'Special Offer' : 'Price'}
                            </span>
                            {hasDiscount && (
                              <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-lg uppercase tracking-tighter">
                                {badgeText}
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline justify-between">
                            <p className={`font-black tracking-tighter ${hasDiscount ? 'text-surface-text/40 line-through text-[10px] md:text-sm' : 'text-sm md:text-xl text-primary-500'}`}>
                              {formatCurrency(Number(p.sellPrice ?? 0))}
                            </p>
                            {hasDiscount && (
                              <p className="text-sm md:text-xl font-black text-red-500 tracking-tighter">
                                {formatCurrency(finalPrice)}
                              </p>
                            )}
                          </div>
                        </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <button 
                          onClick={() => handleInquiry(p)}
                          disabled={submitting}
                          className="col-span-1 py-3 bg-surface-bg border border-surface-border rounded-xl text-[8px] font-black tracking-widest hover:bg-surface-card transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                          Quote
                        </button>
                        <button 
                          onClick={() => {
                            const number = whatsappNumber || '265993732694';
                            const priceFormatted = formatCurrency(finalPrice);
                            const message = encodeURIComponent(`Hello, I’m interested in ${p.name} priced at ${priceFormatted}. Is it available?`);
                            window.open(`https://wa.me/${number.replace('+', '')}?text=${message}`, '_blank');
                          }}
                          className="col-span-1 py-3 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 rounded-xl text-[8px] font-black tracking-widest hover:bg-[#25D366] hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleSave(p.id); }}
                          className={`col-span-1 py-3 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg ${
                            savedItems.has(p.id) 
                              ? 'bg-primary-500 text-white shadow-primary-500/20' 
                              : 'bg-surface-bg border border-surface-border text-surface-text/40 hover:text-primary-500 shadow-primary-500/5'
                          }`}
                          title="Save for Later"
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${savedItems.has(p.id) ? 'fill-current' : ''}`} />
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
          <div className="absolute inset-0 bg-surface-bg/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setIsCartOpen(false)}></div>
          
          <div className="relative w-full max-w-xl bg-surface-card border border-surface-border rounded-[2rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-surface-border flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black tracking-tighter">Your Selection</h3>
                <p className="text-[10px] font-black tracking-widest text-surface-text/30 uppercase mt-1">Review items in your cart</p>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                title="Close cart"
                className="w-10 h-10 bg-surface-bg border border-surface-border rounded-full flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6 md:p-8 space-y-4 no-scrollbar">
              {cartItems.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center">
                  <ShoppingBag className="w-12 h-12 text-surface-text/10 mb-4" />
                  <p className="text-[10px] font-black tracking-widest text-surface-text/30">Your cart is empty</p>
                </div>
              ) : (
                cartItems.map(item => (
                  <div 
                    key={item.id} 
                    className="group bg-surface-bg border border-surface-border p-4 rounded-2xl flex items-center gap-4 hover:border-primary-500/30 transition-all cursor-pointer"
                    onClick={() => scrollToProduct(item.id)}
                  >
                    <div className="w-16 h-16 bg-surface-card border border-surface-border rounded-xl overflow-hidden shrink-0">
                      <img src={item.imageUrl || '/premium-item.png'} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-0.5">{item.category?.name || 'Item'}</p>
                      <h4 className="font-black text-sm truncate">{item.name.charAt(0).toUpperCase() + item.name.slice(1).toLowerCase()}</h4>
                      <p className="text-xs font-bold text-surface-text/40">{formatCurrency(Number(item.sellPrice ?? 0))}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); scrollToProduct(item.id); }}
                        title="View product"
                        className="w-8 h-8 bg-primary-500/10 text-primary-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => removeFromCart(item.id, e)}
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

            <div className="p-8 bg-surface-bg/50 border-t border-surface-border flex flex-col gap-4">
              {(() => {
                const subtotal = cartItems.reduce((acc, item) => {
                  const { finalPrice } = calculateEffectiveDiscount(item as unknown as Parameters<typeof calculateEffectiveDiscount>[0]);
                  return acc + finalPrice;
                }, 0);
                let taxAmount = 0;
                let total = subtotal;
                if (taxConfig.rate > 0) {
                  if (taxConfig.inclusive) {
                    taxAmount = subtotal - (subtotal / (1 + (taxConfig.rate / 100)));
                  } else {
                    taxAmount = subtotal * (taxConfig.rate / 100);
                    total = subtotal + taxAmount;
                  }
                }
                return (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center justify-between text-xs font-black text-surface-text/40">
                      <span>Subtotal {globalDiscount > 0 && `(with ${globalDiscount}% discount)`}</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {taxConfig.rate > 0 && (
                      <div className="flex items-center justify-between text-xs font-black text-surface-text/40">
                        <span>Tax ({taxConfig.rate}% {taxConfig.inclusive ? 'Inc.' : 'Exc.'})</span>
                        <span>{formatCurrency(taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-surface-border pt-2 mt-1">
                      <p className="text-sm font-black text-surface-text/40">Estimated Total</p>
                      <p className="text-2xl font-black text-primary-500 tracking-tighter">
                        {formatCurrency(total)}
                      </p>
                    </div>
                  </div>
                );
              })()}
              <button 
                onClick={() => setIsCartOpen(false)}
                className="w-full py-5 bg-primary-500 text-white rounded-2xl text-xs font-black tracking-[0.2em] shadow-xl shadow-primary-500/30 hover:scale-[1.02] active:scale-95 transition-all"
              >
                PROCEED TO CHECKOUT
              </button>
            </div>
          </div>
        </div>
      )}
      <CustomerAuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onSuccess={handleAuthSuccess}
      />

      <footer className="bg-surface-card border-t border-surface-border py-12 px-6 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 opacity-30">
          <span className="text-[8px] font-black tracking-[0.3em] uppercase">Powered by MsikaPOS</span>
        </div>
        <p className="text-[10px] font-black text-surface-text/20 tracking-widest uppercase">© {new Date().getFullYear()} {shopName}. All rights reserved.</p>
      </footer>
    </div>

  );
};

export default PublicStorefront;
