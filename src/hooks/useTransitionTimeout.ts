import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to manage transition timeouts with automatic cleanup
 * Prevents memory leaks from setTimeout calls during pagination transitions
 */
export function useTransitionTimeout() {
  const timeoutsRef = useRef<Set<number>>(new Set());

  // Clear all timeouts
  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current.clear();
  }, []);

  // Add a new timeout and track it
  const addTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(() => {
      callback();
      // Remove from set after execution
      timeoutsRef.current.delete(timeoutId);
    }, delay);
    
    timeoutsRef.current.add(timeoutId);
    return timeoutId;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  return { addTimeout, clearAllTimeouts };
}
