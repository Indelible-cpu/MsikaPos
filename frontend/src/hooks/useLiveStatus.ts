import { useState, useEffect } from 'react';
import { useIsFetching } from '@tanstack/react-query';

export function useLiveStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const isFetching = useIsFetching(); // counts any active React Query fetch system-wide

  // Track online/offline
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  // Update lastSynced whenever a fetch completes (isFetching drops to 0)
  useEffect(() => {
    if (isFetching === 0) {
      setLastSynced(new Date());
    }
  }, [isFetching]);

  return { isOnline, isFetching: isFetching > 0, lastSynced };
}
