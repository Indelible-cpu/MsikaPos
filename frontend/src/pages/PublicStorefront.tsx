import React, { useState, useEffect, useRef } from 'react';
import { Package, Search, MessageSquare, ShoppingBag, Loader2, User as UserIcon, Heart, Star, Bookmark, Plus, ShoppingCart, X, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import CustomerAuthModal from '../components/CustomerAuthModal';

export const PublicStorefront: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [shopName, setShopName] = useState('Msika');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [likedItems, setLikedItems] = useState<Set<number>>(new Set());
  const [savedItems, setSavedItems] = useState<Set<number>>(new Set());
  const categoryNavRef = useRef<HTMLDivElement>(null);

  const CUSTOM_CATEGORIES = [
    'Phone Accessories',
    'Stationery Services',
    'Stationery Items',
    'Phones and Computer Tech Solutions'
  ];

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
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
    checkCategoryScroll();
    window.addEventListener('resize', checkCategoryScroll);
    return () => window.removeEventListener('resize', checkCategoryScroll);
  }, [categories]);

  const toggleLike = (id: number) => {
    const newLiked = new Set(likedItems);
    if (newLiked.has(id)) newLiked.delete(id);
    else newLiked.add(id);
    setLikedItems(newLiked);
    toast.success(newLiked.has(id) ? 'Added to favorites' : 'Removed from favorites');
  };

  const toggleSave = (id: number) => {
    const newSaved = new Set(savedItems);
    if (newSaved.has(id)) newSaved.delete(id);
    else newSaved.add(id);
    setSavedItems(newSaved);
    toast.success(newSaved.has(id) ? 'Saved for later' : 'Removed from saved');
  };

  const addToCart = (product: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCartItems(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) return prev;
      toast.success(`${product.name} added to cart`);
      return [...prev, product];
    });
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
      if (distance > 150) { // Threshold for pull-to-refresh
        loadStorefront(true);
      }
      setTouchStart(null);
    }
  };

  const loadStorefront = async (background = false) => {
    if (!background) setLoading(true);
    else setIsRefreshing(true);

    try {
      // Fetch products from Supabase via backend API (no auth needed)
      const [productsRes, settingsRes] = await Promise.all([
        api.get('/public/products'),
        api.get('/public/settings'),
      ]);

      if (productsRes.data.success) {
        const data = productsRes.data.data;
        setProducts(data);
        
        // Better category extraction
        const cats = Array.from(new Set(data.map((p: any) => p.category?.name || 'Uncategorized')))
          .filter((c: any) => c !== 'Uncategorized') as string[];
        setCategories(cats);
      }

      if (settingsRes.data.success && settingsRes.data.data?.companyName) {
        setShopName(settingsRes.data.data.companyName);
      }
    } catch (err) {
      console.error('Storefront load error:', err);
      toast.error('Failed to load marketplace. Please refresh.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStorefront();
    
    // Smart background sync every 5 minutes
    const interval = setInterval(() => loadStorefront(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Restore logged-in customer session if any
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      if (u.role === 'CUSTOMER') setCustomer(u);
    }
  }, []);

  const handleInquiry = async (product: any) => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    // Only use token if role is CUSTOMER
    if (!token || user?.role !== 'CUSTOMER') {
      setSelectedProduct(product);
      setIsAuthOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/inquiries', {
        items: [{ id: product.id, name: product.name, price: product.sellPrice ?? 0 }]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Inquiry sent successfully!');
    } catch (error) {
      toast.error('Failed to send inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuthSuccess = (_token: string, user: any) => {
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
      {/* Background Refresh Indicator */}
      {isRefreshing && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-primary-500 text-white p-3 rounded-full shadow-2xl flex items-center justify-center animate-in fade-in slide-in-from-top-4 duration-500 border-2 border-white/20">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {/* Fixed Header & Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <header className="bg-surface-bg/80 backdrop-blur-xl border-b border-surface-border">
        <div className="w-full px-6 md:px-12 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-500/10 text-primary-500 rounded-full flex items-center justify-center border border-primary-500/20">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-black tracking-tighter italic">{shopName}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {customer && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden md:block">
                  <p className="text-[8px] font-black tracking-widest text-surface-text/30 uppercase italic">Active</p>
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
              <button 
                onClick={toggleTheme}
                className="w-8 h-8 bg-surface-card border border-surface-border rounded-full flex items-center justify-center text-surface-text/60 hover:text-primary-500 transition-all text-xs"
                title="Toggle Theme"
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative group"
              >
                <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                {cartItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-surface-bg animate-bounce">
                    {cartItems.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Category Filter Bar (Fixed) */}
      <div className="w-full bg-surface-bg/80 backdrop-blur-xl border-b border-surface-border relative">
        {/* Dynamic Fading Edges - Increased Intensity */}
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

    {/* Main Content (Scrollable) */}
    <main className="flex-1 w-full pt-[130px] md:pt-[150px]">
      {/* Compact Hero Search */}
      <div className="w-full bg-surface-bg border-b border-surface-border/50 transition-colors">
        <div className="w-full px-6 md:px-12 py-6 md:py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-black tracking-tighter italic leading-none text-primary-500 uppercase">Marketplace</h2>
            <p className="text-[10px] md:text-xs font-bold text-surface-text/40 mt-1 uppercase tracking-widest">Premium Products & Services</p>
          </div>
          
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search MsikaPos..."
              className="w-full py-4 pl-14 pr-12 bg-surface-card border border-surface-border rounded-full outline-none focus:border-primary-500 font-bold text-xs shadow-lg transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-surface-text/20 hover:text-rose-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 md:px-12 py-8">
        {loading ? (
          <div className="py-32 text-center flex flex-col items-center gap-8">
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-primary-500" />
              <div className="absolute inset-0 blur-2xl bg-primary-500/20 rounded-full animate-pulse"></div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] font-black tracking-[0.5em] text-surface-text/30 uppercase animate-pulse">Establishing Connection...</p>
              <div className="w-12 h-0.5 bg-primary-500/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 animate-progress origin-left"></div>
              </div>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Package className="w-16 h-16 text-surface-text/10 mb-4" />
            <p className="text-[10px] font-black tracking-widest text-surface-text/30 italic">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 md:gap-8">
            {filteredProducts.map(p => (
              <div 
                key={p.id} 
                id={`product-${p.id}`}
                className="group relative bg-surface-card border border-surface-border rounded-[2rem] md:rounded-[2.5rem] overflow-hidden hover:border-primary-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-1 flex flex-col h-full"
              >
                {/* Top Actions */}
                <div className="absolute top-3 md:top-6 left-3 md:left-6 right-3 md:right-6 z-10 flex justify-between items-start pointer-events-none">
                  <div className={`px-3 md:px-5 py-1 md:py-2 rounded-full text-[8px] md:text-[10px] font-black tracking-[0.2em] uppercase italic backdrop-blur-md shadow-xl pointer-events-auto border-2 ${
                    p.isService 
                      ? 'bg-primary-500 text-white border-white/20' 
                      : 'bg-emerald-600 text-white border-white/20'
                  }`}>
                    {p.isService ? 'SERVICE' : 'PRODUCT'}
                  </div>
                  
                  <div className="flex flex-col gap-2 pointer-events-auto">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleLike(p.id); }}
                      className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                        likedItems.has(p.id) 
                          ? 'bg-rose-500 text-white border-rose-500' 
                          : 'bg-white/10 text-white/40 border-white/10 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-3 md:w-4 h-3 md:h-4 ${likedItems.has(p.id) ? 'fill-current' : ''}`} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleSave(p.id); }}
                      className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                        savedItems.has(p.id) 
                          ? 'bg-primary-500 text-white border-primary-500' 
                          : 'bg-white/10 text-white/40 border-white/10 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      <Bookmark className={`w-3 md:w-4 h-3 md:h-4 ${savedItems.has(p.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="aspect-[4/5] bg-surface-bg border-b border-surface-border/30 flex items-center justify-center relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <img 
                    src={p.imageUrl || "/premium-item.png"} 
                    alt={p.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-transparent opacity-60"></div>
                </div>
                
                <div className="p-4 md:p-8 flex flex-col flex-1">
                  <div className="mb-4 md:mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-[7px] md:text-[9px] font-black text-primary-500 tracking-[0.3em] italic opacity-60">
                        {p.category?.name || 'FEATURED'}
                      </div>
                      <div className="flex items-center gap-0.5 text-amber-500">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        <span className="text-[9px] font-black">4.9</span>
                      </div>
                    </div>
                    <h3 className="font-black text-sm md:text-xl tracking-tight leading-tight group-hover:text-primary-500 transition-colors mb-2">{p.name}</h3>
                    <p className="text-[10px] md:text-xs text-surface-text/40 font-medium line-clamp-2 leading-relaxed">
                      {p.description || `Premium quality ${p.name.toLowerCase()} available at MsikaPos.`}
                    </p>
                  </div>
                  <div className="mt-auto pt-4 md:pt-6 border-t border-surface-border/50 flex flex-col gap-4 md:gap-6">
                    <div className="flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-[7px] md:text-[10px] font-black text-surface-text/20 italic">Starting from</span>
                        <p className="text-sm md:text-2xl font-black text-primary-500 italic tracking-tighter">MK {(p.sellPrice ?? 0).toLocaleString()}</p>
                      </div>
                      
                      <button 
                        onClick={(e) => addToCart(p, e)}
                        className="w-8 md:w-12 h-8 md:h-12 bg-primary-500/10 text-primary-500 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-primary-500 hover:text-white transition-all active:scale-90"
                      >
                        <Plus className="w-4 md:w-5 h-4 md:h-5" />
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => handleInquiry(p)}
                      disabled={submitting}
                      className="w-full py-3 md:py-5 bg-surface-bg border border-surface-border rounded-2xl md:rounded-3xl text-[8px] md:text-[10px] font-black tracking-widest hover:bg-primary-500 hover:text-white hover:border-primary-500 hover:shadow-xl hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-2 md:gap-3 active:scale-95"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                      Get a Quote
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>

      {/* Cart Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
          <div className="absolute inset-0 bg-surface-bg/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setIsCartOpen(false)}></div>
          
          <div className="relative w-full max-w-xl bg-surface-card border border-surface-border rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-surface-border flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black italic tracking-tighter">Your Selection</h3>
                <p className="text-[10px] font-black tracking-widest text-surface-text/30 uppercase mt-1">Review items in your cart</p>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="w-10 h-10 bg-surface-bg border border-surface-border rounded-full flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6 md:p-8 space-y-4 no-scrollbar">
              {cartItems.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center">
                  <ShoppingBag className="w-12 h-12 text-surface-text/10 mb-4" />
                  <p className="text-[10px] font-black tracking-widest text-surface-text/30 italic">Your cart is empty</p>
                </div>
              ) : (
                cartItems.map(item => (
                  <div 
                    key={item.id} 
                    className="group bg-surface-bg border border-surface-border p-4 rounded-3xl flex items-center gap-4 hover:border-primary-500/30 transition-all cursor-pointer"
                    onClick={() => scrollToProduct(item.id)}
                  >
                    <div className="w-16 h-16 bg-surface-card border border-surface-border rounded-2xl overflow-hidden shrink-0">
                      <img src={item.imageUrl || '/premium-item.png'} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-0.5">{item.category?.name || 'Item'}</p>
                      <h4 className="font-black text-sm truncate">{item.name}</h4>
                      <p className="text-xs font-bold text-surface-text/40">MK {(item.sellPrice ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); scrollToProduct(item.id); }}
                        className="w-8 h-8 bg-primary-500/10 text-primary-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => removeFromCart(item.id, e)}
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
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-surface-text/40 italic">Estimated Total</p>
                <p className="text-2xl font-black text-primary-500 tracking-tighter italic">
                  MK {cartItems.reduce((acc, item) => acc + (item.sellPrice ?? 0), 0).toLocaleString()}
                </p>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="w-full py-5 bg-primary-500 text-white rounded-3xl text-xs font-black tracking-[0.2em] shadow-xl shadow-primary-500/30 hover:scale-[1.02] active:scale-95 transition-all"
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

      <footer className="bg-surface-card border-t border-surface-border py-8 text-center">
        <p className="text-[10px] font-black text-surface-text/20 tracking-widest italic">© {new Date().getFullYear()} {shopName}. All rights reserved.</p>
      </footer>
    </div>

  );
};

export default PublicStorefront;
