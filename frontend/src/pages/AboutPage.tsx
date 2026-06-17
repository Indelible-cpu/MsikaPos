import React, { useState } from 'react';
import {
  HelpCircle,
  ShieldCheck,
  Phone,
  Mail,
  Wrench,
  ChevronDown,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BrandName from '../components/BrandName';

interface FaqItem {
  q: string;
  a: string;
}

const AccordionItem: React.FC<{ item: FaqItem; index: number }> = ({ item, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 hover:bg-primary/5 transition-all text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-foreground">
          {index + 1}. {item.q}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 text-[12px] font-medium text-muted-foreground leading-relaxed">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AboutPage: React.FC = () => {
  const navigate = useNavigate();

  const sections = [
    {
      id: 'faq',
      title: 'Frequently asked questions',
      icon: <HelpCircle className="w-5 h-5 text-primary" />,
      items: [
        { q: "What is MsikaPos?", a: "MsikaPos is a next-generation cloud-based point of sale system designed for businesses to track sales, manage inventory, and monitor staff performance in real-time." },
        { q: "Can I use it offline?", a: "Yes! MsikaPos is built with offline-first technology. You can continue making sales even when the internet is down, and it will sync automatically once you're back online." },
        { q: "How do I add new staff?", a: "Only super admins can add staff. Go to the 'Team' section, click 'Add staff', and you can even generate a magic link to send them via WhatsApp." }
      ] as FaqItem[]
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting guide',
      icon: <Wrench className="w-5 h-5 text-orange-500" />,
      items: [
        { q: "Sync is stuck?", a: "Ensure your internet connection is active. You can force a manual sync by clicking the 'Sync' icon in the top header." },
        { q: "Receipt printer not working?", a: "Check if the printer is connected via USB or Bluetooth. MsikaPos uses standard browser printing — ensure the correct printer is selected in the print dialog." },
        { q: "Login failed?", a: "Check your username and password. If your account was recently suspended by an admin, you will need to contact them to reactivate it." }
      ] as FaqItem[]
    },
    {
      id: 'privacy',
      title: 'Terms & privacy',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
      items: [
        { q: "Data privacy & terms of service", a: "MsikaPos values your privacy. We encrypt all sensitive data and never share your business metrics with third parties. Your data is stored securely on cloud servers with daily backups. By using this system, you agree to follow the operational guidelines set by your business administrator." }
      ] as FaqItem[]
    }
  ];

  return (
    <div className="w-full bg-background text-foreground selection:bg-primary/30 relative flex flex-col min-h-screen overflow-x-hidden">
      <div className="fixed inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-2xl mx-auto pt-6 px-6 z-10 relative flex justify-start">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center bg-surface-card border border-border/50 rounded-xl text-foreground hover:bg-primary/10 transition-colors shadow-sm"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <main className="w-full max-w-2xl mx-auto p-0 md:p-0 space-y-10 relative flex-1 mt-2">
        {/* Brand hero */}
        <section className="text-center space-y-4 py-10 px-6">
          <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mx-auto border border-primary/20 overflow-hidden shadow-md">
            <img src="/icon.png?v=2" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight text-foreground"><BrandName /></h2>
            <p className="text-[10px] font-medium text-muted-foreground/50 tracking-wide">— Run Your Shop. Grow Your Business —</p>
          </div>
        </section>

        {sections.map((section) => (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            key={section.id}
            className="space-y-4 px-0"
          >
            {/* Section header */}
            <div className="flex items-center gap-3 px-6">
              <div className="p-2 bg-transparent border border-border/50 rounded-none">
                {section.icon}
              </div>
              <h3 className="text-base font-bold tracking-tight text-foreground">{section.title}</h3>
            </div>

            <div className="bg-transparent border-t border-border/30 overflow-hidden">
              <div className="divide-y divide-border/20">
                {section.items.map((item, i) => (
                  <AccordionItem key={i} item={item} index={i} />
                ))}
              </div>
            </div>
          </motion.section>
        ))}

        <footer className="text-center pt-10 mt-auto">
          <div className="space-y-2 mb-8">
            <p className="text-[10px] font-semibold text-surface-text/60 tracking-[0.2em] px-6">Technical support</p>
            <div className="flex justify-center gap-4 mt-4">
              {/* WhatsApp */}
              <a href="https://wa.me/265993732694" title="WhatsApp Support" aria-label="WhatsApp Support" className="w-16 h-16 bg-transparent border-b border-surface-border flex items-center justify-center hover:border-emerald-500/30 transition-all group">
                <div className="w-10 h-10 bg-[#25D366] rounded-none flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
              </a>

              {/* Facebook */}
              <a href="https://www.facebook.com/JEFInvestment" target="_blank" rel="noreferrer noopener" title="Facebook Support" aria-label="Facebook Support" className="w-16 h-16 bg-transparent border-b border-surface-border flex items-center justify-center hover:border-blue-500/30 transition-all group">
                <div className="w-10 h-10 bg-[#1877F2] rounded-none flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
              </a>

              {/* Call */}
              <a href="tel:+265885892269" title="Direct Call" aria-label="Direct Call" className="w-16 h-16 bg-transparent border-b border-surface-border flex items-center justify-center hover:border-primary/30 transition-all group">
                <div className="w-10 h-10 bg-primary rounded-none flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                  <Phone className="w-5 h-5 text-white" />
                </div>
              </a>

              {/* Email */}
              <a href="mailto:msikaposmw@gmail.com" title="Email Support" aria-label="Email Support" className="w-16 h-16 bg-transparent border-b border-surface-border flex items-center justify-center hover:border-orange-500/30 transition-all group">
                <div className="w-10 h-10 bg-orange-500 rounded-none flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                  <Mail className="w-5 h-5 text-white" />
                </div>
              </a>
            </div>
          </div>

        </footer>
      </main>
      
      <div className="w-full border-t border-border/20 bg-background/60 mt-0">
        <p className="text-[10px] font-semibold text-muted-foreground/60 text-center py-1 select-none">
          Powered by <BrandName />
        </p>
        <p className="text-[10px] font-medium text-muted-foreground/50 text-center w-full px-0 py-1 select-none border-t border-border/10">
          © {new Date().getFullYear()} Indelible Technologies. All rights reserved
        </p>
      </div>
    </div>
  );
};

export default AboutPage;
