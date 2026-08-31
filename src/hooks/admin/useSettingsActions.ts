/**
 * useSettingsActions Hook
 * 🟢 HOOK - Settings save operations
 * 
 * REFACTORED - Phase 2: Business Logic Extraction
 * - Extracted from SystemSettings.tsx (1328 lines)
 * - Handles settings save operations
 * 
 * Responsibilities:
 * - Handle success/error notifications
 * - ✅ FIXED MAR 14, 2026: Added Zod validation before save
 * - ✅ FIXED MAR 14, 2026: Added cache invalidation after save
 * 
 * Used by: /pages/admin/SystemSettings.tsx
 * Location: /hooks/admin/useSettingsActions.ts
 */

import { useCallback } from 'react';
import type { Settings } from '../../types/domain';
import { isFirebaseConfigured } from '../../firebase/config';
import { getSettingsDataService } from '../../services/data/settingsDataService';
import { useCacheInvalidation } from '../useCacheInvalidation';

// ============================================================================
// TYPES
// ============================================================================

export interface SettingsActions {
  saveSettings: (settings: Settings) => Promise<void>;
}

interface UseSettingsActionsOptions {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  setSaving: (saving: boolean) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSettingsActions({
  onSuccess,
  onError,
  setSaving,
}: UseSettingsActionsOptions): SettingsActions {
  
  // ✅ FIX #2: Cache invalidation hook
  const { invalidateAll } = useCacheInvalidation();
  
  // ============================================================================
  // SAVE SETTINGS
  // ============================================================================
  
  const saveSettings = useCallback(
    async (settings: Settings) => {
      setSaving(true);
      try {
        const settingsService = getSettingsDataService();
        if (!settingsService) throw new Error('Settings service not available');
        
        // Save directly - service accepts Partial<SystemSettings> superset
        await settingsService.updateSettings(settings as any);
        
        // Invalidate all caches so components reflect fresh data
        await invalidateAll();
        
        onSuccess('Settings saved successfully!');
      } catch (error) {
        console.error('❌ Error saving settings to Firestore:', error);
        onError('Failed to save settings to Firestore.');
      } finally {
        setSaving(false);
      }
    },
    [setSaving, onSuccess, onError, invalidateAll]
  );
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    saveSettings,
  };
}