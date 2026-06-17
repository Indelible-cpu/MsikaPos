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
        set({ theme: 'auto' }); // Force auto for OS theme reliance
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
