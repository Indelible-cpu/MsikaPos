import { useEffect, useRef } from 'react';

/**
 * Hook to automatically save form state to localStorage
 * Aligned with EduPayTrack patterns for data persistence.
 */
export function useFormAutosave<T>(
  key: string,
  data: T,
  options: { debounce?: number; enabled?: boolean } = {}
) {
  const { debounce = 1000, enabled = true } = options;
  const timeoutRef = useRef<number | null>(null);

  // Initialize form with saved data if available
  useEffect(() => {
    if (!enabled) return;

    const saved = localStorage.getItem(`autosave:${key}`);
    if (saved) {
      try {
        // We don't return the data here because the hook only handles SAVING.
        // The component should call localStorage.getItem separately to initialize.
        console.log(`📝 Autosave: Found draft for ${key}`);
      } catch (e) {
        console.error('Failed to load autosave data', e);
      }
    }
  }, [key, enabled]);

  // Save data on change with debounce
  useEffect(() => {
    if (!enabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      if (data && Object.keys(data).length > 0) {
        localStorage.setItem(`autosave:${key}`, JSON.stringify(data));
        // console.log(`💾 Autosave: Draft saved for ${key}`);
      }
    }, debounce);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, data, debounce, enabled]);

  const clearAutosave = () => {
    localStorage.removeItem(`autosave:${key}`);
  };

  return { clearAutosave };
}
