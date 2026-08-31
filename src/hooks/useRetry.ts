/**
 * useRetry.ts
 * ✅ PHASE 5: Reliability - Retry mechanism hook
 * ✅ Automatic retry with exponential backoff
 * ✅ Manual retry support
 */

import { useState, useCallback } from 'react';
import { AppError, withErrorHandling } from '../utils/error/errorHandling';

interface UseRetryOptions {
  maxRetries?: number;
  onError?: (error: AppError) => void;
  // BUG FIX: typed as () => void but callers (e.g. useOrderSubmission) pass async
  // functions that include `await onClearCart()`. The async work was fire-and-forgot,
  // meaning the cart could still show items after order submission. Now typed as
  // () => void | Promise<void> and properly awaited.
  onSuccess?: () => void | Promise<void>;
}

interface RetryState {
  isLoading: boolean;
  error: AppError | null;
  attemptCount: number;
}

/**
 * Hook for retryable operations
 */
export function useRetry<T>(
  operation: () => Promise<T>,
  context: string,
  options: UseRetryOptions = {}
) {
  const { maxRetries = 3, onError, onSuccess } = options;

  const [state, setState] = useState<RetryState>({
    isLoading: false,
    error: null,
    attemptCount: 0,
  });

  const execute = useCallback(async (): Promise<T | null> => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      attemptCount: prev.attemptCount + 1,
    }));

    const result = await withErrorHandling(operation, context, maxRetries);

    if (result.success) {
      setState({
        isLoading: false,
        error: null,
        attemptCount: 0,
      });
      
      if (onSuccess) {
        // BUG FIX: was `onSuccess()` — not awaited. Async work like cart clearing
        // was fire-and-forgot, leading to stale cart state after order submission.
        await onSuccess();
      }
      
      return result.data;
    } else {
      const errorValue = (result as { error: AppError }).error;
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorValue,
      }));
      
      if (onError) {
        onError(errorValue);
      }
      
      return null;
    }
  }, [operation, context, maxRetries, onError, onSuccess]);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      attemptCount: 0,
    });
  }, []);

  return {
    execute,
    reset,
    isLoading: state.isLoading,
    error: state.error,
    attemptCount: state.attemptCount,
    canRetry: state.error?.canRetry ?? false,
  };
}
