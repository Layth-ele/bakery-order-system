/**
 * KEYBOARD SHORTCUTS IMPLEMENTATION GUIDE
 * ✅ APR 1, 2026: Global button keyboard binding system
 * 
 * This guide explains how to add keyboard shortcuts to buttons in the app.
 * 
 * ==============================================================================
 * SYSTEM OVERVIEW
 * ==============================================================================
 * 
 * The app now has a global keyboard binding system that:
 * 1. Automatically triggers button clicks when keyboard shortcuts are pressed
 * 2. Shows keyboard hints in button tooltips on hover
 * 3. Prevents shortcuts from firing while typing in input fields
 * 4. Supports all modifier keys (Ctrl, Alt, Shift, Meta/Cmd)
 * 5. Is keyboard accessible and follows accessibility best practices
 * 
 * ==============================================================================
 * HOW TO ADD KEYBOARD SHORTCUTS TO BUTTONS
 * ==============================================================================
 * 
 * Step 1: Add data-keyboard-shortcut attribute to your button
 * 
 *   Basic shortcuts:
 *   <button data-keyboard-shortcut="s">Save</button>
 *   <button data-keyboard-shortcut="d">Delete</button>
 *   <button data-keyboard-shortcut="Escape">Close</button>
 * 
 *   With modifiers:
 *   <button data-keyboard-shortcut="ctrl+s">Save</button>
 *   <button data-keyboard-shortcut="shift+d">Delete All</button>
 *   <button data-keyboard-shortcut="alt+n">New</button>
 *   <button data-keyboard-shortcut="ctrl+shift+x">Advanced Action</button>
 * 
 * Step 2: That's it! The system will automatically:
 *   - Trigger the button click when the shortcut is pressed
 *   - Show the shortcut in the button's tooltip on hover
 *   - Prevent shortcuts from firing while typing in inputs
 *   - Disable shortcuts for disabled buttons
 * 
 * ==============================================================================
 * SHORTCUT FORMAT
 * ==============================================================================
 * 
 * Format: [modifiers]+key
 * 
 * Modifiers (optional, case-insensitive):
 *   - ctrl, control → Ctrl key (Cmd on Mac)
 *   - alt → Alt key (Option on Mac)
 *   - shift → Shift key
 *   - meta, cmd, win → Meta/Command key
 * 
 * Examples:
 *   "s"              → Just 's' key
 *   "ctrl+s"         → Ctrl + s
 *   "shift+d"        → Shift + d
 *   "ctrl+shift+n"   → Ctrl + Shift + n
 *   "alt+c"          → Alt + c
 *   "Escape"         → Escape key
 *   "Enter"          → Enter key
 *   "ArrowUp"        → Arrow up key
 * 
 * ==============================================================================
 * EXAMPLES: HOW TO ADD SHORTCUTS TO COMMON BUTTONS
 * ==============================================================================
 * 
 * Save Button:
 * <button 
 *   data-keyboard-shortcut="ctrl+s"
 *   onClick={handleSave}
 *   className="px-4 py-2 bg-blue-500 text-white rounded"
 * >
 *   Save
 * </button>
 * // Users can press Ctrl+S (or Cmd+S on Mac) to save
 * // Tooltip will show: "Save (Ctrl+S)"
 * 
 * Delete Button:
 * <button 
 *   data-keyboard-shortcut="shift+d"
 *   onClick={handleDelete}
 *   className="px-4 py-2 bg-red-500 text-white rounded"
 * >
 *   Delete
 * </button>
 * // Users can press Shift+D to delete
 * // Tooltip will show: "Delete (Shift+D)"
 * 
 * Close/Cancel Button:
 * <button 
 *   data-keyboard-shortcut="Escape"
 *   onClick={handleClose}
 *   className="px-4 py-2 bg-gray-500 text-white rounded"
 * >
 *   Close
 * </button>
 * // Users can press Escape to close
 * // Tooltip will show: "Close (Esc)"
 * 
 * ==============================================================================
 * BEST PRACTICES
 * ==============================================================================
 * 
 * 1. USE CONSISTENT SHORTCUTS ACROSS THE APP
 *    - Save: Ctrl+S (standard)
 *    - Delete: Shift+D or Delete key
 *    - Close/Escape: Escape key
 *    - New: Ctrl+N (standard)
 *    - Copy: Ctrl+C (standard)
 *    - Paste: Ctrl+V (standard)
 *    - Undo: Ctrl+Z (standard)
 *    - Redo: Ctrl+Y or Ctrl+Shift+Z (standard)
 * 
 * 2. AVOID CONFLICTS WITH BROWSER SHORTCUTS
 *    - Avoid: Ctrl+T (New Tab), Ctrl+W (Close Tab), Ctrl+L (Address Bar)
 *    - Avoid: Ctrl+Q (Quit), Ctrl+P (Print)
 *    - These won't work reliably across browsers
 * 
 * 3. DOCUMENT YOUR SHORTCUTS
 *    - Add title attributes to buttons
 *    - Add shortcuts to your keyboard shortcuts modal
 *    - List shortcuts in help documentation
 * 
 * 4. MAKE SHORTCUTS DISCOVERABLE
 *    - Show shortcuts in tooltips (automatic)
 *    - List in keyboard shortcuts help modal (? key)
 *    - Show hints in status bars or sidebars
 * 
 * 5. TEST ON DIFFERENT PLATFORMS
 *    - Windows/Linux: Ctrl key
 *    - Mac: Cmd key (automatically mapped)
 *    - Test that shortcuts don't interfere with OS shortcuts
 * 
 * 6. HANDLE EDGE CASES
 *    - Disabled buttons: Shortcuts automatically skip disabled buttons
 *    - Input fields: Shortcuts automatically skip when typing
 *    - Modals: Shortcuts work in modals too
 * 
 * ==============================================================================
 * HOW THE SYSTEM WORKS (TECHNICAL DETAILS)
 * ==============================================================================
 * 
 * Components:
 * - useButtonKeyboardBinding hook: Global keyboard event listener
 * - KeyboardHintTooltip component: Auto-updates button tooltips
 * - App.tsx: Initializes the global keyboard binding
 * - RootLayout.tsx: Renders KeyboardHintTooltip
 * 
 * Flow:
 * 1. User presses a key combination
 * 2. useButtonKeyboardBinding.handleKeyDown fires
 * 3. System checks if user is typing in an input (skip if true)
 * 4. System finds all buttons with data-keyboard-shortcut
 * 5. System compares key + modifiers to find matching button
 * 6. System checks if button is disabled (skip if disabled)
 * 7. System triggers button.click()
 * 
 * Tooltip Management:
 * 1. KeyboardHintTooltip watches for buttons with data-keyboard-shortcut
 * 2. It parses the shortcut string (e.g., "ctrl+s")
 * 3. It formats it for display (e.g., "Ctrl+S" or "⌘S" on Mac)
 * 4. It updates the button's title attribute with the hint
 * 
 * ==============================================================================
 * API REFERENCE
 * ==============================================================================
 * 
 * useButtonKeyboardBinding(options?)
 *   Hook to activate global button keyboard binding
 *   
 *   Options:
 *   - enabled: boolean (default: true) - Enable/disable shortcuts
 *   - preventDefault: boolean (default: true) - Prevent default behavior
 *   - ignoreFocusedInput: boolean (default: false) - Ignore input focus check
 *   
 *   Usage:
 *   useButtonKeyboardBinding({
 *     enabled: true,
 *     preventDefault: true,
 *     ignoreFocusedInput: false,
 *   });
 * 
 * parseKeyboardShortcut(shortcutStr: string)
 *   Parse a shortcut string into a binding object
 *   
 *   Input: "ctrl+shift+s"
 *   Output: { 
 *     key: 's', 
 *     ctrlKey: true, 
 *     shiftKey: true, 
 *     altKey: false, 
 *     metaKey: false 
 *   }
 * 
 * formatButtonShortcut(binding: ButtonKeyboardBinding)
 *   Format a binding object for display
 *   
 *   Input: { key: 's', ctrlKey: true, ... }
 *   Output: "Ctrl+S" (Windows) or "⌘S" (Mac)
 * 
 * ==============================================================================
 * TESTING YOUR SHORTCUTS
 * ==============================================================================
 * 
 * Manual Testing:
 * 1. Open the app
 * 2. Hover over a button with a shortcut to see the tooltip
 * 3. Press the keyboard shortcut
 * 4. Verify that the button action triggers
 * 5. Try typing in an input field - shortcuts should NOT trigger
 * 6. Disable a button - shortcut should NOT trigger
 * 
 * Browser Console Testing:
 *   // Get all buttons with shortcuts
 *   document.querySelectorAll('[data-keyboard-shortcut]')
 *   
 *   // Simulate a key press
 *   const event = new KeyboardEvent('keydown', {
 *     key: 's',
 *     ctrlKey: true
 *   });
 *   window.dispatchEvent(event);
 * 
 * ==============================================================================
 * TROUBLESHOOTING
 * ==============================================================================
 * 
 * Shortcut not working:
 * - Check that data-keyboard-shortcut attribute is set correctly
 * - Check that button is not disabled
 * - Check that you're not typing in an input field
 * - Check browser console for errors
 * - Try pressing the shortcut from non-focused element
 * 
 * Tooltip not showing:
 * - Check that button has a title attribute or text content
 * - Check browser console for errors
 * - Verify KeyboardHintTooltip is in the DOM
 * 
 * Shortcut conflicting with browser:
 * - Use different key combination
 * - Check browser shortcuts documentation
 * - Test in incognito mode to avoid extensions
 * 
 * ==============================================================================
 * FUTURE ENHANCEMENTS
 * ==============================================================================
 * 
 * Potential improvements:
 * - Customizable shortcuts per user
 * - Shortcut conflict detection and warnings
 * - Shortcut recording UI (record your own shortcuts)
 * - Shortcut profiles (different sets for different contexts)
 * - Shortcut analytics (track which shortcuts are used most)
 * - Shortcut chaining (multi-step shortcuts like Vim)
 * - Context-aware shortcuts (different shortcuts in different views)
 * - Accessibility improvements (screen reader support)
 * 
 * ==============================================================================
 */

export const KEYBOARD_SHORTCUTS_GUIDE = 'See above for complete guide';
