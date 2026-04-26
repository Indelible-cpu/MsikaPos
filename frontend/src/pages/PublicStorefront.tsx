import React, { useState, useEffect } from 'react';
import { Package, Search, MessageSquare, ShoppingBag, Loader2, CheckCircle2, User as UserIcon } from 'lucide-react';
import { db } from '../db/posDB';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import api from '../api/client';
import CustomerAuthModal from '../components/CustomerAuthModal';

export const PublicStorefront: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [shopName, setShopName] = useState('Storefront');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  useEffect(() => {
    const loadStorefront = async () => {
      // Load products (mocking public fetch with local indexedDB for now)
      const allProducts = await db.products.where('isService').equals(0).toArray();
      setProducts(allProducts.filter(p => p.quantity > 0)); 

      const company = await db.settings.get('company_config');
      if (company?.value) {
        setShopName((company.value as any).name || 'Storefront');
      }

      const storedUser = localStorage.getItem('customerUser');
      if (storedUser) setCustomer(JSON.parse(storedUser));
    };
    loadStorefront();
  }, []);

  const handleInquiry = async (product: any) => {
    const token = localStorage.getItem('customerToken');
    if (!token) {
      setSelectedProduct(product);
      setIsAuthOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/inquiries', {
        items: [{ id: product.id, name: product.name, price: product.price }]
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

  const handleAuthSuccess = (token: string, user: any) => {
    setCustomer(user);
    if (selectedProduct) {
      handleInquiry(selectedProduct);
      setSelectedProduct(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerUser');
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
            {customer ? (
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
            ) : (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="px-6 py-3 bg-primary-500 text-white rounded-full text-[10px] font-black tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary-500/20"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Search */}
      <div className="w-full bg-primary-500/5 border-b border-surface-border">
        <div className="max-w-5xl mx-auto px-6 py-12 text-center">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter italic mb-4">Discover Our Products</h2>
          <p className="text-sm font-bold text-surface-text/40 mb-8 max-w-md mx-auto">Browse our latest catalog. See something you like? Send us an inquiry instantly.</p>
          
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-surface-text/40 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search products..."
              className="w-full py-5 pl-14 pr-6 bg-surface-card border border-surface-border rounded-full outline-none focus:border-primary-500 font-bold text-sm shadow-xl shadow-surface-text/5 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Package className="w-16 h-16 text-surface-text/10 mb-4" />
            <p className="text-[10px] font-black tracking-widest text-surface-text/30 uppercase">No products available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(p => (
              <div key={p.id} className="group relative bg-surface-card border border-surface-border rounded-3xl overflow-hidden hover:border-primary-500/30 transition-all hover:shadow-2xl hover:shadow-primary-500/5">
                <div className="aspect-square bg-surface-bg border-b border-surface-border/50 flex items-center justify-center p-8 group-hover:scale-105 transition-transform duration-500">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain drop-shadow-xl" />
                  ) : (
                    <Package className="w-20 h-20 text-surface-text/10" />
                  )}
                </div>
                
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-black text-lg tracking-tight leading-tight">{p.name}</h3>
                    <div className="text-[9px] font-black px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full tracking-widest">In Stock</div>
                  </div>
                  <p className="text-xl font-black text-primary-500 italic tracking-tighter mb-6">MK {p.price.toLocaleString()}</p>
                  
                  <button 
                    onClick={() => handleInquiry(p)}
                    disabled={submitting}
                    className="w-full py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black tracking-widest hover:bg-primary-500 hover:text-white hover:border-primary-500 transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                    Inquire Now
                  </button>
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
