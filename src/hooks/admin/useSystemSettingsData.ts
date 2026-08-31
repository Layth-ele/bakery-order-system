import { useState, useEffect } from 'react';
import type { SystemSettings } from '../../services/data/settingsDataService';
import { isFirebaseConfigured } from '../../firebase/config';
import { getSettingsDataService } from '../../services/data/settingsDataService';
import { DEFAULT_SETTINGS } from '../../services/data/settingsDataService';

export interface StorageInfo { used: number; percentage: number; }
export interface MemoryInfo { usedJSHeapSize: number; totalJSHeapSize: number; percentage: number; }
export interface PerformanceStatus { needsCleanup: boolean; reasons: string[]; }
export interface ServerCleanupStatus { needed: boolean; }

export interface SystemSettingsData {
  settings: SystemSettings;
  loading: boolean;
  saving: boolean;
  cleanupRunning: boolean;
  serverCleanupRunning: boolean;
  storageInfo: StorageInfo | null;
  memoryInfo: MemoryInfo | null;
  performanceStatus: PerformanceStatus | null;
  serverCleanupStatus: ServerCleanupStatus | null;
  notification: string;
  setSettings: (settings: SystemSettings) => void;
  setSaving: (saving: boolean) => void;
  setCleanupRunning: (running: boolean) => void;
  setServerCleanupRunning: (running: boolean) => void;
  setNotification: (message: string) => void;
  loadSettings: () => Promise<void>;
  loadCleanupInfo: () => Promise<void>;
}

export const getLocalStorageSize = (): StorageInfo => {
  let total = 0;
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      total += localStorage[key].length + key.length;
    }
  }
  const maxSize = 5 * 1024 * 1024;
  return { used: total, percentage: (total / maxSize) * 100 };
};

export const getMemoryUsage = (): MemoryInfo | null => {
  if (typeof window !== 'undefined' && 'performance' in window && (performance as any).memory) {
    const m = (performance as any).memory;
    return {
      usedJSHeapSize: m.usedJSHeapSize,
      totalJSHeapSize: m.totalJSHeapSize,
      percentage: (m.usedJSHeapSize / m.jsHeapSizeLimit) * 100,
    };
  }
  return null;
};

export const checkPerformance = (): PerformanceStatus => {
  const storage = getLocalStorageSize();
  const memory = getMemoryUsage();
  const reasons: string[] = [];
  if (storage.percentage > 60) reasons.push(`localStorage is ${storage.percentage.toFixed(1)}% full`);
  if (memory && memory.percentage > 70) reasons.push(`Memory usage is ${memory.percentage.toFixed(1)}%`);
  return { needsCleanup: reasons.length > 0, reasons };
};

// FIX T2R4-H4 (HIGH): This function permanently returns false.  The
// "needs server cleanup" indicator UI in SystemSettingsView is therefore
// always hidden / non-actionable.  Documented here rather than removed so
// future implementers know:
//   1. The intended check is: query a "system_health" doc set by a
//      scheduled Cloud Function (e.g. counterCleanup.ts already runs
//      nightly) and read whether the orphaned-document count exceeds
//      a threshold.
//   2. Until that doc exists and the CF writes it, the indicator must
//      stay false to avoid prompting admin action that nothing can
//      satisfy.
// Either implement (1) or remove the UI in SystemSettingsView that
// references serverCleanupStatus.needed.
export const shouldRunFirestoreCleanup = async (): Promise<boolean> => false;

export function useSystemSettingsData(): SystemSettingsData {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [notification, setNotification] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [serverCleanupRunning, setServerCleanupRunning] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const [performanceStatus, setPerformanceStatus] = useState<PerformanceStatus | null>(null);
  const [serverCleanupStatus, setServerCleanupStatus] = useState<ServerCleanupStatus | null>(null);

  const loadSettings = async (): Promise<void> => {
    try {
      if (isFirebaseConfigured) {
        const service = getSettingsDataService();
        if (service) {
          const firestoreSettings = await service.getSettings();
          setSettings({ ...DEFAULT_SETTINGS, ...(firestoreSettings as any) } as SystemSettings);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setNotification('Failed to load settings. Using defaults.');
      setTimeout(() => setNotification(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const loadCleanupInfo = async (): Promise<void> => {
    setStorageInfo(getLocalStorageSize());
    setMemoryInfo(getMemoryUsage());
    setPerformanceStatus(checkPerformance());
    if (isFirebaseConfigured) {
      try {
        const needed = await shouldRunFirestoreCleanup();
        setServerCleanupStatus({ needed });
      } catch {
        setServerCleanupStatus({ needed: false });
      }
    }
  };

  useEffect(() => {
    loadSettings();
    loadCleanupInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safety: always return a defined object (prevents destructuring crash on HMR/lazy load)
  return {
    settings: settings ?? DEFAULT_SETTINGS,
    loading, saving, cleanupRunning, serverCleanupRunning,
    storageInfo, memoryInfo, performanceStatus, serverCleanupStatus, notification,
    setSettings, setSaving, setCleanupRunning, setServerCleanupRunning, setNotification,
    loadSettings, loadCleanupInfo,
  };
}
