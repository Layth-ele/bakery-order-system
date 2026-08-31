/**
 * Page Transitions Utility
 * 
 * Provides smooth page transitions with fade effects for better UX
 */

import { scrollToTop } from './scrollUtils';

/**
 * Handles page transitions with a fade effect
 * Scrolls to top and executes callback after transition
 * 
 * @param callback - Function to execute during transition
 */
export const handlePageTransition = (callback: () => void) => {
  // Scroll to top immediately
  scrollToTop();
  
  // Execute callback (state change)
  callback();
};

/**
 * Enhanced page change handler for admin/customer dashboards
 * Ensures scroll to top happens immediately on click
 * @param page - The page to navigate to
 * @param setCurrentPage - State setter function
 */
export const handleSmoothPageChange = (page: string, setCurrentPage: (page: any) => void) => {
  handlePageTransition(() => {
    setCurrentPage(page as any);
  });
};
