# 🎹 Global Button Keyboard Binding System

**✅ APR 1, 2026: Complete Keyboard Accessibility for All Buttons**

---

## 📋 Overview

The app now has a **global keyboard binding system** that allows any button in the application to respond to keyboard shortcuts. This makes the app much more accessible and efficient for power users.

### Key Features:
- ⌨️ **Zero-configuration** - Just add `data-keyboard-shortcut` attribute to buttons
- 🎯 **Smart shortcuts** - Automatically skips input fields and disabled buttons  
- 💡 **Auto-tooltips** - Shows keyboard hints on button hover
- 🖥️ **Cross-platform** - Works seamlessly on Windows, Mac, and Linux
- ♿ **Accessible** - Follows accessibility best practices

---

## 🚀 Quick Start

### Add a keyboard shortcut to any button:

```tsx
<button data-keyboard-shortcut="ctrl+s" onClick={handleSave}>
  Save
</button>
```

That's it! Users can now press **Ctrl+S** (or **Cmd+S** on Mac) to trigger the button action. The tooltip will automatically show `"Save (Ctrl+S)"` on hover.

---

## 📝 Shortcut Format

### Basic Format:
```
[modifiers]+key
```

### Modifiers (case-insensitive):
| Modifier | Windows/Linux | Mac |
|----------|---------------|-----|
| `ctrl` | Ctrl | Cmd ⌘ |
| `alt` | Alt | Option ⌥ |
| `shift` | Shift | Shift ⇧ |
| `meta` | Win | Cmd ⌘ |

### Examples:
```
"s"              → Just 's' key
"ctrl+s"         → Ctrl + s
"shift+d"        → Shift + d
"ctrl+shift+n"   → Ctrl + Shift + n
"alt+c"          → Alt + c
"Escape"         → Escape key
"Enter"          → Enter key
"ArrowUp"        → Arrow up key
```

---

## 💡 Real-World Examples

### Save Button
```tsx
<button 
  data-keyboard-shortcut="ctrl+s"
  onClick={handleSave}
  className="px-4 py-2 bg-blue-500 text-white rounded"
>
  Save
</button>
```
**Keyboard Shortcut:** Ctrl+S (Cmd+S on Mac)  
**Tooltip shows:** "Save (Ctrl+S)" or "Save (⌘S)" on Mac

### Delete Button
```tsx
<button 
  data-keyboard-shortcut="shift+d"
  onClick={handleDelete}
  className="px-4 py-2 bg-red-500 text-white rounded"
>
  Delete
</button>
```
**Keyboard Shortcut:** Shift+D  
**Tooltip shows:** "Delete (Shift+D)" or "Delete (⇧D)" on Mac

### Close/Cancel Modal
```tsx
<button 
  data-keyboard-shortcut="Escape"
  onClick={handleClose}
  className="px-4 py-2 bg-gray-500 text-white rounded"
>
  Close
</button>
```
**Keyboard Shortcut:** Escape  
**Tooltip shows:** "Close (Esc)"

### Create New Item
```tsx
<button 
  data-keyboard-shortcut="ctrl+n"
  onClick={handleNew}
  className="px-4 py-2 bg-green-500 text-white rounded"
>
  New Order
</button>
```
**Keyboard Shortcut:** Ctrl+N (Cmd+N on Mac)  
**Tooltip shows:** "New Order (Ctrl+N)" or "New Order (⌘N)" on Mac

---

## 🎯 Best Practices

### Standard Shortcuts (Use These!)
```
Save       → Ctrl+S / Cmd+S
New        → Ctrl+N / Cmd+N
Copy       → Ctrl+C / Cmd+C
Paste      → Ctrl+V / Cmd+V
Undo       → Ctrl+Z / Cmd+Z
Redo       → Ctrl+Y / Cmd+Y (or Ctrl+Shift+Z)
Delete     → Shift+D (or Delete key)
Close      → Escape
Find/Search → Ctrl+F / Cmd+F
Help       → ? key or F1
```

### Browser Conflicts to Avoid
❌ Don't use these (they conflict with browser shortcuts):
- `Ctrl+T` (New Tab)
- `Ctrl+W` (Close Tab)
- `Ctrl+L` (Address Bar)
- `Ctrl+Q` (Quit)
- `Ctrl+P` (Print)

### Naming Conventions
- Use **consistent shortcuts** across the app
- Use **modifier keys** for less common actions (Ctrl+Shift+X)
- Use **single keys** for very common actions (? for help)
- **Document** all shortcuts in the help modal

