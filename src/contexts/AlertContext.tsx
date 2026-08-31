import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { scrollLockManager } from '../utils/scrollLockManager';
import { AlertRenderer } from '../components/shared/AlertRenderer';
import { buildAlertButtons, buildConfirmationConfig } from '../services/alerts';

/**
 * ===================================================================
 * AlertContext - Global Alert & Confirmation Dialog System
 * ===================================================================
 * 
 * Provides centralized alert/confirmation dialogs with premium styling.
 * Matches the black & gold luxury aesthetic of modal components.
 * 
 * ✅ MAR 8, 2026: Phase 1 - UI rendering moved to AlertRenderer
 * ✅ MAR 10, 2026: Phase 2 - Business logic moved to alertConfigBuilder service
 * 
 * Responsibilities:
 * - Manage alert state (React state)
 * - Handle scroll locking
 * - Handle keyboard events (ESC to close)
 * - Provide alert/confirm hooks
 * 
 * Does NOT:
 * - Build button configurations (delegated to alertConfigBuilder)
 * - Render UI (delegated to AlertRenderer)
 * - Contain styling logic (delegated to AlertRenderer)
 * - Format messages (delegated to AlertRenderer)
 * 
 * Features:
 * - Success, error, warning, info, pending icons
 * - Customizable buttons with variants
 * - Auto-formatting of emails as clickable links
 * - Portal-based rendering (always visible)
 * - Smooth animations and transitions
 * - Support for multi-line messages
 * 
 * Usage:
 * ```tsx
 * const { showAlert, showConfirm } = useAlert();
 * 
 * // Simple alert
 * showAlert({
 *   title: 'Success!',
 *   message: 'Order created successfully',
 *   icon: 'success'
 * });
 * 
 * // Confirmation dialog
 * showConfirm(
 *   'Cancel Order',
 *   'Are you sure you want to cancel this order?',
 *   () => cancelOrder(),
 *   () => console.log('Cancelled')
 * );
 * ```
 * 
 * Version: 4.0.0 - Service-Oriented Architecture
 * ===================================================================
 */

// ============================================
// Types
// ============================================

export interface AlertButton {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface AlertConfig {
  title: string;
  message: string;
  icon?: 'success' | 'error' | 'warning' | 'info' | 'pending';
  buttons?: AlertButton[];
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

interface AlertContextType {
  showAlert: (config: AlertConfig) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => void;
  closeAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);
AlertContext.displayName = 'AlertContext';

// ============================================
// Provider
// ============================================

/**
 * AlertProvider - State Management for Alerts
 * 
 * Manages alert state and lifecycle.
 * UI rendering is handled by AlertRenderer component.
 */
export function AlertProvider({ children }: { children: ReactNode }): JSX.Element | null {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const unlockScrollRef = React.useRef<(() => void) | null>(null);

  // FIX T2R2-C6 (CRITICAL — performance): Was bare functions on every render.
  // Every consumer's useEffect([showAlert]) re-ran on every alert state change.
  // Wrapped in useCallback so identity is stable.
  const closeAlert = useCallback(() => {
    if (unlockScrollRef.current) {
      unlockScrollRef.current();
      unlockScrollRef.current = null;
    }
    setAlertConfig((prev) => {
      prev?.onClose?.();
      return null;
    });
  }, []);

  const showAlert = useCallback((config: AlertConfig) => {
    unlockScrollRef.current = scrollLockManager.lock('AlertContext');
    const builtConfig = buildAlertButtons(config, closeAlert);
    setAlertConfig(builtConfig);
  }, [closeAlert]);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => {
    unlockScrollRef.current = scrollLockManager.lock('AlertContext');
    const confirmConfig = buildConfirmationConfig(title, message, onConfirm, onCancel, closeAlert);
    setAlertConfig(confirmConfig);
  }, [closeAlert]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    if (!alertConfig) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only allow ESC to close if there are no buttons (simple alert)
        if (!alertConfig.buttons) {
          closeAlert();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [alertConfig, closeAlert]);

  // FIX T2R2-C6: Memoized context value — without this, every render of the
  // provider creates a new value object → every consumer re-renders even when
  // nothing changed.  Same fix template applied to ModalContext.
  const value = useMemo(
    () => ({ showAlert, showConfirm, closeAlert }),
    [showAlert, showConfirm, closeAlert]
  );

  return (
    <AlertContext.Provider value={value}>
      {children}
      <AlertRenderer config={alertConfig} onClose={closeAlert} />
    </AlertContext.Provider>
  );
}

AlertProvider.displayName = 'AlertProvider';

// ============================================
// Hook
// ============================================

/**
 * useAlert - Hook to access alert functions
 * 
 * Must be used within an AlertProvider.
 */
export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}