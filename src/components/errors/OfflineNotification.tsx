/**
 * OfflineNotification.tsx
 * ✅ PHASE 5: Reliability - Offline state notification
 * ✅ Notifies users when connection is lost
 * ✅ Shows when connection is restored
 */

import { useNetworkStatus, getNetworkQuality } from '../../hooks/useNetworkStatus';
import { useEffect, useState } from 'react';

/**
 * Offline notification banner
 * Shows at the top of the screen when offline
 */
export function OfflineNotification(): JSX.Element | null {
  const networkStatus = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  // Show "reconnected" message when coming back online
  useEffect(() => {
    if (networkStatus.wasOffline && networkStatus.isOnline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [networkStatus.wasOffline, networkStatus.isOnline]);

  // Don't show anything if online and wasn't offline
  if (networkStatus.isOnline && !showReconnected) {
    return null;
  }

  // Show reconnected message
  if (showReconnected) {
    return (
      <div
        className="fixed top-0 left-0 right-0 bg-green-600 text-white px-4 py-3 shadow-lg animate-slide-down z-offline-banner"
        role="alert"
        aria-live="polite"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="font-semibold">Connection Restored</p>
              <p className="text-sm text-green-100">You're back online</p>
            </div>
          </div>
          <button
            onClick={() => setShowReconnected(false)}
            className="text-white hover:text-green-100"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // Show offline message
  return (
    <div
      className="fixed top-0 left-0 right-0 bg-red-600 text-white px-4 py-3 shadow-lg z-offline-banner"
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg
            className="w-6 h-6 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
          <div>
            <p className="font-semibold">No Internet Connection</p>
            <p className="text-sm text-red-100">
              Please check your connection and try again
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Network quality indicator (optional, subtle)
 */
export function NetworkQualityIndicator(): JSX.Element | null {
  const networkStatus = useNetworkStatus();
  const quality = getNetworkQuality(networkStatus);

  // Only show for poor connections
  if (quality === 'excellent' || quality === 'good' || quality === 'offline') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 shadow-md text-sm">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        <span className="text-yellow-800">Slow connection detected</span>
      </div>
    </div>
  );
}
