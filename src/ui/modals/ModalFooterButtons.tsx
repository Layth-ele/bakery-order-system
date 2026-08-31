/**
 * ModalFooterButtons - Standardized footer button layout for all modals
 * Mobile-first: buttons stack vertically on mobile, side-by-side on sm+
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
  const renderButton = (config: ButtonConfig, key: string, defaultShortcut?: string) => {
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
        className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${BUTTON_STYLES[variant]} ${customClassName}`}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
        {!loading && icon}
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className={`flex flex-col sm:flex-row gap-2.5 w-full ${className}`}>
      {leftAction && (
        <div className="w-full sm:w-auto sm:mr-auto">
          {renderButton(leftAction, "left-action")}
        </div>
      )}
      <div className={`flex flex-col sm:flex-row gap-2.5 ${leftAction ? "" : "w-full"}`}>
        {cancelButton && renderButton(cancelButton, "cancel", "Escape")}
        {extraButtons?.map((btn, i) => renderButton(btn, `extra-${i}`))}
        {confirmButton && renderButton(confirmButton, "confirm", "Enter")}
      </div>
    </div>
  );
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
}: {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  isProcessing?: boolean;
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
  leftAction,
}: {
  onCancel: () => void;
  onDelete: () => void;
  itemName?: string;
  isDeleting?: boolean;
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
