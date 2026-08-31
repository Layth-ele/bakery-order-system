/**
 * Error Boundary Component
 * 
 * Step 9: Error Boundary Implementation - CustomerDashboard Optimization
 * 
 * React Error Boundary with fallback UI, error logging, and recovery mechanisms
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ErrorBoundaryProps {
  /**
   * Child components to wrap
   */
  children: ReactNode;

  /**
   * Custom fallback UI (optional)
   */
  fallback?: (error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode;

  /**
   * Error handler callback (for logging/reporting)
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /**
   * Component name for error context
   */
  componentName?: string;

  /**
   * Show detailed error in development
   */
  showDetails?: boolean;

  /**
   * Allow user to retry
   */
  allowRetry?: boolean;

  /**
   * Custom retry handler
   */
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  showDetails: boolean;
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update state with error details
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Log to console in development
    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Send to error reporting service (e.g., Sentry)
    // this.logErrorToService(error, errorInfo);
  }

  /**
   * Reset error boundary state
   */
  resetErrorBoundary = (): void => {
    // Call custom retry handler if provided
    if (this.props.onRetry) {
      this.props.onRetry();
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  /**
   * Toggle error details visibility
   */
  toggleDetails = (): void => {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
    }));
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, showDetails } = this.state;
    const {
      children,
      fallback,
      componentName = 'Component',
      showDetails: showDetailsProps = process.env.NODE_ENV === 'development',
      allowRetry = true,
    } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback && errorInfo) {
        return fallback(error, errorInfo, this.resetErrorBoundary);
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          componentName={componentName}
          showDetails={showDetailsProps && showDetails}
          onToggleDetails={this.toggleDetails}
          onRetry={allowRetry ? this.resetErrorBoundary : undefined}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// DEFAULT ERROR FALLBACK UI
// ============================================================================

interface DefaultErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  componentName: string;
  showDetails: boolean;
  onToggleDetails: () => void;
  onRetry?: () => void;
}

function DefaultErrorFallback({
  error,
  errorInfo,
  componentName,
  showDetails,
  onToggleDetails,
  onRetry,
}: DefaultErrorFallbackProps): JSX.Element | null {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-2xl w-full bg-white dark:bg-[#1a1a1a] border border-red-200 dark:border-red-800/30 rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/30 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-1">
                {componentName} Error
              </h2>
              <p className="text-sm text-red-700 dark:text-red-300">
                Something went wrong while rendering this component
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg p-4">
            <p className="text-sm font-mono text-red-800 dark:text-red-200 break-words">
              {(error as any).message || 'An unexpected error occurred'}
            </p>
          </div>

          {/* Error Details Toggle */}
          {process.env.NODE_ENV === 'development' && errorInfo && (
            <div>
              <button
                onClick={onToggleDetails}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show Details
                  </>
                )}
              </button>

              {showDetails && (
                <div className="mt-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-auto max-h-[300px]">
                  <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                    {(error as any).stack}
                    {'\n\n'}
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#D4A574] hover:bg-[#c49563] text-white rounded-lg transition-colors font-medium"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-medium"
            >
              <Home className="h-4 w-4" />
              Go Home
            </button>
          </div>

          {/* Help Text */}
          <p className="text-xs text-gray-500 dark:text-gray-400 pt-2">
            If this problem persists, please contact support or try refreshing the page.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONVENIENCE WRAPPERS
// ============================================================================

/**
 * Simple error boundary for quick wrapping
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary componentName={componentName || Component.displayName || Component.name}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${componentName || Component.displayName || Component.name})`;

  return WrappedComponent;
}

// ============================================================================
// EXPORT
// ============================================================================

export default ErrorBoundary;
