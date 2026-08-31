/**
 * useKeyboardShortcuts Hook
 * ✅ FEB 21, 2026: Keyboard shortcuts for power users
 * 
 * Provides keyboard shortcuts throughout the application for common actions
 * 
 * Features:
 * - Customizable shortcuts
 * - Prevents conflicts with browser shortcuts
 * - Disabled when typing in inputs/textareas
 * - Works across the entire app
 * - Accessible help modal (? key)
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
  category?: 'navigation' | 'actions' | 'modals' | 'filters' | 'general';
  disabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Check if user is currently typing in an input field
 * We don't want shortcuts to fire while typing
 */
function isTyping(): boolean {
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
 * Check if modifier keys match
 */
function modifiersMatch(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  return (
    (shortcut.ctrlKey ?? false) === event.ctrlKey &&
    (shortcut.altKey ?? false) === event.altKey &&
    (shortcut.shiftKey ?? false) === event.shiftKey &&
    (shortcut.metaKey ?? false) === event.metaKey
  );
}

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  preventDefault = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't fire shortcuts when disabled
      if (!enabled) return;

      // Don't fire shortcuts while typing
      if (isTyping()) return;

      // Find matching shortcut
      const normalizedKey = normalizeKey(event.key);
      const matchedShortcut = shortcuts.find(
        (shortcut) =>
          !shortcut.disabled &&
          normalizeKey(shortcut.key) === normalizedKey &&
          modifiersMatch(event, shortcut)
      );

      if (matchedShortcut) {
        if (preventDefault) {
          event.preventDefault();
          event.stopPropagation();
        }
        matchedShortcut.action();
      }
    },
    [shortcuts, enabled, preventDefault]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

/**
 * Format shortcut for display
 * Example: Ctrl+Shift+N → ⌃⇧N (Mac) or Ctrl+Shift+N (Windows)
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts: string[] = [];

  if (shortcut.ctrlKey) {
    parts.push(isMac ? '⌃' : 'Ctrl');
  }
  if (shortcut.altKey) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (shortcut.shiftKey) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.metaKey) {
    parts.push(isMac ? '⌘' : 'Win');
  }

  // Format key name
  let keyName = shortcut.key.toUpperCase();
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

/**
 * Group shortcuts by category
 */
export function groupShortcutsByCategory(
  shortcuts: KeyboardShortcut[]
): Record<string, KeyboardShortcut[]> {
  const grouped: Record<string, KeyboardShortcut[]> = {
    general: [],
    navigation: [],
    actions: [],
    modals: [],
    filters: [],
  };

  shortcuts.forEach((shortcut) => {
    const category = shortcut.category || 'general';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(shortcut);
  });

  return grouped;
}
