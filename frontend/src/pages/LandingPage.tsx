import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Rocket, 
  ShieldCheck, 
  CloudSync, 
  Smartphone, 
  ShoppingBag, 
  ArrowRight, 
  Globe, 
  Zap, 
  ChevronRight,
  Store
} from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../db/posDB';
import BrandName from '../components/BrandName';

const LandingPage: React.FC = () => {
  const [branding, setBranding] = useState({
    name: localStorage.getItem('companyName') || 'MsikaPos',
    logo: localStorage.getItem('companyLogo') || '/icon.png?v=2'
  });

  useEffect(() => {
    const loadBranding = async () => {
      const nameSetting = await db.settings.get('company_config');
      const logoSetting = await db.settings.get('company_logo');
      if (nameSetting?.value || logoSetting?.value) {
        setBranding(prev => ({
          name: (nameSetting?.value as { name: string })?.name || prev.name,
          logo: (logoSetting?.value as string) || prev.logo
        }));
      }
    };
    loadBranding();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-border/50 px-6 py-4 flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-surface-bg border border-border flex items-center justify-center">
            <img src="/icon.png?v=2" alt="MsikaPos" className="w-full h-full object-contain" />
          </div>
          <span className="font-black text-xl tracking-tighter"><BrandName /></span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-[10px] font-black tracking-widest text-muted-foreground hover:text-primary transition-colors uppercase">Features</a>
          <Link to="/about" className="text-[10px] font-black tracking-widest text-muted-foreground hover:text-primary transition-colors">About MsikaPos</Link>
          <Link to="/staff/login" className="px-6 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-primary hover:text-white transition-all btn-press">
            Sign In
          </Link>
        </div>
        <Link to="/staff/login" className="md:hidden w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg">
          <ArrowRight className="w-5 h-5" />
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 max-w-7xl mx-auto text-center overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 mb-4">
            <Zap className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-[10px] font-black tracking-[0.2em] text-primary uppercase">The Next Gen POS Ecosystem</span>
          </div>
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] text-gradient">
            Empower Your <br /> Business Anywhere.
          </h1>
          <p className="max-w-2xl mx-auto text-muted-foreground text-lg font-medium leading-relaxed">
            Experience the most robust, offline-first point of sale system designed for the modern era. Sell, sync, and scale without boundaries.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-8">
            <Link to="/staff/login" className="w-full md:w-auto h-16 px-10 bg-primary text-white rounded-2xl font-black tracking-widest uppercase flex items-center justify-center gap-3 shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
              Launch Staff Portal <ChevronRight className="w-5 h-5" />
            </Link>
            <Link to="/store" className="w-full md:w-auto h-16 px-10 bg-surface-card border border-border rounded-2xl font-black tracking-widest uppercase flex items-center justify-center gap-3 hover:bg-surface-bg transition-all">
              <ShoppingBag className="w-5 h-5" /> Visit Shop
            </Link>
          </div>
        </motion.div>

        {/* Feature Preview */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="mt-20 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
          <div className="glass-panel border border-border/50 rounded-[3rem] overflow-hidden shadow-2xl">
             <img src="/stationery_items_placeholder.png" alt="Dashboard Preview" className="w-full opacity-40 grayscale group-hover:grayscale-0 transition-all" />
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase">Built for Resilience</h2>
          <p className="text-muted-foreground font-medium uppercase tracking-[0.2em] text-[10px]">Why choose {branding.name}?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { 
              title: "Offline First", 
              desc: "No internet? No bundle? No problem. Keep selling offline and sync automatically when you're back.", 
              icon: Globe,
              color: "text-blue-500",
              bg: "bg-blue-500/10"
            },
            { 
              title: "Biometric Auth", 
              desc: "Instant, secure login using your device's fingerprint or face ID. Security at your fingertips.", 
              icon: ShieldCheck,
              color: "text-emerald-500",
              bg: "bg-emerald-500/10"
            },
            { 
              title: "Cloud Sync", 
              desc: "Real-time updates across all your branches and devices. Your data is always fresh and secure.", 
              icon: CloudSync,
              color: "text-primary",
              bg: "bg-primary/10"
            },
            { 
              title: "Mobile Ready", 
              desc: "Perfectly optimized for mobile, tablet, and desktop. Manage your empire from your pocket.", 
              icon: Smartphone,
              color: "text-orange-500",
              bg: "bg-orange-500/10"
            },
            { 
              title: "Smart Inventory", 
              desc: "Automated stock tracking, alerts, and AI-powered insights to keep your shelves never empty.", 
              icon: Rocket,
              color: "text-rose-500",
              bg: "bg-rose-500/10"
            },
            { 
              title: "Multi-Branch", 
              desc: "Manage multiple locations effortlessly. View consolidated reports or deep dive into one.", 
              icon: Store,
              color: "text-violet-500",
              bg: "bg-violet-500/10"
            }
          ].map((f, i) => (
            <motion.div 
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="glass-card p-8 rounded-[2rem] space-y-6 group"
            >
              <div className={`${f.bg} ${f.color} w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black tracking-tight">{f.title}</h3>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed leading-snug">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto glass-panel border border-primary/20 bg-primary/5 rounded-[3rem] p-12 md:p-24 text-center space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,var(--tw-gradient-from),transparent)] from-primary/10 to-transparent pointer-events-none" />
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">Ready to transform <br /> your operations?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto font-medium">Join thousands of businesses who have modernized their sales workflow with our platform.</p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/staff/login" className="w-full md:w-auto h-16 px-12 bg-primary text-white rounded-2xl font-black tracking-widest uppercase shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
              Get Started Now
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-border/20 bg-background/60 mt-auto pb-4 pt-1">
        <p className="text-[11px] font-semibold text-muted-foreground/60 text-center py-1 select-none">
          Powered by <BrandName />
        </p>
        <p className="text-[10px] font-medium text-muted-foreground/50 text-center w-full px-0 py-1 select-none border-t border-border/10">
          © {new Date().getFullYear()} Indelible Technologies. All rights reserved
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
