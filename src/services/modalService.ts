/**
 * ===================================================================
 * Modal Service - Business Logic for Modal Management
 * ===================================================================
 * 
 * Extracted from ModalContext to separate concerns:
 * - Context manages state and React lifecycle
 * - Service handles business rules and orchestration
 * 
 * Created: March 8, 2026 (Phase 1 of Contexts Refactoring)
 * Updated: March 8, 2026 (Phase 4 - Already using debug utility ✅)
 * 
 * Responsibilities:
 * - Modal opening validation
 * - Stack limit enforcement
 * - Duplicate modal prevention
 * - Auto-close rules for related modals
 * - Modal stack formatting for logging
 * 
 * Does NOT:
 * - Manage React state (delegated to ModalContext)
 * - Render UI (delegated to ModalRoot)
 * - Track analytics (delegated to modalRegistry)
 * 
 * Version: 1.0.0
 * ===================================================================
 */

import type { ModalType } from '../types/modals';
import type { ModalSize, OverlayBlur } from '../ui/modals/BaseModal';
import { debug } from '../utils/debug';

// ============================================
// Types
// ============================================

export interface ModalStackEntry<T extends ModalType = ModalType> {
  type: T;
  props: Record<string, unknown>;
  size: ModalSize;
  overlayBlur: OverlayBlur | undefined;
  id: string;
  openedAt: number;
  onAfterClose?: () => void;
}

export interface CanOpenModalResult {
  canOpen: boolean;
  reason?: string;
  shouldAutoClose: boolean;
  modalsToClose: string[];
}

// ============================================
// Configuration
// ============================================

/**
 * Maximum number of modals that can be open at once
 * Prevents modal overload and maintains good UX
 */
const MAX_MODAL_STACK_SIZE = 3;

/**
 * Modal stacking limit strategy
 * - 'prevent': Don't open new modal when limit reached (show warning)
 * - 'close-oldest': Automatically close oldest modal when limit reached
 * - 'close-all-and-open': Close all modals and open the new one
 */
type StackLimitStrategy = 'prevent' | 'close-oldest' | 'close-all-and-open';

const STACK_LIMIT_STRATEGY: StackLimitStrategy = 'prevent';

/**
 * Auto-close rules: When opening a modal, which other modals should auto-close?
 * 
 * Example: Opening ADMIN_PASSWORD should close NOTIFICATIONS to prevent stack overflow
 */
const AUTO_CLOSE_RULES: Record<string, ModalType[]> = {
  ADMIN_PASSWORD: ['NOTIFICATIONS', 'ADMIN_NOTIFICATIONS'],
  ADMIN_PASSWORD_CONFIRM: ['NOTIFICATIONS', 'ADMIN_NOTIFICATIONS'],
  AUTH_GUARD: ['NOTIFICATIONS', 'ADMIN_NOTIFICATIONS'],
};

// ============================================
// Core Functions
// ============================================

/**
 * Determine if a modal can be opened
 * 
 * Checks:
 * 1. Duplicate detection (same modal already in stack)
 * 2. Stack limit enforcement (max 3 modals)
 * 3. Auto-close rules (related modals that should close)
 * 
 * @param type - The modal type to open
 * @param currentStack - Current modal stack
 * @param options - Opening options (replaceTop, etc.)
 * @returns Result with canOpen flag and modals to close
 */
export function canOpenModal(
  type: ModalType,
  currentStack: ModalStackEntry[],
  options?: { replaceTop?: boolean }
): CanOpenModalResult {
  // ============================================
  // 1. Check for Duplicates
  // ============================================
  const isDuplicate = currentStack.some(m => m.type === type);
  
  if (isDuplicate && !options?.replaceTop) {
 // Changed from warning to log
    // This is NORMAL behavior (users might double-click), not an error
    debug.log(
      `ℹ️ [Modal Duplicate Prevention] Modal ${type} is already open - ignoring duplicate request`,
      {
        requestedModal: type,
        currentStack: currentStack.map(m => m.type),
      }
    );
    
    return {
      canOpen: false,
      reason: `Modal ${type} is already open`,
      shouldAutoClose: false,
      modalsToClose: [],
    };
  }

  // ============================================
  // 2. Check Stack Limit
  // ============================================
  const willExceedLimit = !options?.replaceTop && currentStack.length >= MAX_MODAL_STACK_SIZE;
  
  if (willExceedLimit) {
    debug.warn(
      `⚠️ [Modal Stack Limit] Cannot open ${type}. Stack size: ${currentStack.length}/${MAX_MODAL_STACK_SIZE}`,
      {
        requestedModal: type,
        currentStack: currentStack.map(m => m.type),
        strategy: STACK_LIMIT_STRATEGY,
      }
    );

    // Handle based on strategy
    if (STACK_LIMIT_STRATEGY === 'prevent') {
      return {
        canOpen: false,
        reason: `Stack limit reached (${MAX_MODAL_STACK_SIZE} modals)`,
        shouldAutoClose: false,
        modalsToClose: [],
      };
    } else if (STACK_LIMIT_STRATEGY === 'close-oldest') {
      // Will auto-close oldest modal
      const oldest = currentStack[0];
      return {
        canOpen: true,
        shouldAutoClose: true,
        modalsToClose: oldest ? [oldest.id] : [],
      };
    } else if (STACK_LIMIT_STRATEGY === 'close-all-and-open') {
      // Will close all modals
      return {
        canOpen: true,
        shouldAutoClose: true,
        modalsToClose: currentStack.map(m => m.id),
      };
    }
  }

  // ============================================
  // 3. Check Auto-Close Rules
  // ============================================
  const modalsToClose = getModalsToAutoClose(type, currentStack);
  
  if (modalsToClose.length > 0) {
    debug.log(
      `🔄 [Modal Auto-Close] Closing ${modalsToClose.length} modal(s) before opening ${type}`,
      {
        closingModals: modalsToClose,
        openingModal: type,
      }
    );
  }

  return {
    canOpen: true,
    shouldAutoClose: modalsToClose.length > 0,
    modalsToClose,
  };
}

