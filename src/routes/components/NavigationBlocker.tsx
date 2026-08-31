/**
 * NavigationBlocker.tsx
 * Confirmation modal for blocked navigation
 * 
 * Features:
 * - Luxury black and gold styling
 * - Smooth animations
 * - Keyboard support (Enter/Escape)
 * - Accessible
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface NavigationBlockerProps {
  /**
   * Whether the blocker is active
   */
  isBlocked: boolean;
  
  /**
   * Callback when user confirms navigation
   */
  onConfirm: () => void;
  
  /**
   * Callback when user cancels navigation
   */
  onCancel: () => void;
  
  /**
   * Custom message to display
   */
  message?: string;
  
  /**
   * Custom title
   */
  title?: string;
}

/**
 * Modal that appears when navigation is blocked due to unsaved changes
 */
export function NavigationBlocker({
  isBlocked,
  onConfirm,
  onCancel,
  message = 'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
  title = 'Unsaved Changes',
}: NavigationBlockerProps): JSX.Element | null {
  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isBlocked) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBlocked, onConfirm, onCancel]);
  
  return (
    <AnimatePresence>
      {isBlocked && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]"
            onClick={onCancel}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-gradient-to-br from-gray-900 to-black border border-[#D4A574]/30 rounded-lg shadow-2xl max-w-md w-full"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-white mb-2">
                      {title}
                    </h2>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {message}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="p-6 flex gap-3 justify-end">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                >
                  Stay on Page
                </button>
                <button
                  onClick={onConfirm}
                  className="px-4 py-2 rounded-md bg-[#D4A574] hover:bg-[#C4956A] text-black font-semibold transition-colors"
                >
                  Leave Page
                </button>
              </div>
              
              {/* Keyboard hint */}
              <div className="px-6 pb-4 text-xs text-gray-600 text-center">
                Press <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">Esc</kbd> to stay or <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">Enter</kbd> to leave
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Compact version for smaller screens
 */
export function CompactNavigationBlocker({
  isBlocked,
  onConfirm,
  onCancel,
  message = 'Unsaved changes will be lost.',
}: NavigationBlockerProps): JSX.Element | null {
  return (
    <AnimatePresence>
      {isBlocked && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[9998]"
            onClick={onCancel}
          />
          
          <div className="fixed inset-0 flex items-end sm:items-center justify-center z-[9999] p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-gray-900 border border-[#D4A574]/30 rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-sm"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  <p className="text-white text-sm">{message}</p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors"
                  >
                    Stay
                  </button>
                  <button
                    onClick={onConfirm}
                    className="flex-1 px-4 py-2 rounded bg-[#D4A574] hover:bg-[#C4956A] text-black font-semibold text-sm transition-colors"
                  >
                    Leave
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
