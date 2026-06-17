import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  shopName: string;
  shopLogo: string | null;
  theme: 'light' | 'dark' | 'auto';
  setShopName: (name: string) => void;
  setShopLogo: (logo: string | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      shopName: 'Smart Pos System',
      shopLogo: null,
      theme: 'auto',
      setShopName: (shopName) => set({ shopName }),
      setShopLogo: (shopLogo) => set({ shopLogo }),
      setTheme: (theme) => {
        set({ theme });
        const root = document.documentElement;
        if (theme === 'dark') {
          root.classList.add('dark');
        } else if (theme === 'light') {
          root.classList.remove('dark');
        } else {
          // 'auto' - follow system preference
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          prefersDark ? root.classList.add('dark') : root.classList.remove('dark');
        }
      },
    }),
    {
      name: 'smart-pos-settings',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setTheme(state.theme); // Apply theme on load
        }
      }
    }
  )
);
