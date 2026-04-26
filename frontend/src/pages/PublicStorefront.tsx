import React, { useState, useEffect } from 'react';
import { Package, Search, MessageSquare, ShoppingBag, Loader2, User as UserIcon } from 'lucide-react';
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
          setProducts(productsRes.data.data);
        }

        if (settingsRes.data.success && settingsRes.data.data?.companyName) {
          setShopName(settingsRes.data.data.companyName);
        }
      } catch (err) {
        console.error('Storefront load error:', err);
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
    if (!token) {
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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-surface-bg text-surface-text transition-colors duration-300">
      {/* Edge-to-Edge Header */}
      <header className="sticky top-0 z-40 bg-surface-bg/80 backdrop-blur-xl border-b border-surface-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
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
                  <p className="text-[9px] font-black tracking-widest text-surface-text/30">LOGGED IN AS</p>
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
          </div>
        </div>
      </header>

      {/* Hero Search */}
      <div className="w-full bg-surface-bg border-b border-surface-border transition-colors">
        <div className="max-w-5xl mx-auto px-6 py-12 text-center">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter italic mb-4">Marketplace</h2>
          <p className="text-sm font-bold text-surface-text/40 mb-8 max-w-md mx-auto">Explore premium products and professional services. Quality guaranteed at {shopName}.</p>
          
          <div className="relative max-w-xl mx-auto">
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

      {/* Product Grid */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
            <p className="text-[10px] font-black tracking-widest text-surface-text/30 uppercase">Loading marketplace...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Package className="w-16 h-16 text-surface-text/10 mb-4" />
            <p className="text-[10px] font-black tracking-widest text-surface-text/30 uppercase">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map(p => (
              <div key={p.id} className="group relative bg-surface-card border border-surface-border rounded-[2.5rem] overflow-hidden hover:border-primary-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-1 flex flex-col h-full">
                {/* Badge for Product/Service */}
                <div className="absolute top-6 right-6 z-10">
                  <div className={`px-4 py-1.5 rounded-full text-[8px] font-black tracking-[0.2em] uppercase backdrop-blur-md border ${
                    p.isService 
                      ? 'bg-primary-500/10 text-primary-500 border-primary-500/20' 
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  }`}>
                    {p.isService ? 'SERVICE' : 'PRODUCT'}
                  </div>
                </div>

                <div className="aspect-[4/3] bg-surface-bg border-b border-surface-border/30 flex items-center justify-center p-12 relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain drop-shadow-2xl scale-110 group-hover:scale-125 transition-transform duration-700" />
                  ) : (
                    <Package className="w-24 h-24 text-surface-text/5 group-hover:text-zinc-500/20 transition-colors" />
                  )}
                </div>
                
                <div className="p-8 flex flex-col flex-1">
                  <div className="mb-6">
                    <div className="text-[9px] font-black text-primary-500 mb-2 tracking-[0.3em] uppercase opacity-60">
                      {p.category?.name || 'FEATURED'}
                    </div>
                    <h3 className="font-black text-xl tracking-tight leading-tight group-hover:text-primary-500 transition-colors">{p.name}</h3>
                  </div>

                  <div className="mt-auto pt-6 border-t border-surface-border/50 flex flex-col gap-6">
                    <div className="flex items-end gap-1">
                      <span className="text-[10px] font-black text-surface-text/20 mb-1.5 uppercase">Starting from</span>
                      <p className="text-2xl font-black text-primary-500 italic tracking-tighter">MK {(p.sellPrice ?? 0).toLocaleString()}</p>
                    </div>
                    
                    <button 
                      onClick={() => handleInquiry(p)}
                      disabled={submitting}
                      className="w-full py-5 bg-surface-bg border border-surface-border rounded-3xl text-[10px] font-black tracking-widest hover:bg-primary-500 hover:text-white hover:border-primary-500 hover:shadow-xl hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                      GET A QUOTE
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

      {/* Footer */}
      <footer className="bg-surface-card border-t border-surface-border py-8 text-center">
        <p className="text-[10px] font-black text-surface-text/20 tracking-widest">© {new Date().getFullYear()} {shopName}. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PublicStorefront;
