/**
 * Centralized Scroll Utility
 * Provides consistent scroll behavior across the entire application
 * Handles both window scroll and specific container scroll
 */

/**
 * Smooth scroll to top of the page
 * Uses window as the scroll container (confirmed by min-h-screen architecture)
 */
export const scrollToTop = (options?: { behavior?: ScrollBehavior; delay?: number }) => {
  const { behavior = 'smooth', delay = 0 } = options || {};
  
  if (delay > 0) {
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior });
    }, delay);
  } else {
    window.scrollTo({ top: 0, behavior });
  }
};

/**
 * Smooth scroll to a specific position
 */
export const scrollToPosition = (position: number, behavior: ScrollBehavior = 'smooth') => {
  window.scrollTo({ top: position, behavior });
};

/**
 * Custom eased scroll animation (for luxury slow-motion effect)
 * Uses cubic easing for elegant, smooth scrolling
 */
export const smoothScrollToTopWithEasing = (duration: number = 800) => {
  const startPosition = window.pageYOffset;
  const distance = -startPosition;
  const startTime = performance.now();
  
  // Cubic ease-out function for smooth deceleration
  const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };
  
  const animation = (currentTime: number) => {
    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1);
    const easedProgress = easeOutCubic(progress);
    
    window.scrollTo(0, startPosition + distance * easedProgress);
    
    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    }
  };
  
  requestAnimationFrame(animation);
};

/**
 * Scroll a specific element (ref) to top
 * Used for modal content, sidebar sections, etc.
 */
export const scrollElementToTop = (element: HTMLElement | null, behavior: ScrollBehavior = 'smooth') => {
  if (element) {
    element.scrollTo({ top: 0, behavior });
  }
};

/**
 * Get current scroll position
 */
export const getCurrentScrollPosition = (): number => {
  return window.pageYOffset || document.documentElement.scrollTop;
};

/**
 * Save current scroll position (useful for modals)
 */
export const saveScrollPosition = (): number => {
  return getCurrentScrollPosition();
};

/**
 * Restore scroll position
 */
export const restoreScrollPosition = (position: number, delay: number = 0) => {
  if (delay > 0) {
    setTimeout(() => {
      window.scrollTo(0, position);
    }, delay);
  } else {
    window.scrollTo(0, position);
  }
};

/**
 * Scroll into view for specific element (used for form validation, etc.)
 */
export const scrollIntoView = (elementId: string, options?: ScrollIntoViewOptions) => {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', ...options });
  }
};

/**
 * Smart scroll: scroll to a DOM element accounting for sticky headers.
 * Uses requestAnimationFrame so layout is settled before measuring.
 * @param element  - The element to scroll to
 * @param offset   - Extra offset below the element top (default 16px breathing room)
 * @param behavior - Scroll behavior (default 'smooth')
 */
export const scrollToElement = (
  element: HTMLElement | Element | null,
  offset: number = 16,
  behavior: ScrollBehavior = 'smooth'
) => {
  if (!element) return;
  requestAnimationFrame(() => {
    const rect = element.getBoundingClientRect();
    // Find the fixed/sticky header height dynamically
    const stickyHeader = document.querySelector('[data-sticky-header]') as HTMLElement | null;
    const headerOffset = stickyHeader ? stickyHeader.offsetHeight : 0;
    const scrollTop = window.pageYOffset + rect.top - headerOffset - offset;
    window.scrollTo({ top: Math.max(0, scrollTop), behavior });
  });
};

/**
 * Smart scroll to element by ID
 */
export const scrollToElementById = (
  id: string,
  offset: number = 16,
  behavior: ScrollBehavior = 'smooth'
) => {
  const el = document.getElementById(id);
  if (el) scrollToElement(el, offset, behavior);
};

/**
 * Scroll to nearest scrollable parent's top (for lists, tables).
 * Falls back to window scrollToTop if no scrollable container found.
 */
export const scrollContainerToTop = (
  element: HTMLElement | null,
  behavior: ScrollBehavior = 'smooth'
) => {
  if (!element) { scrollToTop({ behavior }); return; }
  
  let el: HTMLElement | null = element;
  while (el) {
    const { overflow, overflowY } = window.getComputedStyle(el);
    const isScrollable = /(auto|scroll)/.test(overflow + overflowY);
    if (isScrollable && el.scrollHeight > el.clientHeight) {
      el.scrollTo({ top: 0, behavior });
      return;
    }
    el = el.parentElement;
  }
  // Fallback: scroll element into view
  scrollToElement(element, 16, behavior);
};
