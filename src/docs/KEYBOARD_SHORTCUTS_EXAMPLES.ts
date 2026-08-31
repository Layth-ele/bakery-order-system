/**
 * KEYBOARD SHORTCUTS - RECOMMENDED IMPLEMENTATIONS
 * ✅ APR 1, 2026: Example implementations for common buttons
 * 
 * This file shows practical examples of how to add keyboard shortcuts
 * to buttons throughout the application.
 * 
 * Copy these patterns to add shortcuts to your components!
 */

/**
 * SAVE & SUBMIT BUTTONS
 * Use: Ctrl+S (standard save shortcut)
 */
export const SaveButtonExample = `
<button 
  data-keyboard-shortcut="ctrl+s"
  onClick={handleSave}
  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
>
  Save Changes
</button>
`;

/**
 * DELETE BUTTONS
 * Use: Shift+D (less common, requires confirmation)
 */
export const DeleteButtonExample = `
<button 
  data-keyboard-shortcut="shift+d"
  onClick={handleDelete}
  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
>
  Delete
</button>
`;

/**
 * CLOSE/CANCEL BUTTONS
 * Use: Escape (standard close shortcut)
 */
export const CloseButtonExample = `
<button 
  data-keyboard-shortcut="Escape"
  onClick={onClose}
  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
>
  Close
</button>
`;

/**
 * CREATE NEW BUTTONS
 * Use: Ctrl+N (standard new shortcut)
 */
export const CreateNewButtonExample = `
<button 
  data-keyboard-shortcut="ctrl+n"
  onClick={handleNew}
  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
>
  New Order
</button>
`;

/**
 * MODAL ACTION BUTTONS
 * Use: Enter to confirm, Escape to cancel
 */
export const ModalActionsExample = `
<div className="flex gap-2">
  {/* Cancel Button */}
  <button 
    data-keyboard-shortcut="Escape"
    onClick={onCancel}
    className="px-4 py-2 bg-gray-300 rounded"
  >
    Cancel
  </button>
  
  {/* Confirm Button */}
  <button 
    data-keyboard-shortcut="Enter"
    onClick={onConfirm}
    className="px-4 py-2 bg-blue-500 text-white rounded"
  >
    Confirm
  </button>
</div>
`;

/**
 * FORM SUBMISSION
 * Use: Ctrl+Enter (common form submit)
 */
export const FormSubmitExample = `
<form>
  <input type="text" placeholder="Order details" />
  <textarea placeholder="Notes" />
  
  <button 
    data-keyboard-shortcut="ctrl+Enter"
    type="submit"
    className="px-4 py-2 bg-green-500 text-white rounded"
  >
    Submit Order
  </button>
</form>
`;

/**
 * NAVIGATION BUTTONS
 * Use: Single letters (p, a, c, etc.)
 */
export const NavigationButtonsExample = `
<nav className="flex gap-2">
  <button 
    data-keyboard-shortcut="p"
    onClick={() => navigate('pending')}
    className="nav-button"
  >
    Pending Orders
  </button>
  
  <button 
    data-keyboard-shortcut="a"
    onClick={() => navigate('approved')}
    className="nav-button"
  >
    Approved Orders
  </button>
  
  <button 
    data-keyboard-shortcut="c"
    onClick={() => navigate('completed')}
    className="nav-button"
  >
    Completed Orders
  </button>
  
  <button 
    data-keyboard-shortcut="r"
    onClick={() => navigate('rejected')}
    className="nav-button"
  >
    Rejected Orders
  </button>
</nav>
`;

/**
 * ADMIN PANEL BUTTONS
 * Use: Combinations with modifiers
 */
export const AdminPanelExample = `
<div className="admin-actions">
  {/* Refresh Data */}
  <button 
    data-keyboard-shortcut="ctrl+r"
    onClick={refreshData}
    title="Refresh data (Ctrl+R)"
    className="icon-button"
  >
    🔄 Refresh
  </button>
  
  {/* Edit */}
  <button 
    data-keyboard-shortcut="e"
    onClick={handleEdit}
    title="Edit (E)"
    className="icon-button"
  >
    ✏️ Edit
  </button>
  
  {/* Export */}
  <button 
    data-keyboard-shortcut="ctrl+e"
    onClick={handleExport}
    title="Export (Ctrl+E)"
    className="icon-button"
  >
    📥 Export
  </button>
  
  {/* Help */}
  <button 
    data-keyboard-shortcut="?"
    onClick={showHelp}
    title="Help (?) "
    className="icon-button"
  >
    ❓ Help
  </button>
</div>
`;

