import React from 'react';

/**
 * Global AppFooter — Indelible Technologies branding.
 * Rendered inside MainLayout so it appears on every authenticated page.
 */
const AppFooter: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full py-2 px-4 text-center border-t border-border/20 bg-background/50 shrink-0">
      <p className="text-[9px] font-medium text-muted-foreground/50 select-none">
        Powered by <span className="text-foreground/60">Msika</span><span className="text-green-500/70">Pos</span>
        {' · '}
        © {year} Indelible Technologies. All rights reserved.
      </p>
    </footer>
  );
};

export default AppFooter;
