/**
 * ErrorBoundary.tsx
 * Route-level error boundary for graceful error handling
 * 
 * Features:
 * - Catches React errors in route components
 * - Displays user-friendly error messages
 * - Provides recovery options (retry, go home, go back)
 * - Logs errors for debugging
 * - Matches luxury black and gold aesthetic
 */

import { Component, ReactNode } from 'react';
import { AlertTriangle, Home, ArrowLeft, RefreshCw, Bug } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Class-based error boundary component
 * (Required to use componentDidCatch lifecycle)
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleGoBack = () => {
    window.history.back();
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.handleRetry);
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-black via-[#1a1a1a] to-black flex items-center justify-center px-4">
          <div className="max-w-2xl w-full">
            {/* Error Icon */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-[#D4A574]/20 to-[#B8935E]/20 border-2 border-[#D4A574]/30 mb-6">
                <AlertTriangle className="w-12 h-12 text-[#D4A574]" />
              </div>
              
              <h1 className="text-3xl font-bold text-white mb-3">
                Something Went Wrong
              </h1>
              
              <p className="text-gray-400 text-lg">
                We encountered an unexpected error. Don't worry, your data is safe.
              </p>
            </div>

            {/* Error Details (Development Only) */}
            {typeof import.meta !== 'undefined' && import.meta.env?.DEV && (
              <div className="mb-8 bg-[#1a1a1a] border border-[#D4A574]/20 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Bug className="w-5 h-5 text-[#D4A574]" />
                  <h2 className="text-lg font-semibold text-white">
                    Error Details (Development Mode)
                  </h2>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Error Message:</p>
                    <pre className="text-sm text-red-400 bg-black/50 p-3 rounded-lg overflow-x-auto">
                      {(error as any).message}
                    </pre>
                  </div>
                  
                  {(error as any).stack && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Stack Trace:</p>
                      <pre className="text-xs text-gray-400 bg-black/50 p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                        {(error as any).stack}
                      </pre>
                    </div>
                  )}
                  
                  {errorInfo?.componentStack && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Component Stack:</p>
                      <pre className="text-xs text-gray-400 bg-black/50 p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#D4A574] to-[#B8935E] text-black rounded-lg hover:from-[#C9994A] hover:to-[#A8835E] transition-all font-semibold shadow-lg"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              
              <button
                onClick={this.handleGoBack}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition-colors border border-[#D4A574]/30"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition-colors border border-[#333]"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>

            {/* Support Message */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                If this problem persists, please contact support or refresh the page.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Function component wrapper for easier usage
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }): JSX.Element | null {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log to error tracking service in production
        if (!(typeof import.meta !== 'undefined' && import.meta.env?.DEV)) {
          console.error('Route Error:', error, errorInfo);
          // TODO: Send to error tracking service (Sentry, etc.)
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
}