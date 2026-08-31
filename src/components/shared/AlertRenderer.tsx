/**
 * ===================================================================
 * AlertRenderer - Pure UI Component for Alert Dialogs
 * ===================================================================
 * 
 * Extracted from AlertContext to separate concerns:
 * - Context manages state and lifecycle
 * - Renderer handles UI presentation only
 * 
 * Created: March 8, 2026 (Phase 2 of Contexts Refactoring)
 * 
 * Responsibilities:
 * - Render alert UI based on configuration
 * - Handle user interactions (button clicks)
 * - Format messages (email links, line breaks)
 * - Apply premium black & gold styling
 * 
 * Does NOT:
 * - Manage state (delegated to AlertContext)
 * - Handle keyboard events (delegated to AlertContext)
 * - Manage scroll locking (delegated to AlertContext)
 * 
 * Version: 1.0.0
 * ===================================================================
 */

import {X} from 'lucide-react'
import type {AlertConfig} from '../../contexts/AlertContext'

// ============================================
// Types
// ============================================

interface AlertRendererProps {
  config: AlertConfig | null;
  onClose: () => void;
}

interface IconConfig {
  gradient: string;
  borderColor: string;
  svgPath: string;
  emoji: string;
  color: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get icon configuration based on alert type
 */
function getIconConfig(icon: string): IconConfig {
  switch (icon) {
    case 'success':
      return {
        gradient: 'from-[#4CAF50] to-[#66BB6A]',
        borderColor: 'border-[#4CAF50]/30',
        svgPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        emoji: '✅',
        color: '#4CAF50',
      };
    case 'error':
      return {
        gradient: 'from-[#F44336] to-[#E57373]',
        borderColor: 'border-[#F44336]/30',
        svgPath: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        emoji: '❌',
        color: '#F44336',
      };
    case 'warning':
      return {
        gradient: 'from-[#FF9800] to-[#FFB74D]',
        borderColor: 'border-[#FF9800]/30',
        svgPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
        emoji: '⚠️',
        color: '#FF9800',
      };
    case 'info':
      return {
        gradient: 'from-[#2196F3] to-[#64B5F6]',
        borderColor: 'border-[#2196F3]/30',
        svgPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        emoji: 'ℹ️',
        color: '#2196F3',
      };
    case 'pending':
      return {
        gradient: 'from-[#D4A574] to-[#e8dcc8]',
        borderColor: 'border-[#e8dcc8]/30',
        svgPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
        emoji: '⏳',
        color: '#D4A574',
      };
    default:
      return {
        gradient: 'from-[#2196F3] to-[#64B5F6]',
        borderColor: 'border-[#2196F3]/30',
        svgPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        emoji: 'ℹ️',
        color: '#2196F3',
      };
  }
}

/**
 * Get button styling based on variant
 */
function getButtonClass(variant: string = 'primary', iconConfig: IconConfig): string {
  switch (variant) {
    case 'danger':
      return 'px-6 py-3 bg-gradient-to-r from-[#F44336] to-[#E57373] text-white rounded-lg hover:from-[#E57373] hover:to-[#F44336] transition-all shadow-md font-semibold';
    case 'secondary':
      return 'px-6 py-3 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg transition-all font-semibold';
    default:
      return 'px-6 py-3 bg-gradient-to-r from-[#D4A574] to-[#E8C4A2] hover:from-[#C49564] hover:to-[#D4A574] text-[#333333] rounded-lg transition-all shadow-md font-semibold';
  }
}

/**
 * Format message with email links and line breaks
 */
function formatMessage(message: string): JSX.Element | null {
  return (
    <>
      {(message || '').split('\\n').map((line, index) => {
        // Check if line contains an email
        const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        
        if (emailMatch) {
          const email = emailMatch[1];
          const parts = line.split(email);
          
          return (
            <span key={index}>
              {parts[0]}
              <a 
                href={`mailto:${email}`}
                className="text-[#D4A574] hover:text-[#8B6F47] underline transition-colors font-semibold"
              >
                {email}
              </a>
              {parts[1]}
              {index < (message || '').split('\\n').length - 1 && <br />}
            </span>
          );
        }
        
        return (
          <span key={index}>
            {line}
            {index < (message || '').split('\\n').length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

// ============================================
// Component
// ============================================

/**
 * AlertRenderer - Pure presentation component
 * 
 * Renders alert dialogs with premium black & gold styling.
 * All state management is handled by AlertContext.
 * 
 * @param config - Alert configuration (null = no alert shown)
 * @param onClose - Callback to close the alert
 */
export function AlertRenderer({ config, onClose }: AlertRendererProps): JSX.Element | null {
  if (!config) return null;

  const iconConfig = getIconConfig(config.icon || 'info');
  
  return (
    <>
      {/* BACKDROP OVERLAY - Blocks interaction when modal is shown */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-alert-backdrop animate-fade-in"
        onClick={() => {
          // Only allow closing by clicking backdrop if there are no buttons
          // (buttons mean it's a confirm dialog that should be explicitly dismissed)
          if (!config.buttons) {
            onClose();
          }
        }}
        aria-hidden="true"
      />
      
      {/* MODAL CONTAINER - Centered on screen */}
      <div className="fixed inset-0 z-alert-content flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="pointer-events-auto w-full max-w-md animate-scale-in"
          style={{
            animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          <div className="bg-gray-50 rounded-xl shadow-2xl w-full overflow-hidden border-2 border-[#D4A574]/30">
            {/* Header - Premium Black & Gold Style */}
            <div className="bg-gradient-to-r from-[#D4A574] to-[#8B6F47] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 sm:w-7 sm:h-7 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d={iconConfig.svgPath}
                    />
                  </svg>
                </div>
                <h2 className="text-lg sm:text-xl text-white font-bold uppercase tracking-wide">
                  {config.title}
                </h2>
              </div>
              {/* ✅ Always show close button (X) for all alerts */}
              <button
                type="button"
                onClick={onClose}
                className="text-white hover:bg-white/20 active:bg-white/30 transition-colors rounded-lg p-2 flex-shrink-0"
                aria-label="Close alert"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Body - White background with premium styling */}
            <div className="p-4 sm:p-6 bg-white rounded-b-xl">
              {/* Icon Section - Large centered icon */}
              <div className="flex justify-center mb-4">
                <div 
                  className={`size-16 sm:size-20 rounded-full bg-gradient-to-br ${iconConfig.gradient} flex items-center justify-center shadow-lg`}
                  aria-hidden="true"
                >
                  <span className="text-3xl sm:text-4xl">{iconConfig.emoji}</span>
                </div>
              </div>

              {/* Message */}
              <div className="mb-6">
                <p className="text-neutral-700 text-sm sm:text-base leading-relaxed whitespace-pre-line text-center">
                  {formatMessage(config.message)}
                </p>
              </div>

              {/* Buttons */}
              <div className="space-y-3">
                {config.buttons ? (
                  config.buttons.map((button, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={button.onClick}
                      className={`w-full ${getButtonClass(button.variant, iconConfig)}`}
                      style={{ letterSpacing: '0.05em' }}
                    >
                      {button.label}
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#D4A574] to-[#8B6F47] text-white rounded-lg hover:shadow-lg hover:brightness-105 active:scale-[0.98] transition-all font-bold uppercase tracking-wide"
                  >
                    OK
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}