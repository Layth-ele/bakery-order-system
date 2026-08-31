/**
 * LoadingSkeleton Component
 * Displays animated loading placeholders during data fetch
 */

interface LoadingSkeletonProps {
  variant?: "product-table" | "dashboard" | "card" | "text";
  count?: number;
}

export function LoadingSkeleton({ 
  variant = "dashboard", 
  count = 1 
}: LoadingSkeletonProps): JSX.Element | null {
  
  // Product table skeleton
  if (variant === "product-table") {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: count }).map((_, idx) => (
          <div 
            key={idx}
            className="flex items-center gap-4 p-4 bg-[#2a2520]/30 rounded-lg border border-[#D4A574]/10"
          >
            {/* Product name */}
            <div className="flex-1">
              <div className="h-5 bg-[#D4A574]/20 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-[#D4A574]/10 rounded w-1/2"></div>
            </div>
            
            {/* Quantity inputs */}
            <div className="flex gap-2">
              {Array.from({ length: 7 }).map((_, dayIdx) => (
                <div 
                  key={dayIdx}
                  className="h-10 w-16 bg-[#D4A574]/20 rounded"
                ></div>
              ))}
            </div>
            
            {/* Total */}
            <div className="h-6 w-20 bg-[#D4A574]/20 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  // Card skeleton
  if (variant === "card") {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: count }).map((_, idx) => (
          <div 
            key={idx}
            className="p-6 bg-[#2a2520]/30 rounded-lg border border-[#D4A574]/10"
          >
            <div className="h-6 bg-[#D4A574]/20 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-[#D4A574]/10 rounded w-full"></div>
              <div className="h-4 bg-[#D4A574]/10 rounded w-5/6"></div>
              <div className="h-4 bg-[#D4A574]/10 rounded w-4/6"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Text skeleton
  if (variant === "text") {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="h-4 bg-[#D4A574]/20 rounded w-full"></div>
        ))}
      </div>
    );
  }

  // Dashboard skeleton (default)
  return (
    <div className="min-h-screen bg-[#1a1512] flex items-center justify-center">
      <div className="text-center space-y-6 animate-pulse">
        {/* Logo/Icon skeleton */}
        <div className="mx-auto h-16 w-16 bg-[#D4A574]/20 rounded-full"></div>
        
        {/* Loading text */}
        <div className="space-y-2">
          <div className="h-6 bg-[#D4A574]/20 rounded w-48 mx-auto"></div>
          <div className="h-4 bg-[#D4A574]/10 rounded w-32 mx-auto"></div>
        </div>

        {/* Spinner */}
        <div className="flex justify-center">
          <div className="h-8 w-8 border-4 border-[#D4A574]/20 border-t-[#D4A574] rounded-full animate-spin"></div>
        </div>

        {/* Additional content skeleton */}
        <div className="pt-8 space-y-3 max-w-md mx-auto">
          <div className="h-3 bg-[#D4A574]/10 rounded w-full"></div>
          <div className="h-3 bg-[#D4A574]/10 rounded w-4/5 mx-auto"></div>
          <div className="h-3 bg-[#D4A574]/10 rounded w-3/5 mx-auto"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Error Display Component
 * Shows error messages with retry option
 */
interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  variant?: "inline" | "fullscreen";
}

export function ErrorDisplay({ 
  title = "Something went wrong",
  message, 
  onRetry,
  variant = "fullscreen"
}: ErrorDisplayProps): JSX.Element | null {
  
  if (variant === "inline") {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          {/* Error icon */}
          <div className="flex-shrink-0 w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center">
            <span className="text-red-400 text-sm">!</span>
          </div>
          
          {/* Error content */}
          <div className="flex-1">
            <h3 className="text-red-400 font-semibold mb-1">{title}</h3>
            <p className="text-red-300/80 text-sm">{message}</p>
            
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fullscreen error
  return (
    <div className="min-h-screen bg-[#1a1512] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Error icon */}
        <div className="mx-auto w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center border-2 border-red-500/30">
          <svg 
            className="w-10 h-10 text-red-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>

        {/* Error text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#D4A574]">{title}</h2>
          <p className="text-[#e8dcc8]/70">{message}</p>
        </div>

        {/* Retry button */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-[#D4A574] hover:bg-[#c49564] text-[#1a1512] font-semibold rounded-lg transition-colors"
          >
            Try Again
          </button>
        )}

        {/* Support text */}
        <p className="text-sm text-[#e8dcc8]/50">
          If the problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}
