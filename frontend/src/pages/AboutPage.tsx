import React from 'react';
import { 
  HelpCircle, 
  ShieldCheck, 
  Phone,
  Mail,
  Wrench
} from 'lucide-react';
import { motion } from 'framer-motion';

const AboutPage: React.FC = () => {
  const sections = [
    {
      id: 'faq',
      title: 'Frequently Asked Questions',
      icon: <HelpCircle className="w-5 h-5 text-primary-500" />,
      items: [
        { q: "What is MsikaPos?", a: "MsikaPos is a next-generation cloud-based Point of Sale system designed for Malawian businesses to track sales, manage inventory, and monitor staff performance in real-time." },
        { q: "Can I use it offline?", a: "Yes! MsikaPos is built with offline-first technology. You can continue making sales even when the internet is down, and it will sync automatically once you're back online." },
        { q: "How do I add new staff?", a: "Only SuperAdmins can add staff. Go to the 'Team' section, click 'Add Staff', and you can even generate a Magic Link to send them via WhatsApp." }
      ]
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting Guide',
      icon: <Wrench className="w-5 h-5 text-orange-500" />,
      items: [
        { q: "Sync is stuck?", a: "Ensure your internet connection is active. You can force a manual sync by clicking the 'Sync' icon in the top header." },
        { q: "Receipt printer not working?", a: "Check if the printer is connected via USB or Bluetooth. MsikaPos uses standard browser printing; ensure the correct printer is selected in the print dialog." },
        { q: "Login failed?", a: "Check your username and password. If your account was recently suspended by an admin, you will need to contact them to reactivate it." }
      ]
    },
    {
      id: 'privacy',
      title: 'Terms & Privacy',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
      content: "MsikaPos values your privacy. We encrypt all sensitive data and never share your business metrics with third parties. Your data is stored securely on cloud servers with daily backups. By using this system, you agree to follow the operational guidelines set by your business administrator."
    }
  ];

  return (
    <div className="w-full bg-surface-bg text-surface-text selection:bg-primary-500/30 pb-20">

      <main className="w-full p-0 md:p-0 space-y-10">
        {/* Brand Hero */}
        <section className="text-center space-y-4 py-10">
          <div className="w-20 h-20 bg-primary-500/10 rounded-none flex items-center justify-center mx-auto border border-primary-500/20">
            <img src="/icon.png" alt="Logo" className="w-12 h-12 object-contain" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight ">MsikaPos</h2>
            <p className="text-surface-text/40 text-xs font-black tracking-widest">Version 2.4.0 • Cloud Powered</p>
          </div>
        </section>

        {sections.map((section) => (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            key={section.id} 
            className="space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-transparent border border-surface-border rounded-none">
                {section.icon}
              </div>
              <h3 className="text-lg font-black tracking-tight">{section.title}</h3>
            </div>

            <div className="bg-transparent border-t border-surface-border overflow-hidden">
              {section.items ? (
                <div className="divide-y divide-surface-border">
                  {section.items.map((item, i) => (
                    <div key={i} className="p-6 space-y-2 hover:bg-surface-bg/50 transition-all">
                      <h4 className="text-sm font-black text-primary-500 ">Q: {item.q}</h4>
                      <p className="text-[11px] font-medium text-surface-text/60 leading-relaxed">{item.a}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8">
                  <p className="text-[11px] font-medium text-surface-text/60 leading-relaxed">
                    {section.content}
                  </p>
                </div>
              )}
            </div>
          </motion.section>
        ))}

        <footer className="text-center pt-10 space-y-8">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-surface-text/20 tracking-[0.3em]">Technical Support</p>
            <div className="flex justify-center gap-4 mt-4">
              {/* WhatsApp Support */}
              <a href="https://wa.me/265993732694" title="WhatsApp Support" aria-label="WhatsApp Support" className="w-16 h-16 bg-transparent border-b border-surface-border flex items-center justify-center hover:border-emerald-500/30 transition-all group">
                <div className="w-10 h-10 bg-[#25D366] rounded-none flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
              </a>

              {/* Facebook Support */}
              <a href="https://www.facebook.com/JEFInvestment" target="_blank" rel="noreferrer noopener" title="Facebook Support" aria-label="Facebook Support" className="w-16 h-16 bg-transparent border-b border-surface-border flex items-center justify-center hover:border-blue-500/30 transition-all group">
                <div className="w-10 h-10 bg-[#1877F2] rounded-none flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
              </a>

              {/* Direct Call */}
              <a href="tel:+265885892269" title="Direct Call" aria-label="Direct Call" className="w-16 h-16 bg-transparent border-b border-surface-border flex items-center justify-center hover:border-primary-500/30 transition-all group">
                <div className="w-10 h-10 bg-primary-500 rounded-none flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform">
                  <Phone className="w-5 h-5 text-white" />
                </div>
              </a>

              {/* Email Support */}
              <a href="mailto:msikaposmw@gmail.com" title="Email Support" aria-label="Email Support" className="w-16 h-16 bg-transparent border-b border-surface-border flex items-center justify-center hover:border-orange-500/30 transition-all group">
                <div className="w-10 h-10 bg-orange-500 rounded-none flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                  <Mail className="w-5 h-5 text-white" />
                </div>
              </a>
            </div>
          </div>
          
          <div className="space-y-1">
            <p className="text-[10px] font-black text-surface-text/20 tracking-[0.3em] ">System Developer</p>
            <p className="text-sm font-black  tracking-tight text-primary-500">James Dickson Petro</p>
          </div>
          
          <p className="text-[9px] font-black text-surface-text/10 tracking-[0.4em] pb-10">© 2026 MsikaPos • Indelible-cpu</p>
        </footer>
      </main>
    </div>
  );
};

export default AboutPage;
