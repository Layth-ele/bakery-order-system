import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to manage notification timeouts with automatic cleanup
 * Prevents memory leaks from setTimeout calls
 */
export function useNotificationTimeout() {
  const timeoutRef = useRef<number | null>(null);

  // Clear any existing timeout
  const clearNotificationTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Set a new timeout and clear the previous one
  const setNotificationTimeout = useCallback((callback: () => void, delay: number) => {
    // Clear existing timeout first
    clearNotificationTimeout();
    
    // Set new timeout
    timeoutRef.current = window.setTimeout(callback, delay);
  }, [clearNotificationTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearNotificationTimeout();
    };
  }, [clearNotificationTimeout]);

  return { setNotificationTimeout, clearNotificationTimeout };
}

/**
 * Convenience hook for showing temporary notifications
 * Usage:
 *   const showTempNotification = useTemporaryNotification(setNotification);
 *   showTempNotification('Success!', 3000);
 */
export function useTemporaryNotification(setNotification: (msg: string) => void) {
  const { setNotificationTimeout } = useNotificationTimeout();

  return useCallback((message: string, duration: number = 3000) => {
    setNotification(message);
    setNotificationTimeout(() => setNotification(''), duration);
  }, [setNotification, setNotificationTimeout]);
}
