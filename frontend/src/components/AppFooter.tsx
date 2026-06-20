import React from 'react';

/**
 * Global AppFooter — Indelible Technologies branding.
 * Rendered inside MainLayout on every authenticated page.
 */
const AppFooter: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t border-border/20 py-2 shrink-0 pb-[90px] md:pb-6 bg-background">
      <p className="text-[9px] font-semibold text-muted-foreground/60 text-center py-0.5 select-none">
        Powered by <span className="text-foreground/70">Msika</span><span className="text-green-500/80">Pos</span>
      </p>
      <p className="text-[11px] font-medium text-muted-foreground/50 text-center w-full py-0.5 select-none border-t border-border/10">
        © {year} Indelible Technologies. All Rights Reserved.
      </p>
    </footer>
  );
};

export default AppFooter;
