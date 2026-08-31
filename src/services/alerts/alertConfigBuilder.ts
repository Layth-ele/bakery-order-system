/**
 * ===================================================================
 * Alert Config Builder - Business Logic for Alert Configuration
 * ===================================================================
 * 
 * Extracted from AlertContext to separate concerns:
 * - Context manages state and React lifecycle
 * - Service handles configuration building and transformations
 * 
 * Created: March 10, 2026 (Contexts Refactoring)
 * 
 * Responsibilities:
 * - Build button configurations from alert configs
 * - Transform shorthand configs into full button arrays
 * - Provide default button configurations
 * - Generate confirmation dialog configs
 * 
 * Does NOT:
 * - Manage React state (delegated to AlertContext)
 * - Render UI (delegated to AlertRenderer)
 * - Handle scroll locking (delegated to scrollLockManager)
 * 
 * Version: 1.0.0
 * ===================================================================
 */

import type { AlertButton, AlertConfig } from '../../contexts/AlertContext';

// ============================================
// Types
// ============================================

/**
 * Result of building alert configuration
 */
export interface BuiltAlertConfig extends AlertConfig {
  buttons: AlertButton[];
}

// ============================================
// Button Builders
// ============================================

/**
 * Build button array from alert config
 * 
 * Handles shorthand notation (confirmText + onConfirm) and converts
 * it into a full button configuration array.
 * 
 * @param config - Original alert configuration
 * @param onClose - Function to call when closing alert
 * @returns Built configuration with button array
 */
export function buildAlertButtons(
  config: AlertConfig,
  onClose: () => void
): BuiltAlertConfig {
  // If buttons are already defined, use them as-is
  if (config.buttons) {
    return config as BuiltAlertConfig;
  }

  // If confirmText and onConfirm are provided, build buttons
  if (config.confirmText && config.onConfirm) {
    const buttons: AlertButton[] = [
      {
        label: config.confirmText,
        onClick: () => {
          config.onConfirm!();
          onClose();
        },
        variant: 'primary',
      }
    ];
    
    // Add cancel button if cancelText is provided
    if (config.cancelText) {
      buttons.push({
        label: config.cancelText,
        onClick: () => {
          if (config.onCancel) config.onCancel();
          onClose();
        },
        variant: 'secondary',
      });
    }
    
    return {
      ...config,
      buttons
    };
  }

  // No buttons - simple alert with no actions
  return {
    ...config,
    buttons: []
  };
}

/**
 * Build confirmation dialog configuration
 * 
 * Creates a standardized confirmation dialog with YES/CANCEL buttons
 * 
 * @param title - Dialog title
 * @param message - Dialog message
 * @param onConfirm - Function to call when confirmed
 * @param onCancel - Optional function to call when cancelled
 * @param onClose - Function to call when closing
 * @returns Built confirmation config
 */
export function buildConfirmationConfig(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel: (() => void) | undefined,
  onClose: () => void
): BuiltAlertConfig {
  return {
    title,
    message,
    icon: 'warning',
    buttons: [
      {
        label: 'YES, CONFIRM',
        onClick: () => {
          onConfirm();
          onClose();
        },
        variant: 'primary',
      },
      {
        label: 'CANCEL',
        onClick: () => {
          if (onCancel) onCancel();
          onClose();
        },
        variant: 'secondary',
      },
    ],
  };
}

/**
 * Build success alert configuration
 * 
 * Standard success alert with OK button
 * 
 * @param title - Alert title
 * @param message - Alert message
 * @param onClose - Function to call when closing
 * @returns Built success config
 */
export function buildSuccessAlert(
  title: string,
  message: string,
  onClose: () => void
): BuiltAlertConfig {
  return {
    title,
    message,
    icon: 'success',
    buttons: [
      {
        label: 'OK',
        onClick: onClose,
        variant: 'primary',
      }
    ],
  };
}

/**
 * Build error alert configuration
 * 
 * Standard error alert with OK button
 * 
 * @param title - Alert title
 * @param message - Alert message
 * @param onClose - Function to call when closing
 * @returns Built error config
 */
export function buildErrorAlert(
  title: string,
  message: string,
  onClose: () => void
): BuiltAlertConfig {
  return {
    title,
    message,
    icon: 'error',
    buttons: [
      {
        label: 'OK',
        onClick: onClose,
        variant: 'primary',
      }
    ],
  };
}

/**
 * Build warning alert configuration
 * 
 * Standard warning alert with OK button
 * 
 * @param title - Alert title
 * @param message - Alert message
 * @param onClose - Function to call when closing
 * @returns Built warning config
 */
export function buildWarningAlert(
  title: string,
  message: string,
  onClose: () => void
): BuiltAlertConfig {
  return {
    title,
    message,
    icon: 'warning',
    buttons: [
      {
        label: 'OK',
        onClick: onClose,
        variant: 'primary',
      }
    ],
  };
}

/**
 * Build info alert configuration
 * 
 * Standard info alert with OK button
 * 
 * @param title - Alert title
 * @param message - Alert message
 * @param onClose - Function to call when closing
 * @returns Built info config
 */
export function buildInfoAlert(
  title: string,
  message: string,
  onClose: () => void
): BuiltAlertConfig {
  return {
    title,
    message,
    icon: 'info',
    buttons: [
      {
        label: 'OK',
        onClick: onClose,
        variant: 'primary',
      }
    ],
  };
}

// ============================================
// Validation
// ============================================

/**
 * Validate alert configuration
 * 
 * Ensures required fields are present and valid
 * 
 * @param config - Alert configuration to validate
 * @returns True if valid, false otherwise
 */
export function validateAlertConfig(config: AlertConfig): boolean {
  if (!config.title || typeof config.title !== 'string') {
    console.error('❌ [Alert Service] Invalid alert config: missing or invalid title');
    return false;
  }

  if (!config.message || typeof config.message !== 'string') {
    console.error('❌ [Alert Service] Invalid alert config: missing or invalid message');
    return false;
  }

  return true;
}

// ============================================
// Helpers
// ============================================

/**
 * Check if alert config has actions
 * 
 * @param config - Alert configuration
 * @returns True if alert has buttons/actions
 */
export function hasAlertActions(config: AlertConfig): boolean {
  return !!(
    config.buttons?.length ||
    config.confirmText ||
    config.onConfirm
  );
}

/**
 * Get default button variant for alert type
 * 
 * @param icon - Alert icon type
 * @returns Default button variant
 */
export function getDefaultButtonVariant(
  icon?: AlertConfig['icon']
): AlertButton['variant'] {
  switch (icon) {
    case 'error':
    case 'warning':
      return 'danger';
    case 'success':
      return 'primary';
    default:
      return 'primary';
  }
}
