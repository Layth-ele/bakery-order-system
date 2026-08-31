/**
 * useCleanup Hook - Firebase Mode
 * ✅ localStorage cleanup removed - Firebase is the only data source
 */
import { useState, useCallback } from 'react';

export function useCleanup() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runCleanup = useCallback(async () => {
    setIsRunning(true);
    try {
      // Firebase mode - no localStorage to clean
      setLastRun(new Date());
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { isRunning, lastRun, runCleanup };
}
