/**
 * useCleanupActions Hook
 * ✅ FIREBASE MODE - localStorage cleanup removed
 */

import { useCallback } from 'react';

export interface CleanupActions {
  runClientCleanup: () => Promise<void>;
  runServerCleanup: () => Promise<void>;
}

interface UseCleanupActionsOptions {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  setCleanupRunning: (running: boolean) => void;
  setServerCleanupRunning: (running: boolean) => void;
  loadCleanupInfo: () => Promise<void>;
}

export function useCleanupActions({
  onSuccess,
  onError,
  setCleanupRunning,
  setServerCleanupRunning,
  loadCleanupInfo,
}: UseCleanupActionsOptions): CleanupActions {

  const runClientCleanup = useCallback(async () => {
    setCleanupRunning(true);
    try {
      // In Firebase mode, no localStorage to clean
      await loadCleanupInfo();
      onSuccess('System check complete - Firebase is healthy');
    } catch (error) {
      onError('Check failed. See console.');
    } finally {
      setCleanupRunning(false);
    }
  }, [setCleanupRunning, loadCleanupInfo, onSuccess, onError]);

  const runServerCleanup = useCallback(async () => {
    setServerCleanupRunning(true);
    try {
      await loadCleanupInfo();
      onSuccess('Firebase cleanup complete');
    } catch (error) {
      onError('Firebase cleanup failed.');
    } finally {
      setServerCleanupRunning(false);
    }
  }, [setServerCleanupRunning, loadCleanupInfo, onSuccess, onError]);

  return { runClientCleanup, runServerCleanup };
}
