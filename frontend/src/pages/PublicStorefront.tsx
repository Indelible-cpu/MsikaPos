import React, { useState, useEffect } from 'react';
import { Package, Search, MessageSquare, ShoppingBag, Loader2, User as UserIcon, Heart, Star, Bookmark, Plus, ShoppingCart } from 'lucide-react';
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
  const [cartCount, setCartCount] = useState(0);
  const [likedItems, setLikedItems] = useState<Set<number>>(new Set());
  const [savedItems, setSavedItems] = useState<Set<number>>(new Set());
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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

  const addToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCartCount(prev => prev + 1);
    toast.success('Added to cart');
  };

  useEffect(() => {
    const loadStorefront = async () => {
      setLoading(true);
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
      }

      // Restore logged-in customer session if any
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.role === 'CUSTOMER') setCustomer(u);
      }
    };
    loadStorefront();
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
    const matchesCategory = selectedCategory === 'All' || p.category?.name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen flex flex-col bg-surface-bg text-surface-text transition-colors duration-300">
      {/* Edge-to-Edge Header */}
      <header className="sticky top-0 z-40 bg-surface-bg/80 backdrop-blur-xl border-b border-surface-border">
        <div className="w-full px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500/10 text-primary-500 rounded-full flex items-center justify-center border border-primary-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black tracking-tighter italic">{shopName}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {customer && (
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-[9px] font-black tracking-widest text-surface-text/30 italic">Logged in as</p>
                  <p className="text-xs font-black">{customer.fullname}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-10 h-10 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all"
                  title="Sign Out"
                >
                  <UserIcon className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleTheme}
                className="w-10 h-10 bg-surface-card border border-surface-border rounded-full flex items-center justify-center text-surface-text/60 hover:text-primary-500 transition-all"
                title="Toggle Theme"
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <div className="relative">
                <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-primary-500/20">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-surface-bg animate-bounce">
                    {cartCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Search */}
      <div className="w-full bg-surface-bg border-b border-surface-border transition-colors">
        <div className="w-full px-6 md:px-12 py-12 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-xl">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic mb-4 leading-none">Marketplace</h2>
            <p className="text-sm md:text-base font-bold text-surface-text/40 mb-0">Explore premium products and professional services. Quality guaranteed at {shopName}.</p>
          </div>
          
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-surface-text/40 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search products & services..."
              className="w-full py-5 pl-14 pr-6 bg-surface-card border border-surface-border rounded-full outline-none focus:border-primary-500 font-bold text-sm shadow-xl shadow-surface-text/5 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="w-full bg-surface-bg border-b border-surface-border/50 overflow-x-auto no-scrollbar">
        <div className="w-full px-6 md:px-12 py-6 flex items-center gap-3">
          <button 
            onClick={() => setSelectedCategory('All')}
            className={`px-8 py-3 rounded-full text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${
              selectedCategory === 'All' 
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' 
                : 'bg-surface-card border border-surface-border text-surface-text/40 hover:text-surface-text'
            }`}
          >
            ALL ITEMS
          </button>
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-8 py-3 rounded-full text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${
                selectedCategory === cat 
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' 
                  : 'bg-surface-card border border-surface-border text-surface-text/40 hover:text-surface-text'
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <main className="flex-1 w-full px-4 md:px-12 py-8 md:py-12">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
            <p className="text-[10px] font-black tracking-[0.3em] text-surface-text/20 italic">Loading marketplace...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Package className="w-16 h-16 text-surface-text/10 mb-4" />
            <p className="text-[10px] font-black tracking-widest text-surface-text/30 italic">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-8">
            {filteredProducts.map(p => (
              <div key={p.id} className="group relative bg-surface-card border border-surface-border rounded-[2rem] md:rounded-[2.5rem] overflow-hidden hover:border-primary-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-1 flex flex-col h-full">
                {/* Top Actions */}
                <div className="absolute top-3 md:top-6 left-3 md:left-6 right-3 md:right-6 z-10 flex justify-between items-start pointer-events-none">
                  <div className={`px-2 md:px-4 py-1 md:py-1.5 rounded-full text-[7px] md:text-[8px] font-black tracking-[0.2em] italic backdrop-blur-md border pointer-events-auto ${
                    p.isService 
                      ? 'bg-primary-500/10 text-primary-500 border-primary-500/20' 
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  }`}>
                    {p.isService ? 'Service' : 'Product'}
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

                <div className="aspect-square md:aspect-[4/3] bg-surface-bg border-b border-surface-border/30 flex items-center justify-center p-6 md:p-12 relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <img 
                    src={p.imageUrl || "/premium-item.png"} 
                    alt={p.name} 
                    className="w-full h-full object-contain drop-shadow-2xl scale-110 group-hover:scale-125 transition-transform duration-700" 
                  />
                </div>
                
                <div className="p-4 md:p-8 flex flex-col flex-1">
                  <div className="mb-4 md:mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-[7px] md:text-[9px] font-black text-primary-500 tracking-[0.3em] italic opacity-60">
                        {p.category?.name || 'Featured'}
                      </div>
                      <div className="flex items-center gap-0.5 text-amber-500">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        <span className="text-[9px] font-black">4.9</span>
                      </div>
                    </div>
                    <h3 className="font-black text-sm md:text-xl tracking-tight leading-tight group-hover:text-primary-500 transition-colors mb-2">{p.name}</h3>
                    <p className="text-[10px] md:text-xs text-surface-text/40 font-medium line-clamp-2 leading-relaxed">
                      {p.description || "Premium quality solution tailored for excellence. Experience the best with our curated collection."}
                    </p>
                  </div>

                  <div className="mt-auto pt-4 md:pt-6 border-t border-surface-border/50 flex flex-col gap-4 md:gap-6">
                    <div className="flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-[7px] md:text-[10px] font-black text-surface-text/20 italic">Starting from</span>
                        <p className="text-sm md:text-2xl font-black text-primary-500 italic tracking-tighter">MK {(p.sellPrice ?? 0).toLocaleString()}</p>
                      </div>
                      
                      <button 
                        onClick={addToCart}
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
      </main>

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
