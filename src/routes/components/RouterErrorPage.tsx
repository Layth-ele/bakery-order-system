/**
 * RouterErrorPage.tsx
 * Error page for React Router errors (loader failures, navigation errors, etc.)
 * 
 * This component is displayed when React Router encounters an error
 * during route loading, data fetching, or navigation.
 */

import { useRouteError, useNavigate, isRouteErrorResponse } from 'react-router';
import { AlertTriangle, Home, ArrowLeft, RefreshCw } from 'lucide-react';

export function RouterErrorPage(): JSX.Element | null {
  const error = useRouteError();
  const navigate = useNavigate();
  
  // Determine error details
  let errorMessage = 'An unexpected error occurred';
  let errorDetails: string | null = null;
  let statusCode: number | null = null;
  
  if (isRouteErrorResponse(error)) {
    // Route error response (404, 500, etc.)
    statusCode = error.status;
    errorMessage = error.statusText || errorMessage;
    errorDetails = error.data?.message || null;
  } else if (error instanceof Error) {
    // Standard JavaScript error
    errorMessage = (error as any).message;
    errorDetails = (error as any).stack || null;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  const handleRetry = () => {
    window.location.reload();
  };
  
  const handleGoHome = () => {
    navigate('/');
  };
  
  const handleGoBack = () => {
    navigate(-1);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#1a1a1a] to-black flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Error Icon & Status Code */}
        <div className="text-center mb-8">
          {statusCode && (
            <div className="mb-4">
              <h1 className="text-8xl font-bold text-[#D4A574] opacity-30">
                {statusCode}
              </h1>
            </div>
          )}
          
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#D4A574]/20 to-[#B8935E]/20 border-2 border-[#D4A574]/30 mb-6">
            <AlertTriangle className="w-10 h-10 text-[#D4A574]" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-3">
            {statusCode === 404 ? 'Page Not Found' : 'Something Went Wrong'}
          </h2>
          
          <p className="text-gray-400 text-lg">
            {errorMessage}
          </p>
        </div>

        {/* Error Details (Development Only) */}
        {typeof import.meta !== 'undefined' && import.meta.env?.DEV && errorDetails && (
          <div className="mb-8 bg-[#1a1a1a] border border-[#D4A574]/20 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D4A574]" />
              Error Details (Development Mode)
            </h3>
            <pre className="text-xs text-gray-400 bg-black/50 p-4 rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
              {errorDetails}
            </pre>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleRetry}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#D4A574] to-[#B8935E] text-black rounded-lg hover:from-[#C9994A] hover:to-[#A8835E] transition-all font-semibold shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
          
          <button
            onClick={handleGoBack}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition-colors border border-[#D4A574]/30"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          
          <button
            onClick={handleGoHome}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition-colors border border-[#333]"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            {statusCode === 404 
              ? 'The page you\'re looking for doesn\'t exist or has been moved.'
              : 'If this problem persists, please try refreshing the page or contact support.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}