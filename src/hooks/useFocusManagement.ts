/**
 * useFocusManagement.ts
 * ✅ PHASE 4: Accessibility - Focus management utilities
 * ✅ Helps manage focus for modals, tabs, and dynamic content
 * ✅ Ensures focus is properly restored after interactions
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to restore focus when a component unmounts
 * Useful for modals and temporary UI elements
 */
export function useRestoreFocus() {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Store the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    return () => {
      // Restore focus when component unmounts
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, []);
}

/**
 * Hook to automatically focus an element when a condition is met
 */
export function useAutoFocus(
  elementRef: React.RefObject<HTMLElement>,
  shouldFocus: boolean,
  delay: number = 100
) {
  useEffect(() => {
    if (shouldFocus && elementRef.current) {
      const timer = setTimeout(() => {
        elementRef.current?.focus();
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [elementRef, shouldFocus, delay]);
}

/**
 * Hook to manage focus within a list of items
 * Provides keyboard navigation for lists
 */
export function useListNavigation(
  itemCount: number,
  onSelect: (index: number) => void
) {
  const currentIndexRef = useRef(0);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          currentIndexRef.current = Math.min(currentIndexRef.current + 1, itemCount - 1);
          onSelect(currentIndexRef.current);
          break;
        case 'ArrowUp':
          event.preventDefault();
          currentIndexRef.current = Math.max(currentIndexRef.current - 1, 0);
          onSelect(currentIndexRef.current);
          break;
        case 'Home':
          event.preventDefault();
          currentIndexRef.current = 0;
          onSelect(currentIndexRef.current);
          break;
        case 'End':
          event.preventDefault();
          currentIndexRef.current = itemCount - 1;
          onSelect(currentIndexRef.current);
          break;
      }
    },
    [itemCount, onSelect]
  );

  return { handleKeyDown };
}

/**
 * Hook to announce changes to screen readers
 */
export function useScreenReaderAnnouncement() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  return { announce };
}
