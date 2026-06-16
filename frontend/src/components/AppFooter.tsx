import React from 'react';

/**
 * Global AppFooter — Indelible Technologies branding.
 * Rendered inside MainLayout so it appears on every authenticated page.
 */
const AppFooter: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full py-3 px-4 text-center border-t border-border/20 bg-background/50 backdrop-blur-sm shrink-0">
      <p className="text-[9px] font-bold tracking-widest text-muted-foreground/40 uppercase leading-relaxed select-none">
        Powered by{' '}
        <span className="text-foreground/50">Msika</span>
        <span className="text-green-500/70">Pos</span>
        {'  ·  '}
        © {year} indelible technologies. all rights reserved.
      </p>
    </footer>
  );
};

export default AppFooter;