/**
 * MODAL WITH MULTIPLE ACTIONS
 * Example: Order details modal
 */
export const OrderModalExample = `
<div className="order-modal">
  <h2>Order Details</h2>
  <div className="order-info">
    {/* Order info displayed here */}
  </div>
  
  <div className="modal-actions flex gap-2 mt-6">
    {/* Approve Button */}
    <button 
      data-keyboard-shortcut="shift+a"
      onClick={handleApprove}
      className="px-4 py-2 bg-green-500 text-white rounded"
    >
      Approve
    </button>
    
    {/* Reject Button */}
    <button 
      data-keyboard-shortcut="shift+r"
      onClick={handleReject}
      className="px-4 py-2 bg-red-500 text-white rounded"
    >
      Reject
    </button>
    
    {/* Edit Button */}
    <button 
      data-keyboard-shortcut="e"
      onClick={handleEdit}
      className="px-4 py-2 bg-yellow-500 text-white rounded"
    >
      Edit
    </button>
    
    {/* Close Button */}
    <button 
      data-keyboard-shortcut="Escape"
      onClick={onClose}
      className="px-4 py-2 bg-gray-300 rounded"
    >
      Close
    </button>
  </div>
</div>
`;

/**
 * SEARCH & FILTER BUTTONS
 * Use: Ctrl+F for find, Alt+F for filter
 */
export const SearchFilterExample = `
<div className="search-controls">
  {/* Search/Find */}
  <button 
    data-keyboard-shortcut="ctrl+f"
    onClick={focusSearch}
    className="px-3 py-1 bg-blue-100 rounded"
  >
    🔍 Find
  </button>
  
  {/* Filter */}
  <button 
    data-keyboard-shortcut="alt+f"
    onClick={toggleFilters}
    className="px-3 py-1 bg-blue-100 rounded"
  >
    🔽 Filter
  </button>
  
  {/* Clear */}
  <button 
    data-keyboard-shortcut="alt+c"
    onClick={clearSearch}
    className="px-3 py-1 bg-blue-100 rounded"
  >
    ✕ Clear
  </button>
</div>
`;

/**
 * BULK ACTIONS
 * Use: Ctrl + number keys for multiple actions
 */
export const BulkActionsExample = `
<div className="bulk-actions">
  {/* Select All */}
  <button 
    data-keyboard-shortcut="ctrl+shift+a"
    onClick={selectAll}
    className="bulk-button"
  >
    Select All
  </button>
  
  {/* Deselect All */}
  <button 
    data-keyboard-shortcut="ctrl+shift+d"
    onClick={deselectAll}
    className="bulk-button"
  >
    Deselect All
  </button>
  
  {/* Export Selected */}
  <button 
    data-keyboard-shortcut="ctrl+e"
    onClick={exportSelected}
    className="bulk-button"
  >
    Export
  </button>
  
  {/* Delete Selected */}
  <button 
    data-keyboard-shortcut="ctrl+shift+x"
    onClick={deleteSelected}
    className="bulk-button"
  >
    Delete
  </button>
</div>
`;

/**
 * CUSTOMER ORDER MANAGEMENT
 * Practical example for the bakery app
 */
export const CustomerOrderManagementExample = `
<div className="order-actions">
  {/* Create New Order */}
  <button 
    data-keyboard-shortcut="ctrl+n"
    onClick={createNewOrder}
    className="px-4 py-2 bg-green-500 text-white rounded"
  >
    Create Order
  </button>
  
  {/* View Order Details */}
  <button 
    data-keyboard-shortcut="o"
    onClick={viewOrderDetails}
    className="px-4 py-2 bg-blue-500 text-white rounded"
  >
    View Details
  </button>
  
  {/* Edit Order */}
  <button 
    data-keyboard-shortcut="e"
    onClick={editOrder}
    className="px-4 py-2 bg-yellow-500 text-white rounded"
  >
    Edit Order
  </button>
  
  {/* Mark as Paid */}
  <button 
    data-keyboard-shortcut="p"
    onClick={markAsPaid}
    className="px-4 py-2 bg-purple-500 text-white rounded"
  >
    Mark Paid
  </button>
  
  {/* Cancel Order */}
  <button 
    data-keyboard-shortcut="shift+c"
    onClick={cancelOrder}
    className="px-4 py-2 bg-red-500 text-white rounded"
  >
    Cancel
  </button>
  
  {/* Print Order */}
  <button 
    data-keyboard-shortcut="ctrl+p"
    onClick={printOrder}
    className="px-4 py-2 bg-gray-500 text-white rounded"
  >
    Print
  </button>
</div>
`;

