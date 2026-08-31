/**
 * useHeaderHeight
 *
 * Tracks the height of a header element using ResizeObserver.
 * Extracted from CustomerDashboardMain to reduce its size.
 */
import { useState, useEffect, RefObject } from 'react';

export function useHeaderHeight(
  headerRef: RefObject<HTMLDivElement>,
  activeTab: string
): number {
  const [headerHeight, setHeaderHeight] = useState(112);

  useEffect(() => {
    let resizeTimeout: ReturnType<typeof setTimeout>;

    const updateHeaderHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.clientHeight);
      }
    };

    const debouncedUpdate = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateHeaderHeight, 150);
    };

    updateHeaderHeight();
    const timer = setTimeout(updateHeaderHeight, 100);

    let resizeObserver: ResizeObserver | null = null;
    if (headerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(debouncedUpdate);
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener('resize', debouncedUpdate);

    return () => {
      clearTimeout(resizeTimeout);
      clearTimeout(timer);
      window.removeEventListener('resize', debouncedUpdate);
      resizeObserver?.disconnect();
    };
  }, [activeTab, headerRef]);

  return headerHeight;
}
