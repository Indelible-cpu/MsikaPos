import React from 'react';

/**
 * Global AppFooter — Indelible Technologies branding.
 * Rendered inside MainLayout on every authenticated page.
 */
const AppFooter: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t border-border/20 shrink-0 bg-background">
      <div className="flex flex-col md:flex-row items-center justify-between px-6 md:px-12 py-2 gap-0.5 md:gap-0">
        <p className="text-[9px] font-semibold text-muted-foreground/60 select-none">
          Powered by <span className="text-foreground/70">Msika</span><span className="text-green-500/80">Pos</span>
        </p>
        <p className="text-[9px] font-medium text-muted-foreground/50 select-none">
          © {year} Indelible Technologies. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
};

export default AppFooter;
