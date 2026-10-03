/**
 * ModalFooterButtons - Standardized footer button layout for all modals
 * Mobile-first: on phones every button is full width and 44 px tall, main
 * action on top and Cancel/Close last; on sm+ one row.
 */

import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "success"
  | "warning"
  | "ghost";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-[#D4A574] to-[#E8C4A2] hover:from-[#C49564] hover:to-[#D4A574] text-[#333333] shadow-md hover:shadow-lg",
  secondary:
    "bg-neutral-200 hover:bg-neutral-300 text-neutral-700",
  danger:
    "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white shadow-md",
  success:
    "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-md",
  warning:
    "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-white shadow-md",
  ghost:
    "bg-transparent hover:bg-neutral-100 text-neutral-600 border border-neutral-300",
};

interface ButtonConfig {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  keyboardShortcut?: string; // ✅ APR 1, 2026: Support keyboard shortcuts
}

interface ModalFooterButtonsProps {
  leftAction?: ButtonConfig;
  cancelButton?: ButtonConfig;
  confirmButton?: ButtonConfig;
  extraButtons?: ButtonConfig[];
  headerColor?: string;
  fullWidth?: boolean;
  className?: string;
}

export function ModalFooterButtons({
  leftAction,
  cancelButton,
  confirmButton,
  extraButtons,
  headerColor: _headerColor,
  fullWidth = false,
  className = "",
}: ModalFooterButtonsProps): JSX.Element | null {
  const renderButton = (config: ButtonConfig, key: string, defaultShortcut?: string, order = "") => {
    const {
      label,
      onClick,
      variant = "secondary",
      disabled = false,
      loading = false,
      icon,
      className: customClassName = "",
      keyboardShortcut,
    } = config;

    return (
      <button
        key={key}
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        data-keyboard-shortcut={keyboardShortcut || defaultShortcut}
        className={`${order} w-full sm:w-auto sm:flex-1 min-h-[44px] px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${BUTTON_STYLES[variant]} ${customClassName}`}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
        {!loading && icon}
        <span>{label}</span>
      </button>
    );
  };

  // One container; CSS order sets the sequence per screen size.
  //   Phones (stacked, full width): main action → extras → side action →
  //     Cancel/Close last (closest to the thumb, like iOS sheets).
  //   sm and up (one row): side action on the left; Cancel/Close, extras,
  //     main action on the right.
  return (
    <div className={`flex w-full flex-col gap-2.5 sm:flex-row sm:items-center ${className}`}>
      {leftAction && renderButton(leftAction, "left-action", undefined, "order-3 sm:order-1 sm:mr-auto sm:flex-none")}
      {cancelButton && renderButton(cancelButton, "cancel", "Escape", "order-4 sm:order-2")}
      {extraButtons?.map((btn, i) => renderButton(btn, `extra-${i}`, undefined, "order-2 sm:order-3"))}
      {confirmButton && renderButton(confirmButton, "confirm", "Enter", "order-1 sm:order-4")}
    </div>
  );
}

/**
 * Submit a modal's <form> from its footer button (the footer sits outside
 * the form so it stays visible while the body scrolls). requestSubmit runs
 * the browser's validation and the form's onSubmit, exactly like Enter.
 */
export function submitForm(formId: string): void {
  (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
}

export function CloseFooter({ onClose }: { onClose: () => void }) {
  return (
    <ModalFooterButtons
      confirmButton={{ 
        label: "Close", 
        onClick: onClose, 
        variant: "primary",
        keyboardShortcut: "Escape" // ✅ APR 1, 2026: Escape to close
      }}
    />
  );
}

export function CancelConfirmFooter({
  onCancel,
  onConfirm,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  isProcessing = false,
  disabled = false,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  isProcessing?: boolean;
  /** Confirm not allowed (e.g. a rule shown in the modal blocks it). */
  disabled?: boolean;
}) {
  return (
    <ModalFooterButtons
      cancelButton={{ 
        label: cancelLabel, 
        onClick: onCancel, 
        variant: "secondary", 
        disabled: isProcessing,
        keyboardShortcut: "Escape" // ✅ APR 1, 2026: Escape to cancel
      }}
      confirmButton={{ 
        label: confirmLabel, 
        onClick: onConfirm, 
        variant: confirmVariant, 
        loading: isProcessing,
        disabled,
        keyboardShortcut: "Enter" // ✅ APR 1, 2026: Enter to confirm
      }}
    />
  );
}

export function DeleteFooter({
  onCancel,
  onDelete,
  itemName = "item",
  isDeleting = false,
  deleteDisabled = false,
  leftAction,
}: {
  onCancel: () => void;
  onDelete: () => void;
  itemName?: string;
  isDeleting?: boolean;
  deleteDisabled?: boolean;
  leftAction?: ButtonConfig;
}) {
  return (
    <ModalFooterButtons
      leftAction={leftAction}
      cancelButton={{ 
        label: "Cancel", 
        onClick: onCancel, 
        variant: "secondary", 
        disabled: isDeleting,
        keyboardShortcut: "Escape" // ✅ APR 1, 2026: Escape to cancel
      }}
      confirmButton={{ 
        label: `Delete ${itemName}`, 
        onClick: onDelete, 
        variant: "danger", 
        loading: isDeleting,
        disabled: deleteDisabled,
        keyboardShortcut: "shift+d" // ✅ APR 1, 2026: Shift+D to delete
      }}
    />
  );
}

export function SaveFooter({
  onCancel,
  onSave,
  cancelLabel = "Cancel",
  saveLabel = "Save",
  isSaving = false,
  saveDisabled = false,
  saveIcon,
}: {
  onCancel: () => void;
  onSave: () => void;
  cancelLabel?: string;
  saveLabel?: string;
  isSaving?: boolean;
  saveDisabled?: boolean;
  saveIcon?: ReactNode;
}) {
  return (
    <ModalFooterButtons
      cancelButton={{ 
        label: cancelLabel, 
        onClick: onCancel, 
        variant: "secondary", 
        disabled: isSaving,
        keyboardShortcut: "Escape" // ✅ APR 1, 2026: Escape to cancel
      }}
      confirmButton={{ 
        label: saveLabel, 
        onClick: onSave, 
        variant: "primary", 
        loading: isSaving, 
        disabled: saveDisabled, 
        icon: saveIcon,
        keyboardShortcut: "ctrl+s" // ✅ APR 1, 2026: Ctrl+S to save
      }}
    />
  );
}
