import React from 'react';

/**
 * Global AppFooter — Indelible Technologies branding.
 * Rendered inside MainLayout so it appears on every authenticated page.
 */
const AppFooter: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full py-1 px-4 text-center border-t border-border/10 bg-background/30 shrink-0">
      <p className="text-[7px] font-medium text-muted-foreground/25 select-none leading-none">
        Powered by <span className="text-foreground/30">Msika</span><span className="text-green-500/40">Pos</span>
        {' · '}
        © {year} Indelible Technologies. All rights reserved.
      </p>
    </footer>
  );
};

export default AppFooter;
