# 🎹 Keyboard Shortcuts - Quick Reference Card

## Add Keyboard Shortcuts in 3 Steps

### Step 1: Add attribute to button
```tsx
<button data-keyboard-shortcut="ctrl+s">
  Save
</button>
```

### Step 2: Click button or press shortcut
Done! ✅

### Step 3: Hover to see the keyboard hint
Tooltip shows: "Save (Ctrl+S)" or "Save (⌘S)" on Mac

---

## 📝 Shortcut Format

```
data-keyboard-shortcut="[modifiers]+key"
```

### Examples:
| Shortcut | Effect | Example |
|----------|--------|---------|
| `"s"` | Single key | `<button data-keyboard-shortcut="s">` |
| `"ctrl+s"` | Ctrl + s | `<button data-keyboard-shortcut="ctrl+s">` |
| `"shift+d"` | Shift + d | `<button data-keyboard-shortcut="shift+d">` |
| `"alt+c"` | Alt + c | `<button data-keyboard-shortcut="alt+c">` |
| `"Escape"` | Escape key | `<button data-keyboard-shortcut="Escape">` |
| `"Enter"` | Enter key | `<button data-keyboard-shortcut="Enter">` |

---

## 🚀 Common Shortcuts

| Action | Shortcut | Key |
|--------|----------|-----|
| Save | Ctrl+S | `"ctrl+s"` |
| New/Create | Ctrl+N | `"ctrl+n"` |
| Delete | Shift+D | `"shift+d"` |
| Close/Cancel | Escape | `"Escape"` |
| Submit Form | Ctrl+Enter | `"ctrl+Enter"` |
| Copy | Ctrl+C | `"ctrl+c"` |
| Paste | Ctrl+V | `"ctrl+v"` |
| Undo | Ctrl+Z | `"ctrl+z"` |
| Help | ? | `"?"` |

---

## 💡 Real Examples

### Save Button
```tsx
<button data-keyboard-shortcut="ctrl+s" onClick={save}>
  Save
</button>
```
**Press:** Ctrl+S (or Cmd+S on Mac)

### Delete Button
```tsx
<button data-keyboard-shortcut="shift+d" onClick={delete}>
  Delete
</button>
```
**Press:** Shift+D

### Close Modal
```tsx
<button data-keyboard-shortcut="Escape" onClick={close}>
  Close
</button>
```
**Press:** Escape

### Create New
```tsx
<button data-keyboard-shortcut="ctrl+n" onClick={create}>
  New Order
</button>
```
**Press:** Ctrl+N (or Cmd+N on Mac)

---

## ✨ Features

✅ Works on any button  
✅ Auto-shows tooltip on hover  
✅ Platform-aware (Windows/Mac/Linux)  
✅ Skips input fields automatically  
✅ Skips disabled buttons automatically  
✅ Zero configuration needed  

---

## ⚠️ Avoid These Shortcuts

These conflict with browser shortcuts:
- ❌ `ctrl+t` (New Tab)
- ❌ `ctrl+w` (Close Tab)
- ❌ `ctrl+l` (Address Bar)
- ❌ `ctrl+q` (Quit)
- ❌ `ctrl+p` (Print)

---

## 📊 Platform Display

### Windows/Linux
```
Ctrl+S
Alt+F
Shift+D
```

### Mac
```
⌘S
⌥F
⇧D
```
*Automatically shown based on OS!*

---

## 🧪 Quick Test

1. **Add shortcut:** `<button data-keyboard-shortcut="ctrl+s">Save</button>`
2. **Hover:** See tooltip showing shortcut
3. **Press Keys:** Try Ctrl+S (or Cmd+S on Mac)
4. **Click:** Button should trigger the action
5. **Type in input:** Shortcut should be disabled
6. **Disable button:** Shortcut should be disabled

---

## 🔧 Technical Details

**No config needed!** The system:
- ✅ Parses shortcuts automatically
- ✅ Listens globally for keys
- ✅ Formats based on OS
- ✅ Shows tooltips automatically
- ✅ Handles edge cases

---

## 📚 Full Guides

- **User Guide:** `KEYBOARD_SHORTCUTS.md`
- **Developer Guide:** `src/docs/KEYBOARD_SHORTCUTS_GUIDE.ts`
- **Examples:** `src/docs/KEYBOARD_SHORTCUTS_EXAMPLES.ts`

---

## ❓ FAQ

**Q: How do I add a shortcut?**  
A: Add `data-keyboard-shortcut="ctrl+s"` to the button tag.

**Q: Which shortcuts should I use?**  
A: Follow the common shortcuts table above.

**Q: Why isn't my shortcut working?**  
A: Check that you're not typing in an input field. Shortcuts are disabled while typing.

**Q: Can users see all shortcuts?**  
A: Yes! Press `?` to see the keyboard shortcuts help modal.

**Q: Does it work on mobile?**  
A: Physical keyboards only. Works on tablets with keyboards.

**Q: How do I test?**  
A: Hover to see tooltip, press the key combination.

---

## 🎉 That's It!

Just add `data-keyboard-shortcut` to buttons and they become keyboard accessible!

```tsx
<button data-keyboard-shortcut="ctrl+s">Save</button>
```

Done! ✅
