/**
 * KeyboardHintTooltip Component
 * ✅ APR 1, 2026: Display keyboard shortcuts in button tooltips
 * 
 * Automatically shows keyboard shortcut hints on buttons with data-keyboard-shortcut attribute
 * Enhances UX by teaching users about available shortcuts
 * 
 * Usage:
 * <button data-keyboard-shortcut="ctrl+s">Save</button>
 * // Tooltip will show: "Save (Ctrl+S)" on hover
 */

import { useEffect, useState } from 'react';
import { formatButtonShortcut, parseKeyboardShortcut } from '../../hooks/useButtonKeyboardBinding';

export function KeyboardHintTooltip(): null {
  const [tooltips, setTooltips] = useState<Map<HTMLElement, string>>(new Map());

  useEffect(() => {
    const updateTooltips = () => {
      const newTooltips = new Map<HTMLElement, string>();
      const buttons = document.querySelectorAll('[data-keyboard-shortcut]');

      buttons.forEach((button) => {
        const shortcutStr = button.getAttribute('data-keyboard-shortcut');
        if (!shortcutStr) return;

        const binding = parseKeyboardShortcut(shortcutStr);
        if (!binding) return;

        const shortcutDisplay = formatButtonShortcut(binding);
        const originalTitle = button.getAttribute('data-original-title') || 
                             button.getAttribute('title') || 
                             button.textContent?.trim() || 
                             'Action';

        newTooltips.set(button as HTMLElement, `${originalTitle} (${shortcutDisplay})`);

        // Store original title and set new one with shortcut
        if (!button.hasAttribute('data-original-title')) {
          button.setAttribute('data-original-title', originalTitle);
        }
        button.setAttribute('title', newTooltips.get(button as HTMLElement)!);
      });

      setTooltips(newTooltips);
    };

    // Initial update
    updateTooltips();

    // Watch for DOM changes
    const observer = new MutationObserver(updateTooltips);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-keyboard-shortcut'],
    });

    return () => observer.disconnect();
  }, []);

  // This component only manages side effects, doesn't render anything
  return null;
}
