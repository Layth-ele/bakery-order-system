import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { FOCUS_VISIBLE_CLASS } from '../utils/accessibility';

/**
 * Toast Notification Component
 * 
 * ✅ REFACTORED FEB 9, 2026 (FINAL):
 * - Fixed z-index using utility class .z-toast-max from z-index.css (100000)
 * - Full accessibility: role, aria-live, aria-atomic
 * - Click-to-dismiss and ESC key support
 * - TRULY STABLE timer: Uses ref to prevent resets on parent re-renders
 * - Portal safety with document guard (SSR-safe)
 * - Centralized type mapping (TOAST_STYLES)
 * - Custom animation: animate-toast-pop (smooth bounce-in)
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastNotificationProps {
  message: string;
  onClose: () => void;
  duration?: number;
  type?: ToastType;
}

/**
 * ✅ CENTRALIZED TYPE MAPPING
 * Prevents inline switch duplication across the component
 */
const TOAST_STYLES: Record<
  ToastType,
  {
    bg: string;
    icon: JSX.Element;
    role: 'status' | 'alert';
    ariaLive: 'polite' | 'assertive';
  }
> = {
  success: {
    bg: 'bg-[#4CAF50]',
    icon: <CheckCircle className="w-5 h-5 flex-shrink-0" />,
    role: 'status',
    ariaLive: 'polite',
  },
  error: {
    bg: 'bg-[#F44336]',
    icon: <XCircle className="w-5 h-5 flex-shrink-0" />,
    role: 'alert',
    ariaLive: 'assertive',
  },
  warning: {
    bg: 'bg-[#FF9800]',
    icon: <AlertTriangle className="w-5 h-5 flex-shrink-0" />,
    role: 'alert',
    ariaLive: 'assertive',
  },
  info: {
    bg: 'bg-[#2196F3]',
    icon: <Info className="w-5 h-5 flex-shrink-0" />,
    role: 'status',
    ariaLive: 'polite',
  },
};

export function ToastNotification({
  message,
  onClose,
  duration = 3000,
  type = 'success',
}: ToastNotificationProps): JSX.Element | null {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ CRITICAL FIX: Store onClose in ref to prevent timer resets
  // Without this, if parent recreates onClose function, timer restarts on every render
  const onCloseRef = useRef(onClose);
  
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // ✅ Auto-dismiss timer - STABLE (doesn't depend on onClose directly)
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onCloseRef.current();
    }, duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration]); // ✅ Only re-run if duration changes

  // ✅ ESC key support for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []); // ✅ Never re-run (uses ref)

  // ✅ Click-to-dismiss handler (uses ref)
  const handleClickClose = () => {
    onCloseRef.current();
  };

  const style = TOAST_STYLES[type];

  // ✅ Portal safety: guard against SSR/non-browser environments
  if (typeof document === 'undefined') {
    return null;
  }

  // ✅ CENTERED TOAST: Portal to document.body, always visible above all content
  // Uses .z-toast-max (100000) to appear above modals
  // Uses .animate-toast-pop for smooth bounce-in animation
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-toast-max px-4">
      <div
        className={`${style.bg} text-white px-6 py-4 sm:px-8 sm:py-5 rounded-xl shadow-2xl animate-toast-pop max-w-[90vw] sm:max-w-lg pointer-events-auto transform scale-100`}
        style={{
          boxShadow:
            '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
        role={style.role}
        aria-live={style.ariaLive}
        aria-atomic="true"
      >
        <div className="flex items-center gap-3">
          {style.icon}
          <span className="text-base sm:text-lg leading-relaxed font-medium flex-1">
            {message}
          </span>
          {/* ✅ Click-to-close button */}
          <button
            onClick={handleClickClose}
            className={`ml-2 hover:bg-white/20 rounded-full p-1 transition-colors flex-shrink-0 ${FOCUS_VISIBLE_CLASS}`}
            aria-label="Close notification"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
