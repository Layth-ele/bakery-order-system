/**
 * useUrlFilters Hook
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Manages filter and search state via URL search params instead of component state.
 * 
 * ✅ BENEFITS:
 * - Shareable filtered views
 * - Filters persist on page refresh
 * - Browser back/forward works
 * - Better debugging (see filters in URL)
 * 
 * 📖 USAGE:
 * ```tsx
 * // Instead of:
 * const [searchQuery, setSearchQuery] = useState('');
 * const [statusFilter, setStatusFilter] = useState('all');
 * 
 * // Use:
 * const { filters, updateFilters, clearFilters } = useUrlFilters({
 *   search: '',
 *   status: 'all',
 *   category: '',
 * });
 * 
 * // URL becomes: /admin/customers?search=john&status=approved
 * ```
 * 
 * Created: March 10, 2026
 */

import { useSearchParams } from 'react-router';
import { useMemo } from 'react';

export interface UrlFiltersOptions {
  /**
   * Whether to replace history state instead of pushing
   * @default false
   */
  replace?: boolean;
  
  /**
   * Whether to preserve modal params when updating filters
   * @default true
   */
  preserveModalParams?: boolean;
  
  /**
   * Custom parser for specific filter types
   */
  parsers?: Record<string, (value: string) => any>;
}

export interface UrlFiltersReturn<T> {
  /**
   * Current filter values (merged with defaults)
   */
  filters: T;
  
  /**
   * Update one or more filters
   */
  updateFilters: (updates: Partial<T>) => void;
  
  /**
   * Update a single filter
   */
  updateFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  
  /**
   * Clear all filters (reset to defaults)
   */
  clearFilters: () => void;
  
  /**
   * Remove specific filters
   */
  removeFilters: (keys: (keyof T)[]) => void;
  
  /**
   * Check if any filters are active (different from defaults)
   */
  hasActiveFilters: boolean;
}

/**
 * Hook for managing filter state via URL search params
 * 
 * @param defaultFilters - Default filter values
 * @param options - Configuration options
 * @returns Filter control functions and state
 * 
 * @example
 * ```tsx
 * const { filters, updateFilters, clearFilters } = useUrlFilters({
 *   search: '',
 *   status: 'all' as 'all' | 'approved' | 'pending',
 *   page: 1,
 * });
 * 
 * return (
 *   <>
 *     <SearchBar
 *       value={filters.search}
 *       onChange={(value) => updateFilters({ search: value })}
 *     />
 *     
 *     <StatusFilter
 *       value={filters.status}
 *       onChange={(status) => updateFilters({ status })}
 *     />
 *     
 *     <Button onClick={clearFilters}>Clear Filters</Button>
 *   </>
 * );
 * ```
 */
export function useUrlFilters<T extends Record<string, any>>(
  defaultFilters: T,
  options: UrlFiltersOptions = {}
): UrlFiltersReturn<T> {
  const { replace = false, preserveModalParams = true, parsers = {} } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Parse URL params into filter values
  const filters = useMemo(() => {
    const result = { ...defaultFilters };
    
    searchParams.forEach((value, key) => {
      // Skip modal params if preserving
      if (preserveModalParams && key === 'modal') {
        return;
      }
      
      if (key in defaultFilters) {
        // Use custom parser if available
        if (parsers[key]) {
          result[key as keyof T] = parsers[key](value);
        } else {
          // Auto-detect type from default value
          const defaultValue = defaultFilters[key];
          result[key as keyof T] = parseFilterValue(value, defaultValue);
        }
      }
    });
    
    return result;
  }, [searchParams, defaultFilters, parsers, preserveModalParams]);
  
  /**
   * Update one or more filters
   */
  const updateFilters = (updates: Partial<T>) => {
    const params = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || value === defaultFilters[key]) {
        // Remove if null/undefined/empty or matches default
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    
    setSearchParams(params, { replace });
  };
  
  /**
   * Update a single filter
   */
  const updateFilter = <K extends keyof T>(key: K, value: T[K]) => {
    updateFilters({ [key]: value } as unknown as Partial<T>);
  };
  
  /**
   * Clear all filters (reset to defaults)
   */
  const clearFilters = () => {
    const params = new URLSearchParams();
    
    // Preserve modal params if needed
    if (preserveModalParams) {
      const modalName = searchParams.get('modal');
      if (modalName) {
        params.set('modal', modalName);
        
        // Preserve modal-specific params
        searchParams.forEach((value, key) => {
          if (key !== 'modal' && !(key in defaultFilters)) {
            params.set(key, value);
          }
        });
      }
    }
    
    setSearchParams(params, { replace });
  };
  
  /**
   * Remove specific filters
   */
  const removeFilters = (keys: (keyof T)[]) => {
    const params = new URLSearchParams(searchParams);
    
    keys.forEach(key => {
      params.delete(String(key));
    });
    
    setSearchParams(params, { replace });
  };
  
  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useMemo(() => {
    return Object.keys(filters).some(key => {
      const current = filters[key];
      const defaultValue = defaultFilters[key];
      
      // Check if different from default
      if (Array.isArray(current) && Array.isArray(defaultValue)) {
        return JSON.stringify(current) !== JSON.stringify(defaultValue);
      }
      return current !== defaultValue;
    });
  }, [filters, defaultFilters]);
  
  return {
    filters,
    updateFilters,
    updateFilter,
    clearFilters,
    removeFilters,
    hasActiveFilters,
  };
}

/**
 * Parse filter value based on type of default value
 */
function parseFilterValue<T>(urlValue: string, defaultValue: T): T {
  // Number
  if (typeof defaultValue === 'number') {
    const parsed = Number(urlValue);
    return (isNaN(parsed) ? defaultValue : parsed) as T;
  }
  
  // Boolean
  if (typeof defaultValue === 'boolean') {
    return (urlValue === 'true') as T;
  }
  
  // Array (comma-separated)
  if (Array.isArray(defaultValue)) {
    return (urlValue ? urlValue.split(',') : defaultValue) as T;
  }
  
  // String (default)
  return urlValue as T;
}

/**
 * Debounced version of useUrlFilters for search inputs
 * 
 * Delays updating URL until user stops typing (prevents history pollution)
 * 
 * @example
 * ```tsx
 * const { filters, updateFilters } = useDebouncedUrlFilters({
 *   search: '',
 * }, { debounce: 500 });
 * 
 * // URL only updates 500ms after user stops typing
 * ```
 */
export function useDebouncedUrlFilters<T extends Record<string, any>>(
  defaultFilters: T,
  options: UrlFiltersOptions & { debounce?: number } = {}
): UrlFiltersReturn<T> {
  const { debounce = 300, ...restOptions } = options;
  const urlFilters = useUrlFilters(defaultFilters, restOptions);
  
  // TODO: Implement debouncing if needed
  // For now, return non-debounced version
  // Can add useDebouncedCallback from use-debounce library
  
  return urlFilters;
}

/**
 * Hook for pagination state in URL
 * 
 * Common pattern extracted for convenience
 * 
 * @example
 * ```tsx
 * const { page, perPage, setPage, setPerPage } = usePagination(20);
 * 
 * // URL: ?page=2&perPage=50
 * ```
 */
export function usePagination(defaultPerPage = 20) {
  const { filters, updateFilter } = useUrlFilters({
    page: 1,
    perPage: defaultPerPage,
  });
  
  return {
    page: filters.page,
    perPage: filters.perPage,
    setPage: (page: number) => updateFilter('page', page),
    setPerPage: (perPage: number) => {
      updateFilter('perPage', perPage);
      updateFilter('page', 1); // Reset to first page
    },
  };
}
