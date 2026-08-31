/**
 * useButtonKeyboardBinding Hook
 * ✅ APR 1, 2026: Connect buttons to keyboard shortcuts
 * 
 * Automatically triggers button clicks when their associated keyboard shortcuts are pressed
 * Makes all buttons in the app keyboard accessible
 * 
 * Usage:
 * - Add data-keyboard-shortcut attribute to buttons
 * - Call useButtonKeyboardBinding() to activate shortcuts globally
 * 
 * Example:
 * <button data-keyboard-shortcut="ctrl+s">Save</button>
 * <button data-keyboard-shortcut="shift+d">Delete</button>
 * <button data-keyboard-shortcut="Escape">Close</button>
 */

import { useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';


export interface ButtonKeyboardBinding {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description: string;
  disabled?: boolean;
}

interface UseButtonKeyboardBindingOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  ignoreFocusedInput?: boolean;
}

/**
 * Check if user is currently typing in an input field
 */
function isTypingInInput(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  const isEditable = activeElement.getAttribute('contenteditable') === 'true';
  
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    isEditable
  );
}

/**
 * Normalize key for cross-browser compatibility
 */
function normalizeKey(key: string): string {
  return key.toLowerCase();
}

/**
 * Parse keyboard shortcut string (e.g., "ctrl+shift+s" → { ctrlKey: true, shiftKey: true, key: 's' })
 */
export function parseKeyboardShortcut(shortcutStr: string): ButtonKeyboardBinding | null {
  try {
    const parts = shortcutStr.toLowerCase().split('+');
    const binding: ButtonKeyboardBinding = {
      key: '',
      description: '',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
    };

    for (const part of parts) {
      if (part === 'ctrl' || part === 'control') binding.ctrlKey = true;
      else if (part === 'alt') binding.altKey = true;
      else if (part === 'shift') binding.shiftKey = true;
      else if (part === 'meta' || part === 'cmd' || part === 'win') binding.metaKey = true;
      else binding.key = part;
    }

    if (!binding.key) return null;
    return binding;
  } catch (e) {
    logger.warn(`Failed to parse keyboard shortcut: ${shortcutStr}`, e);
    return null;
  }
}

/**
 * Check if modifier keys match
 */
function modifiersMatch(
  event: KeyboardEvent,
  binding: ButtonKeyboardBinding
): boolean {
  return (
    (binding.ctrlKey ?? false) === (event.ctrlKey || event.metaKey) &&
    (binding.altKey ?? false) === event.altKey &&
    (binding.shiftKey ?? false) === event.shiftKey &&
    (binding.metaKey ?? false) === event.metaKey
  );
}

/**
 * Global hook to bind all buttons with data-keyboard-shortcut to keyboard events
 */
export function useButtonKeyboardBinding({
  enabled = true,
  preventDefault = true,
  ignoreFocusedInput = false,
}: UseButtonKeyboardBindingOptions = {}) {
  const bindingsRef = useRef<Map<string, ButtonKeyboardBinding>>(new Map());

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if typing in input (unless ignoreFocusedInput is true)
      if (!ignoreFocusedInput && isTypingInInput()) return;

      const normalizedKey = normalizeKey(event.key);
      
      // Find buttons with matching shortcuts
      const buttons = document.querySelectorAll('[data-keyboard-shortcut]');
      
      buttons.forEach((button) => {
        const shortcutStr = button.getAttribute('data-keyboard-shortcut');
        if (!shortcutStr) return;

        // Parse or get cached binding
        let binding = bindingsRef.current.get(shortcutStr);
        if (!binding) {
          // ✅ PASS 6: parseKeyboardShortcut returns `... | null`; binding is
          // typed `... | undefined`. Normalize null → undefined.
          binding = parseKeyboardShortcut(shortcutStr) ?? undefined;
          if (binding) {
            bindingsRef.current.set(shortcutStr, binding);
          }
        }

        if (!binding) return;

        // Check if this binding matches the keyboard event
        if (
          normalizeKey(binding.key) === normalizedKey &&
          modifiersMatch(event, binding)
        ) {
          // Check if button is disabled
          if ((button as HTMLButtonElement).disabled) return;

          // Prevent default behavior if requested
          if (preventDefault) {
            event.preventDefault();
            event.stopPropagation();
          }

          // Trigger button click
          (button as HTMLButtonElement).click();
        }
      });
    },
    [enabled, preventDefault, ignoreFocusedInput]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

/**
 * Get all buttons with keyboard shortcuts
 * Useful for displaying keyboard hints in tooltips
 */
export function getAllButtonShortcuts(): Array<{
  element: HTMLButtonElement;
  shortcut: ButtonKeyboardBinding;
}> {
  const results: Array<{
    element: HTMLButtonElement;
    shortcut: ButtonKeyboardBinding;
  }> = [];

  const buttons = document.querySelectorAll('[data-keyboard-shortcut]');
  buttons.forEach((button) => {
    const shortcutStr = button.getAttribute('data-keyboard-shortcut');
    if (!shortcutStr) return;

    const binding = parseKeyboardShortcut(shortcutStr);
    if (binding) {
      results.push({
        element: button as HTMLButtonElement,
        shortcut: binding,
      });
    }
  });

  return results;
}

/**
 * Format button shortcut for display
 */
export function formatButtonShortcut(binding: ButtonKeyboardBinding): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts: string[] = [];

  if (binding.ctrlKey) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (binding.altKey) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (binding.shiftKey) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (binding.metaKey && !binding.ctrlKey) {
    parts.push(isMac ? '⌘' : 'Win');
  }

  // Format key name
  let keyName = binding.key.toUpperCase();
  if (keyName === ' ') keyName = 'Space';
  if (keyName === 'ARROWUP') keyName = '↑';
  if (keyName === 'ARROWDOWN') keyName = '↓';
  if (keyName === 'ARROWLEFT') keyName = '←';
  if (keyName === 'ARROWRIGHT') keyName = '→';
  if (keyName === 'ESCAPE') keyName = 'Esc';
  if (keyName === 'ENTER') keyName = '↵';

  parts.push(keyName);

  return parts.join(isMac ? '' : '+');
}