### Accessibility Tips
- Always provide a mouse alternative (don't ONLY use shortcuts)
- Show shortcuts in tooltips (automatic ✅)
- List shortcuts in keyboard help modal (? key)
- Test on keyboard-only navigation
- Ensure disabled buttons skip their shortcuts

---

## 🔧 How It Works (Technical Details)

### Components
1. **`useButtonKeyboardBinding` hook** - Global keyboard event listener
2. **`KeyboardHintTooltip` component** - Auto-updates button tooltips
3. **`App.tsx`** - Initializes the global keyboard binding
4. **`RootLayout.tsx`** - Renders KeyboardHintTooltip

### Flow
```
User presses key
    ↓
useButtonKeyboardBinding.handleKeyDown fires
    ↓
Check if typing in input? (skip if true)
    ↓
Find all buttons with data-keyboard-shortcut
    ↓
Compare key + modifiers
    ↓
Check if button is disabled (skip if disabled)
    ↓
Trigger button.click()
```

### Tooltip Update
```
Button added to page
    ↓
KeyboardHintTooltip detects it
    ↓
Parses data-keyboard-shortcut attribute
    ↓
Formats shortcut for display (Ctrl+S or ⌘S)
    ↓
Updates button title with hint
    ↓
User sees tooltip on hover ✅
```

---

## 📚 API Reference

### `useButtonKeyboardBinding(options?)`

Activates global button keyboard binding.

```tsx
import { useButtonKeyboardBinding } from '@/hooks/useButtonKeyboardBinding';

// In your component
useButtonKeyboardBinding({
  enabled: true,              // Enable/disable shortcuts (default: true)
  preventDefault: true,        // Prevent default browser behavior (default: true)
  ignoreFocusedInput: false,  // Ignore input focus check (default: false)
});
```

**Note:** This is already called in `App.tsx` globally, so you don't need to call it in individual components.

### `parseKeyboardShortcut(shortcutStr: string)`

Parses a shortcut string into a binding object.

```tsx
import { parseKeyboardShortcut } from '@/hooks/useButtonKeyboardBinding';

const binding = parseKeyboardShortcut('ctrl+shift+s');
// Returns: {
//   key: 's',
//   ctrlKey: true,
//   shiftKey: true,
//   altKey: false,
//   metaKey: false,
//   description: ''
// }
```

### `formatButtonShortcut(binding: ButtonKeyboardBinding)`

Formats a binding object for display.

```tsx
import { formatButtonShortcut } from '@/hooks/useButtonKeyboardBinding';

const display = formatButtonShortcut({
  key: 's',
  ctrlKey: true,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  description: 'Save'
});
// Windows/Linux: "Ctrl+S"
// Mac: "⌘S"
```

---

## ✅ Testing Your Shortcuts

### Manual Testing
1. Open the app
2. Hover over a button with a keyboard shortcut
3. See the tooltip showing the shortcut hint
4. Press the keyboard shortcut
5. Verify the button action triggers
6. Try typing in an input field - shortcuts should NOT trigger
7. Disable a button - shortcut should NOT trigger

### Browser Console Testing
```javascript
// Get all buttons with shortcuts
document.querySelectorAll('[data-keyboard-shortcut]')

// Simulate a key press (Ctrl+S)
const event = new KeyboardEvent('keydown', {
  key: 's',
  ctrlKey: true,
  bubbles: true
});
window.dispatchEvent(event);
```

---

## 🐛 Troubleshooting

### Shortcut not working?
- ✓ Check that `data-keyboard-shortcut` attribute is set correctly
- ✓ Check that button is not disabled
- ✓ Check that you're not typing in an input field
- ✓ Check browser console for errors
- ✓ Try pressing the shortcut from non-focused element

### Tooltip not showing?
- ✓ Check that button has text content or title attribute
- ✓ Check browser console for errors  
- ✓ Verify `KeyboardHintTooltip` is in the DOM
- ✓ Try hovering on the button after it loads

### Shortcut conflicting with browser?
- ✓ Use a different key combination
- ✓ Check browser shortcuts documentation
- ✓ Test in incognito mode to avoid extensions

---

## 📋 Usage Checklist

When adding a keyboard shortcut to a button:

- [ ] Choose a meaningful, standard shortcut (or follow app conventions)
- [ ] Avoid browser conflicts (Ctrl+T, Ctrl+W, Ctrl+L, Ctrl+Q, Ctrl+P)
- [ ] Add `data-keyboard-shortcut` attribute to button
- [ ] Test that it works on keyboard press
- [ ] Test that it skips when typing in inputs
- [ ] Test that disabled buttons don't trigger
- [ ] Hover over button to verify tooltip shows
- [ ] Document shortcut if it's important
- [ ] Add to help modal if it's a common action

---

## 🎓 Implementation Examples

### Admin Actions Modal
```tsx
<div className="flex gap-2">
  <button 
    data-keyboard-shortcut="Escape"
    onClick={onClose}
    className="px-4 py-2 bg-gray-300 rounded"
  >
    Cancel
  </button>
  <button 
    data-keyboard-shortcut="Enter"
    onClick={onConfirm}
    className="px-4 py-2 bg-blue-500 text-white rounded"
  >
    Confirm
  </button>
</div>
```

### Order Form
```tsx
<form>
  <input type="text" placeholder="Order details" />
  <button 
    data-keyboard-shortcut="ctrl+s"
    type="submit"
    className="px-4 py-2 bg-green-500 text-white rounded"
  >
    Create Order
  </button>
</form>
```

### Navigation Bar
```tsx
<nav className="flex gap-4">
  <button 
    data-keyboard-shortcut="p"
    onClick={() => goTo('pending')}
    className="nav-button"
  >
    Pending Orders
  </button>
  <button 
    data-keyboard-shortcut="a"
    onClick={() => goTo('approved')}
    className="nav-button"
  >
    Approved Orders
  </button>
  <button 
    data-keyboard-shortcut="c"
    onClick={() => goTo('completed')}
    className="nav-button"
  >
    Completed Orders
  </button>
</nav>
```

---

## 🚀 Future Enhancements

Potential improvements:
- 🎮 Customizable shortcuts per user
- ⚠️ Shortcut conflict detection
- 🎙️ Shortcut recording UI
- 🎨 Shortcut profiles for different contexts
- 📊 Shortcut usage analytics
- ⛓️ Shortcut chaining (multi-step shortcuts)
- 🎯 Context-aware shortcuts
- ♿ Enhanced screen reader support

---

## 📞 Support

For questions or issues:
1. Check this guide
2. Review the [KEYBOARD_SHORTCUTS_GUIDE.ts](./src/docs/KEYBOARD_SHORTCUTS_GUIDE.ts) file
3. Look at existing button implementations
4. Check browser console for errors
5. Test in different browsers

---

**✅ Keyboard shortcuts are now active app-wide!**

Press `?` at any time to see all available keyboard shortcuts in the help modal.
