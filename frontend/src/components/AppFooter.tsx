import React from 'react';

/**
 * Global AppFooter — Indelible Technologies branding.
 * Rendered inside MainLayout on every authenticated page.
 */
const AppFooter: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full mt-auto border-t border-border/20 bg-background/60">
      <p className="text-[11px] font-semibold text-muted-foreground/60 text-center py-1 select-none">
        Powered by <span className="text-foreground/70">Msika</span><span className="text-green-500/80">Pos</span>
      </p>
      <p className="text-[10px] font-medium text-muted-foreground/50 text-center w-full px-0 py-1 select-none border-t border-border/10">
        © {year} Indelible Technologies. All rights reserved
      </p>
    </footer>
  );
};

export default AppFooter;
