import React from 'react';
import { Sun, Moon, Monitor, Laptop } from 'lucide-react';
import { useThemeStore, Theme } from '../hooks/useThemeStore';
import { motion, AnimatePresence } from 'framer-motion';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useThemeStore();

  const options: { id: Theme; icon: React.ReactNode; label: string }[] = [
    { id: 'light', icon: <Sun className="w-4 h-4" />, label: 'Light' },
    { id: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
    { id: 'system', icon: <Monitor className="w-4 h-4" />, label: 'System' },
  ];

  return (
    <div className="flex items-center p-1 bg-surface-card/50 backdrop-blur-sm border border-surface-border rounded-full shadow-inner ring-1 ring-black/5">
      {options.map((option) => {
        const isActive = theme === option.id;
        return (
          <button
            key={option.id}
            onClick={() => setTheme(option.id)}
            className={`
              relative flex items-center justify-center p-2 rounded-full transition-all duration-300
              ${isActive ? 'text-primary-500' : 'text-surface-text/60 hover:text-surface-text'}
            `}
            title={option.label}
          >
            {isActive && (
              <motion.div
                layoutId="activeTheme"
                className="absolute inset-0 bg-primary-500/10 rounded-full border border-primary-500/20"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">{option.icon}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
