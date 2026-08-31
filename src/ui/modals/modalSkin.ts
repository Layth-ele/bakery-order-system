/**
 * Modal Skin System
 *
 * Centralized styling tokens for consistent modal appearance across
 * different modal infrastructures (BaseModal, ModalLayout, StyleModalShell).
 *
 * Ensures all modals share the same black/gold luxury aesthetic matching
 * the Reject Order modal design.
 */

export const rejectSkin = {
  // Backdrop overlay
  overlay:
    "fixed inset-0 bg-black/70 backdrop-blur-sm z-50 p-4 flex items-center justify-center",

  // Main modal container/panel
  panel:
    "relative bg-white rounded-xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col",

  // Header section (gold gradient)
  header:
    "bg-gradient-to-r from-[#D4A574] to-[#E8C4A2] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0",

  // Title styling
  title:
    "text-lg sm:text-2xl text-[#333333] font-semibold tracking-wide",

  // Subtitle/description styling
  subtitle: "text-xs sm:text-sm text-[#333333]/70",

  // Body content area
  body: "flex-1 overflow-y-auto p-4 sm:p-6",

  // Footer action bar
  footer:
    "border-t border-neutral-200 bg-white px-4 sm:px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0",

  // Close button
  closeBtn:
    "text-[#333333] hover:text-white transition-colors p-1.5 sm:p-2 rounded-lg hover:bg-white/20",
};

// Export type for TypeScript safety
export type ModalSkin = typeof rejectSkin;