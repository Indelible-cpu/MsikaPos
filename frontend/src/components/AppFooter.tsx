import React from 'react';

/**
 * Global AppFooter — Indelible Technologies branding.
 * Rendered inside MainLayout on every authenticated page.
 */
const AppFooter: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t border-border/20 py-3 mt-12 md:mt-0 shrink-0 pb-[76px] md:pb-0 bg-background md:h-10 md:flex md:flex-row md:items-center md:justify-between md:px-12">
      <p className="text-[9px] font-semibold text-muted-foreground/60 text-center md:text-left py-0.5 select-none">
        Powered by <span className="text-foreground/70">Msika</span><span className="text-green-500/80">Pos</span>
      </p>
      <p className="text-[11px] md:text-[10px] font-medium text-muted-foreground/50 text-center md:text-right py-0.5 select-none border-t border-border/10 md:border-t-0">
        © {year} Indelible Technologies. All Rights Reserved.
      </p>
    </footer>
  );
};

export default AppFooter;
