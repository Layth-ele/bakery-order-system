/**
 * SystemSettings.tsx
 * 🟢 PAGE - System configuration and settings
 *
 * REFACTORED - Phase 2: Data-Logic-View Separation Complete
 * - Extracted data layer to useSystemSettingsData hook
 * - Extracted settings actions to useSettingsActions hook
 * - Extracted cleanup actions to useCleanupActions hook
 * - Extracted view layer to SystemSettingsView component
 * - Reduced from 1328 lines to ~150 lines (89% reduction)
 *
 * Route-level page component for admin system configuration.
 *
 * Used by: Admin routes
 * Location: /pages/admin/SystemSettings.tsx
 */

import React, { useCallback, useState } from 'react';
import { User } from '../../hooks/useAuth';

// ✅ PHASE 2 REFACTOR: Import extracted hooks
import { useSystemSettingsData } from '../../hooks/admin/useSystemSettingsData';
import { useSettingsActions } from '../../hooks/admin/useSettingsActions';
import { useCleanupActions } from '../../hooks/admin/useCleanupActions';

// ✅ PHASE 2 REFACTOR: Import extracted view component
import { SystemSettingsView } from '../../components/admin/system-settings/SystemSettingsView';

// ✅ MAR 16, 2026: Import timestamp fix utility
import { fixAllOrderTimestamps } from '../../utils/fixOrderTimestamps';

// ============================================================================
// TYPES
// ============================================================================

interface SystemSettingsProps {
  user: User;
  setCurrentPage?: (page: any) => void;
  onBack?: () => void;
  onLogout?: () => void;
  isActive?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SystemSettings({ user, setCurrentPage }: SystemSettingsProps): JSX.Element | null {
  // ============================================================================
  // HOOKS - Data and logic layers
  // ============================================================================
  
  // Data layer - All data fetching and state management
  const settingsData = useSystemSettingsData();
  const {
    settings,
    loading,
    saving,
    cleanupRunning,
    serverCleanupRunning,
    storageInfo,
    memoryInfo,
    performanceStatus,
    serverCleanupStatus,
    notification,
    setSettings,
    setSaving,
    setCleanupRunning,
    setServerCleanupRunning,
    setNotification,
    loadSettings,
    loadCleanupInfo,
  } = settingsData ?? {};
  
 // Local state for timestamp fix operation
  const [timestampFixRunning, setTimestampFixRunning] = useState(false);
  const [notificationType, setNotificationType] = useState<'success' | 'error' | 'warning'>('success');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!loadSettings) return;
    setIsRefreshing(true);
    try {
      await loadSettings();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSettings]);
  
  // settingsData is guaranteed non-null due to ?? {} and hook's DEFAULT_SETTINGS fallback
  
  // ============================================================================
  // NOTIFICATION HELPERS
  // ============================================================================
  
  const showSuccess = useCallback((message: string) => {
    setNotificationType('success');
    setNotification(message);
    setTimeout(() => setNotification(''), 3000);
  }, [setNotification]);

  const showError = useCallback((message: string) => {
    setNotificationType('error');
    setNotification(message);
    setTimeout(() => setNotification(''), 5000);
  }, [setNotification]);

  const showNotification = showSuccess; // backward compat for cleanup/timestamp handlers
  
  // ============================================================================
  // ACTION HOOKS - Business logic
  // ============================================================================
  
  // Settings save operations
  const { saveSettings } = useSettingsActions({
    onSuccess: showSuccess,
    onError: showError,
    setSaving,
  });
  
  // Cleanup operations
  const { runClientCleanup } = useCleanupActions({
    onSuccess: showNotification,
    onError: showNotification,
    setCleanupRunning,
    setServerCleanupRunning,
    loadCleanupInfo,
  });
  
  // ============================================================================
  // HANDLERS - Thin wrappers around action hooks
  // ============================================================================
  
  const handleSave = useCallback(() => {
    saveSettings(settings);
  }, [saveSettings, settings]);
  
  const handleCleanup = useCallback(() => {
    runClientCleanup();
  }, [runClientCleanup]);
  
 // Handle timestamp fix operation
  const handleFixTimestamps = useCallback(async () => {
    setTimestampFixRunning(true);
    try {
      await fixAllOrderTimestamps();
      showNotification('✅ Order timestamps fixed successfully!');
    } catch (error) {
      console.error('Error fixing timestamps:', error);
      showNotification('❌ Error fixing timestamps. Check console for details.');
    } finally {
      setTimestampFixRunning(false);
    }
  }, [showNotification]);
  
  // ❌ REMOVED MAR 14, 2026: handleFirebaseCleanup (button removed from UI)
  
  // ============================================================================
  // RENDER - Delegate to view component
  // ============================================================================
  
  return (
    <SystemSettingsView
      // Data
      settings={settings}
      storageInfo={storageInfo}
      memoryInfo={memoryInfo}
      performanceStatus={performanceStatus}
      serverCleanupStatus={serverCleanupStatus}
      
      // Loading states
      loading={loading}
      saving={saving}
      cleanupRunning={cleanupRunning}
      timestampFixRunning={timestampFixRunning}
      // ❌ REMOVED MAR 14, 2026: serverCleanupRunning (Firebase cleanup removed)
      
      // UI state
      notification={notification}
      notificationType={notificationType}
      
      // Actions
      onSettingsChange={setSettings}
      onSave={handleSave}
      onCleanup={handleCleanup}
      onFixTimestamps={handleFixTimestamps}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      // ❌ REMOVED MAR 14, 2026: onFirebaseCleanup (Firebase cleanup removed)
      onCloseNotification={() => setNotification('')}
    />
  );
}