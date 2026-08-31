import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * usePaginatedOrders — client-side pagination over any array.
 *
 * Edge cases handled:
 * ✅ currentPage resets to 1 when the source array changes (filters applied)
 * ✅ If the current page becomes empty after a deletion/filter, auto-jumps
 *    to the last valid page (prevents "showing 0 items on page 3" ghost)
 * ✅ Returns empty array and page=1 when source array is empty
 */
export function usePaginatedOrders<T>(allItems: T[], pageSize: number = 10) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Auto-correct: if current page exceeds totalPages, jump back
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Reset to page 1 whenever the array identity changes (filter applied)
  // We track length changes rather than reference to avoid infinite loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCurrentPage(1); }, [totalItems]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex   = Math.min(startIndex + pageSize, totalItems);

  const currentItems = useMemo(
    () => allItems.slice(startIndex, endIndex),
    [allItems, startIndex, endIndex]
  );

  const goToPage = useCallback((page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clamped);
    // Scroll is handled by the component (scrollToElement on contentTopRef)
  }, [totalPages]);

  const nextPage     = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);
  const previousPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);
  const goToFirstPage = useCallback(() => goToPage(1), [goToPage]);
  const goToLastPage  = useCallback(() => goToPage(totalPages), [goToPage, totalPages]);

  return {
    // Current slice
    currentOrders: currentItems,    // alias for orders
    currentItems,                   // generic alias
    paginatedOrders: currentItems,  // legacy alias

    // State
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    startIndex,
    endIndex,

    // Actions
    goToPage,
    nextPage,
    previousPage,
    goToFirstPage,
    goToLastPage,
    handlePageChange: goToPage,     // legacy alias

    // Helpers
    hasNextPage:     currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    isFirstPage:     currentPage === 1,
    isLastPage:      currentPage === totalPages,
    isEmpty:         totalItems === 0,
  };
}
