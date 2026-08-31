/**
 * Section Error Boundary
 * 
 * Step 9: Error Boundary Implementation - CustomerDashboard Optimization
 * 
 * Lightweight error boundary for dashboard sections with inline recovery
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw, XCircle } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface SectionErrorBoundaryProps {
  children: ReactNode;
  sectionName: string;
  fallbackHeight?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showMinimal?: boolean;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================================
// SECTION ERROR BOUNDARY
// ============================================================================

/**
 * Lightweight error boundary for dashboard sections
 * Shows inline error message without breaking entire page
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<SectionErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error
    console.error(`Error in ${this.props.sectionName}:`, error, errorInfo);

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, sectionName, fallbackHeight = '200px', showMinimal = false } = this.props;

    if (hasError && error) {
      if (showMinimal) {
        return <MinimalErrorFallback sectionName={sectionName} onRetry={this.resetError} />;
      }

      return (
        <InlineErrorFallback
          sectionName={sectionName}
          error={error}
          onRetry={this.resetError}
          height={fallbackHeight}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// INLINE ERROR FALLBACK
// ============================================================================

interface InlineErrorFallbackProps {
  sectionName: string;
  error: Error;
  onRetry: () => void;
  height: string;
}

function InlineErrorFallback({
  sectionName,
  error,
  onRetry,
  height,
}: InlineErrorFallbackProps): JSX.Element | null {
  return (
    <div
      className="flex items-center justify-center border-2 border-dashed border-red-300 dark:border-red-800/50 rounded-lg bg-red-50/50 dark:bg-red-900/10"
      style={{ minHeight: height }}
    >
      <div className="text-center px-4 py-6 max-w-md">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>

        <h3 className="text-base font-semibold text-red-900 dark:text-red-200 mb-2">
          Error Loading {sectionName}
        </h3>

        <p className="text-sm text-red-700 dark:text-red-300 mb-4">
          {(error as any).message || 'Something went wrong'}
        </p>

        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4A574] hover:bg-[#c49563] text-white text-sm font-medium rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MINIMAL ERROR FALLBACK
// ============================================================================

interface MinimalErrorFallbackProps {
  sectionName: string;
  onRetry: () => void;
}

function MinimalErrorFallback({ sectionName, onRetry }: MinimalErrorFallbackProps): JSX.Element | null {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
      <span className="text-sm text-red-700 dark:text-red-300 flex-1">
        Failed to load {sectionName}
      </span>
      <button
        onClick={onRetry}
        className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 font-medium transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

// ============================================================================
// EXPORT
// ============================================================================

export default SectionErrorBoundary;
