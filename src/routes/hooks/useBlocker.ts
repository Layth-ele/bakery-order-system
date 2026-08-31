/**
 * useBlocker.ts
 * Hook for blocking navigation with unsaved changes
 * 
 * Features:
 * - Prevents navigation when there are unsaved changes
 * - Shows confirmation dialog
 * - Browser beforeunload warning
 * - Luxury-styled confirmation modal
 */

import {useEffect, useCallback} from 'react'
import { useBlocker as useRouterBlocker } from 'react-router';

interface UseBlockerOptions {
  /**
   * Whether to block navigation
   */
  when: boolean;
  
  /**
   * Custom message for confirmation dialog
   */
  message?: string;
}

/**
 * Block navigation when there are unsaved changes
 * 
 * @example
 * const { shouldBlock, confirmNavigation, cancelNavigation } = useBlocker({
 *   when: hasUnsavedChanges,
 *   message: 'You have unsaved changes. Are you sure you want to leave?'
 * });
 */
export function useBlocker(options: UseBlockerOptions) {
  const { when, message = 'You have unsaved changes. Are you sure you want to leave?' } = options;
  
  // Block navigation in React Router
  const blocker = useRouterBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname
  );
  
  // Block browser navigation (refresh, close tab, etc.)
  useEffect(() => {
    if (!when) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = message;
      return message;
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [when, message]);
  
  const confirmNavigation = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }, [blocker]);
  
  const cancelNavigation = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);
  
  return {
    shouldBlock: blocker.state === 'blocked',
    confirmNavigation,
    cancelNavigation,
    blockedLocation: blocker.state === 'blocked' ? blocker.location : null,
  };
}

/**
 * Simple version that shows browser confirm dialog
 */
export function useNavigationPrompt(when: boolean, message?: string) {
  useEffect(() => {
    if (!when) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message || 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [when, message]);
}
