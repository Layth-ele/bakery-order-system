/**
 * Error Handling Components - Index
 * 
 * Step 9: Error Boundary Implementation - CustomerDashboard Optimization
 * ✅ MAR 14, 2026: Removed unused error fallback exports
 * 
 * Centralized exports for all error handling components
 */

// Error Boundaries
export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';
export { SectionErrorBoundary } from './SectionErrorBoundary';

// Offline/Network Status
export { OfflineNotification, NetworkQualityIndicator } from './OfflineNotification';

// Error Logging
export {
  ErrorLogger,
  ErrorSeverity,
  ErrorCategory,
  logRenderError,
  logCartError,
  logOrderError,
  logNetworkError,
  logValidationError,
} from './ErrorLogger';

export type { ErrorLogEntry } from './ErrorLogger';