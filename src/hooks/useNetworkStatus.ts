/**
 * useNetworkStatus.ts
 * ✅ PHASE 5: Reliability - Network status detection
 * ✅ Detects online/offline state
 * ✅ Provides network quality information
 */

import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
}

/**
 * Hook to monitor network status
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    wasOffline: false,
    effectiveType: null,
    downlink: null,
    rtt: null,
  });

  useEffect(() => {
    // Update network status
    const updateNetworkStatus = () => {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;

      setStatus(prev => ({
        isOnline: navigator.onLine,
        wasOffline: prev.isOnline === false && navigator.onLine === true,
        effectiveType: connection?.effectiveType || null,
        downlink: connection?.downlink || null,
        rtt: connection?.rtt || null,
      }));
    };

    // Handle online event
    const handleOnline = () => {
      setStatus(prev => ({
        ...prev,
        isOnline: true,
        wasOffline: true, // Mark that we were offline
      }));
    };

    // Handle offline event
    const handleOffline = () => {
      setStatus(prev => ({
        ...prev,
        isOnline: false,
      }));
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    // Initial check
    updateNetworkStatus();

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, []);

  // Reset wasOffline flag after some time
  useEffect(() => {
    if (status.wasOffline) {
      const timer = setTimeout(() => {
        setStatus(prev => ({ ...prev, wasOffline: false }));
      }, 5000); // Reset after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [status.wasOffline]);

  return status;
}

/**
 * Get network quality description
 */
export function getNetworkQuality(status: NetworkStatus): 'excellent' | 'good' | 'poor' | 'offline' {
  if (!status.isOnline) return 'offline';
  
  if (status.effectiveType === '4g' || status.effectiveType === '5g') {
    return 'excellent';
  }
  
  if (status.effectiveType === '3g') {
    return 'good';
  }
  
  if (status.effectiveType === '2g' || status.effectiveType === 'slow-2g') {
    return 'poor';
  }
  
  // Default to good if we can't determine
  return 'good';
}