/**
 * ACCESSIBILITY EXAMPLE
 * Best practices for keyboard shortcuts
 */
export const AccessibilityBestPracticesExample = `
<div className="accessible-actions">
  {/* ✅ Good: Has title, shortcut, and fallback */}
  <button 
    data-keyboard-shortcut="ctrl+s"
    title="Save changes (Ctrl+S)"
    onClick={save}
    disabled={!hasChanges}
    className={disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  >
    Save
  </button>
  
  {/* ✅ Good: Escape key for modals */}
  <button 
    data-keyboard-shortcut="Escape"
    onClick={close}
    className="px-4 py-2 text-gray-600"
  >
    Close
  </button>
  
  {/* ✅ Good: Enter for confirm in forms */}
  <button 
    data-keyboard-shortcut="Enter"
    type="submit"
    onClick={submit}
    className="px-4 py-2 bg-green-500 text-white"
  >
    Submit
  </button>
  
  {/* ✅ Good: Help shortcut */}
  <button 
    data-keyboard-shortcut="?"
    onClick={showKeyboardHelp}
    title="Show keyboard shortcuts (?)"
    className="px-2 py-1 text-sm"
  >
    Help
  </button>
</div>
`;

/**
 * IMPLEMENTATION CHECKLIST
 * 
 * When adding a keyboard shortcut:
 * 
 * [ ] Choose shortcut (check for conflicts)
 * [ ] Add data-keyboard-shortcut attribute
 * [ ] Test on keyboard press
 * [ ] Verify tooltip shows on hover
 * [ ] Test with disabled button (should not trigger)
 * [ ] Test while typing in input (should not trigger)
 * [ ] Cross-browser test (Chrome, Firefox, Safari, Edge)
 * [ ] Test on different OS (Windows, Mac, Linux)
 * [ ] Add to keyboard shortcuts help modal if important
 * [ ] Document in code comments
 * [ ] Add to user documentation
 */

/**
 * KEYBOARD SHORTCUT REFERENCE
 * 
 * Standard shortcuts to use:
 * 
 * SAVE/SUBMIT
 * ctrl+s    → Save
 * ctrl+Enter → Submit (forms)
 * 
 * CREATE
 * ctrl+n    → New/Create
 * 
 * EDIT/DELETE
 * e         → Edit
 * shift+d   → Delete
 * shift+x   → Remove
 * 
 * CLOSE/CANCEL
 * Escape    → Close/Cancel
 * 
 * COPY/PASTE
 * ctrl+c    → Copy
 * ctrl+v    → Paste
 * 
 * UNDO/REDO
 * ctrl+z    → Undo
 * ctrl+y    → Redo
 * 
 * FIND/FILTER
 * ctrl+f    → Find
 * alt+f     → Filter
 * alt+c     → Clear
 * 
 * NAVIGATION
 * p         → Pending
 * a         → Approved
 * c         → Completed
 * r         → Rejected
 * 
 * ADMIN
 * ctrl+r    → Refresh
 * ?         → Help
 * 
 * MODALS
 * Enter     → Confirm/Submit
 * Escape    → Close/Cancel
 */

export const KEYBOARD_SHORTCUTS_EXAMPLES = {
  SaveButtonExample,
  DeleteButtonExample,
  CloseButtonExample,
  CreateNewButtonExample,
  ModalActionsExample,
  FormSubmitExample,
  NavigationButtonsExample,
  AdminPanelExample,
  OrderModalExample,
  SearchFilterExample,
  BulkActionsExample,
  CustomerOrderManagementExample,
  AccessibilityBestPracticesExample,
};
