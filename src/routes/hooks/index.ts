/**
 * routes/hooks/index.ts
 * Re-export all route hooks for easier importing
 * 
 * Created: March 10, 2026
 */

// URL Filters & Pagination
export {
  useUrlFilters,
  useDebouncedUrlFilters,
  usePagination,
} from './useUrlFilters';
export type { UrlFiltersOptions, UrlFiltersReturn } from './useUrlFilters';

// Modal Routing
export {
  useModalRouter,
  useTypedModalRouter,
  useCurrentModal,
  useHasOpenModal,
} from './useModalRouter';
export type { ModalRouterOptions, ModalRouterReturn } from './useModalRouter';

// Other route hooks
export { useDocumentTitle, usePageTitle } from './useDocumentTitle';
export { useBlocker, useNavigationPrompt } from './useBlocker';
export { useFormBlocker, useReactHookFormBlocker } from './useFormBlocker';
