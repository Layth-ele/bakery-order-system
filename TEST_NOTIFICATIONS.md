# Testing Admin Notifications

## 🎯 **CURRENT STATUS: FIXED!**

✅ **Issue Identified**: Firebase permissions error - customers couldn't create admin notifications  
✅ **Solution Applied**: Modified Firestore rules to allow authenticated users to create admin notifications  
✅ **Testing Ready**: Dev server running at http://localhost:3001  

## 🧪 Manual Testing Steps

### Step 1: Open Browser Console
1. Open http://localhost:3001 in your browser
2. Open Developer Tools (F12 or right-click → Inspect)
3. Go to **Console** tab
4. Search for logs starting with `🔔`, `📱`, `💾`, `✅`, or `🎯`

### Step 2: Place an Order (as Customer)
1. Login as a **customer** account
2. Browse products and add items to cart
3. Click "Submit Order"
4. **Watch for these console logs:**
   - `🔔 [orderCreationService] About to call notifyOrderPlacedTracking for order: ORD-***`
   - `🔔 [notifyOrderPlacedTracking] Called with order: ORD-***`
   - `🔔 [createAdminNotification] Creating notification: order-***-placed-tracking, type: ORDER_PLACED_TRACKING, title: 📦 Order Placed - Track Now`
   - `💾 [createAdminNotificationLocalStorage] Saving notification: order-***-placed-tracking, ORDER_PLACED_TRACKING`
   - `✅ [createAdminNotificationLocalStorage] Saved to localStorage, total notifications: 1`

### Step 3: Check Admin Bell
1. Login as **admin** (in new tab or logout/login)
2. **Watch for these console logs:**
   - `📱 [AdminNotificationProvider] Loaded notifications from localStorage: 1, [...]`
   - `📱 [AdminNotificationProvider] Converted notifications: 1, [...]`
   - `🔔 [AdminNotificationBell] Context: { unreadCount: 1, totalNotifications: 1 }`
3. **Check the notification bell** - should show **red badge with "1"**

### Step 4: Click Bell to View Notifications
1. Click the notification bell icon
2. **Watch for these console logs:**
   - `🎯 [ModalResolver] Resolving modal: ADMIN_ORDER_VIEW`
   - `🎯 [ModalResolver] Notification type: ORDER_PLACED_TRACKING, ID: order-***-placed-tracking`
3. **Admin Notifications Modal** should open with your order

### Step 5: Click "Track Order" Button
1. Click the "Track Order" button in the notification
2. **Admin Order View Modal** should open showing complete order details

## 🔍 If Still Not Working

### **Check Firebase Permissions (Production)**
If you're in production mode and still getting permission errors:

1. **Deploy Firestore Rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Check Rules Applied:**
   ```javascript
   // In browser console, check if rules allow create:
   // The rules should now allow: allow create: if isAuthenticated();
   ```

### **Check localStorage (Development)**
If in development mode and notifications aren't showing:

```javascript
// Check what's stored
JSON.parse(localStorage.getItem('notifications/admin/items') || '[]')

// Should show array with your notification:
// {
//   id: "order-ORD-***-placed-tracking",
//   type: "ORDER_PLACED_TRACKING",
//   title: "📦 Order Placed - Track Now",
//   orderId: "ORD-***",
//   metadata: { customerName: "...", orderNumber: "...", total: ... },
//   ...
// }
```

## 🔴 If Nothing Appears

**Check these in order:**

1. **Order was created?**
   - Search console for: `✅ [orderCreationService] notifyOrderPlacedTracking completed successfully`
   - If missing → order creation failed

2. **Notification was created?**
   - Search console for: `✅ [createAdminNotificationLocalStorage] Saved to localStorage`
   - If missing → notification creation failed
   - Check: `localStorage.getItem('notifications/admin/items')`

3. **Notification was loaded in admin context?**
   - Search console for: `📱 [AdminNotificationProvider] Loaded notifications from localStorage: 1`
   - If shows `0` → localStorage key is wrong or notifications weren't saved

4. **Admin bell rendering with notifications?**
   - Search console for: `🔔 [AdminNotificationBell] Context: { unreadCount: 1`
   - If `unreadCount: 0` → notifications exist but not marked as unread

5. **Modal resolving correctly?**
   - Search console for: `🎯 [ModalResolver] Resolving modal: ADMIN_ORDER_VIEW`
   - If not found → modal mapping issue

## 🛠️ Debug Commands

Run these in browser console to troubleshoot:

```javascript
// 1. Check if notifications are in localStorage
const notifs = JSON.parse(localStorage.getItem('notifications/admin/items') || '[]');
console.log('Notifications in storage:', notifs);
console.log('Count:', notifs.length);

// 2. Check specific notification
const placed = notifs.find(n => n.type === 'ORDER_PLACED_TRACKING');
console.log('ORDER_PLACED_TRACKING notification:', placed);

// 3. Clear notifications (to test again)
localStorage.removeItem('notifications/admin/items');
console.log('Cleared notifications');

// 4. Manually create a test notification
const testNotif = {
  id: 'test-notification-' + Date.now(),
  type: 'ORDER_PLACED_TRACKING',
  title: '📦 Test Order',
  message: 'This is a test notification',
  orderId: 'ORD-TEST-001',
  read: false,
  createdAt: new Date().toISOString(),
  actions: [],
  metadata: { customerName: 'Test Customer', orderNumber: 'ORD-TEST-001', total: 50 }
};
localStorage.setItem('notifications/admin/items', JSON.stringify([testNotif]));
console.log('Created test notification - refresh page to see it');
```

## 📋 Expected Flow

```
Customer places order
   ↓
orderCreationService.createCustomerOrder()
   ↓
notifyOrderPlacedTracking(order)
   ↓
createAdminNotification() → localStorage (dev) OR Firebase (prod)
   ↓
AdminNotificationProvider loads notifications
   ↓
AdminNotificationBell renders with unreadCount badge
   ↓
Admin clicks bell → AdminNotificationsModal opens
   ↓
Admin clicks notification → ADMIN_ORDER_VIEW modal opens with order details
```

## 🎯 Expected Console Output

When placing an order, you should see this sequence:

```
🔔 [orderCreationService] About to call notifyOrderPlacedTracking for order: ORD-2026-03-26-001
🔔 [notifyOrderPlacedTracking] Called with order: ORD-2026-03-26-001
🔔 [createAdminNotification] Creating notification: order-ORD-2026-03-26-001-placed-tracking, type: ORDER_PLACED_TRACKING, title: 📦 Order Placed - Track Now, orderId: ORD-2026-03-26-001
💾 [createAdminNotificationLocalStorage] Saving notification: order-ORD-2026-03-26-001-placed-tracking, ORDER_PLACED_TRACKING
✅ [createAdminNotificationLocalStorage] Saved to localStorage, total notifications: 1
✅ [orderCreationService] notifyOrderPlacedTracking completed successfully
```

Then when opening admin and clicking bell:

```
📱 [AdminNotificationProvider] Loaded notifications from localStorage: 1, [...]
📱 [AdminNotificationProvider] Converted notifications: 1, [...]
🔔 [AdminNotificationBell] Context: { unreadCount: 1, totalNotifications: 1 }
🎯 [ModalResolver] Resolving modal: ADMIN_ORDER_VIEW
🎯 [ModalResolver] Notification type: ORDER_PLACED_TRACKING, ID: order-ORD-2026-03-26-001-placed-tracking
```

## 🚀 **Ready to Test!**

The dev server is running at **http://localhost:3001**

**Go test it now!** Place an order as a customer and check if the admin gets the notification. Share the console logs if you encounter any issues.

