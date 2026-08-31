/**
 * useDocumentTitle.ts
 * Hook for managing document title dynamically
 * 
 * Features:
 * - Sets page title based on current route
 * - Auto-cleanup on unmount
 * - Consistent title format
 */

import { useEffect } from 'react';

const APP_NAME = 'Bakery Order Management';

interface UseDocumentTitleOptions {
  /**
   * The page title
   */
  title?: string;
  
  /**
   * Whether to append the app name
   * @default true
   */
  appendAppName?: boolean;
  
  /**
   * Custom separator between title and app name
   * @default ' | '
   */
  separator?: string;
}

/**
 * Sets the document title
 * 
 * @example
 * useDocumentTitle({ title: 'Pending Orders' })
 * // Document title: "Pending Orders | Bakery Order Management"
 * 
 * @example
 * useDocumentTitle({ title: 'Dashboard', appendAppName: false })
 * // Document title: "Dashboard"
 */
export function useDocumentTitle(options: UseDocumentTitleOptions = {}) {
  const {
    title,
    appendAppName = true,
    separator = ' | ',
  } = options;
  
  useEffect(() => {
    const previousTitle = document.title;
    
    if (!title) {
      document.title = APP_NAME;
    } else if (appendAppName) {
      document.title = `${title}${separator}${APP_NAME}`;
    } else {
      document.title = title;
    }
    
    // Cleanup: restore previous title on unmount
    return () => {
      document.title = previousTitle;
    };
  }, [title, appendAppName, separator]);
}

/**
 * Simple version that only takes a title string
 */
export function usePageTitle(title: string) {
  useDocumentTitle({ title });
}