/**
 * Get list of modal IDs that should auto-close when opening a new modal
 * 
 * Uses AUTO_CLOSE_RULES configuration
 * 
 * @param type - The modal type being opened
 * @param currentStack - Current modal stack
 * @returns Array of modal IDs to close
 */
function getModalsToAutoClose(
  type: ModalType,
  currentStack: ModalStackEntry[]
): string[] {
  const rulesToClose = AUTO_CLOSE_RULES[type] || [];
  
  return currentStack
    .filter(m => rulesToClose.includes(m.type))
    .map(m => m.id);
}

/**
 * Format modal stack for logging
 * 
 * Converts stack to readable format: "MODAL_A → MODAL_B → MODAL_C"
 * 
 * @param stack - Modal stack to format
 * @returns Formatted string representation
 */
export function formatModalStack(stack: ModalStackEntry[]): string {
  if (stack.length === 0) return '(empty)';
  return stack.map(m => m.type).join(' → ');
}

/**
 * Get stack limit alert message
 * 
 * User-friendly message when stack limit is reached
 * 
 * @param currentStack - Current modal stack
 * @returns Alert message string
 */
export function getStackLimitAlertMessage(currentStack: ModalStackEntry[]): string {
  const modalNames = currentStack
    .map(m => m.type.replace(/_/g, ' '))
    .join(', ');
    
  return (
    `Too many dialogs are open!\n\n` +
    `Please close some existing dialogs before opening a new one.\n\n` +
    `Currently open: ${modalNames}`
  );
}

/**
 * Log modal opened event
 * 
 * Centralized debug logging for modal opens
 * 
 * @param type - Modal type that was opened
 * @param modalId - Unique ID of the modal
 * @param newStack - New modal stack after opening
 */
export function logModalOpened(
  type: ModalType,
  modalId: string,
  newStack: ModalStackEntry[]
): void {
  debug.log(`✅ [Modal Service] Modal opened: ${type}`, {
    modalId,
    stackSize: newStack.length,
    stack: formatModalStack(newStack),
  });
}

/**
 * Log modal closed event
 * 
 * Centralized debug logging for modal closes
 * 
 * @param type - Modal type that was closed
 * @param remainingStack - Remaining modal stack after closing
 */
export function logModalClosed(
  type: ModalType,
  remainingStack: ModalStackEntry[]
): void {
  debug.log(`🔽 [Modal Service] Modal closed: ${type}`, {
    stackSize: remainingStack.length,
    stack: formatModalStack(remainingStack),
  });
}

/**
 * Validate modal props (basic validation)
 * 
 * Ensures required props are provided
 * 
 * @param type - Modal type
 * @param props - Modal props to validate
 * @returns True if valid, false otherwise
 */
export function validateModalProps(
  type: ModalType,
  props: Record<string, unknown>
): boolean {
  // Add specific validation rules here if needed
  // For now, just ensure props is an object
  if (!props || typeof props !== 'object') {
    debug.error(`❌ [Modal Service] Invalid props for ${type}:`, props);
    return false;
  }
  
  return true;
}

/**
 * Generate unique modal ID
 *
 * Creates a random ID for tracking modal instances
 *
 * NOTE on Math.random use (T2R4-H3 audit): This intentionally uses
 * Math.random rather than crypto.getRandomValues. Modal IDs are:
 *   - UI-only (used as React keys + Map lookup keys for stacked modals)
 *   - Transient (lifetime is the modal stack frame)
 *   - Never persisted, never used in financial records
 *   - Not security-sensitive — collision causes a UI key warning at
 *     worst, not a security or data-integrity issue
 * crypto.getRandomValues() is overkill here. Documented so future audits
 * don't re-flag this as a bug.
 *
 * @returns Unique modal ID string
 */
export function generateModalId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// ============================================
// Configuration Getters
// ============================================

/**
 * Get maximum stack size
 */
export function getMaxStackSize(): number {
  return MAX_MODAL_STACK_SIZE;
}

/**
 * Get current stack limit strategy
 */
export function getStackLimitStrategy(): StackLimitStrategy {
  return STACK_LIMIT_STRATEGY;
}

/**
 * Get auto-close rules
 */
export function getAutoCloseRules(): Record<string, ModalType[]> {
  return AUTO_CLOSE_RULES;
}