/**
 * Smart Scroll Hooks
 *
 * Scrolls to the main content area (not window top) when navigating.
 * Respects sticky headers by measuring their height before scrolling.
 */

import { useEffect } from 'react';

/**
 * Scroll to the page's content area on mount, accounting for sticky headers.
 * Looks for a [data-main-content] attribute first, then falls back to window top.
 * @param behavior - 'smooth' | 'auto' (default: 'auto' for instant on initial load)
 */
export const useScrollToTop = (behavior: ScrollBehavior = 'auto') => {
  useEffect(() => {
    requestAnimationFrame(() => {
      // Look for explicit content anchor first
      const contentAnchor = document.querySelector('[data-scroll-anchor]') as HTMLElement | null;
      if (contentAnchor) {
        const stickyHeader = document.querySelector('[data-sticky-header]') as HTMLElement | null;
        const headerH = stickyHeader ? stickyHeader.offsetHeight : 0;
        const rect = contentAnchor.getBoundingClientRect();
        const scrollTop = window.pageYOffset + rect.top - headerH - 8;
        window.scrollTo({ top: Math.max(0, scrollTop), behavior });
        return;
      }
      // Fallback: gentle scroll to top (not jarring zero)
      window.scrollTo({ top: 0, behavior });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

/**
 * Scroll to top whenever dependencies change.
 */
export const useScrollToTopOnChange = (
  dependencies: any[],
  behavior: ScrollBehavior = 'smooth'
) => {
  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
};
