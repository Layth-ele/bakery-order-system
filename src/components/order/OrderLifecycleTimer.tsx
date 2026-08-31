/**
 * 🔄 ORDER LIFECYCLE TIMER COMPONENT
 * 
 * Displays real-time countdown timer and progress indicator for paid orders.
 * Shows how much time remains until the order delivery week ends and it's in process to be finalized.
 */

import { useState, useEffect } from 'react';
import {Clock, AlertCircle, CheckSquare, Copy} from 'lucide-react'
import { Order } from '../../types';
import {
  getOrderLifecycleStatus,
  formatLifecycleCountdown,
  getLifecycleColorClasses,
  getLifecycleIcon,
  type OrderLifecycleStatus
} from '../../services/paidOrderLifecycleService';
import { completeOrderNow } from '../../services/orderCompletion/completeOrderNow';
import { useAlert } from '../../contexts/AlertContext';
import { toast } from 'sonner';
import { displayOrderNumber } from '../../utils/displayId';

interface OrderLifecycleTimerProps {
  order: Order;
  variant?: 'compact' | 'detailed';
  refreshInterval?: number; // in milliseconds, default 60000 (1 minute)
  onComplete?: () => void; // Callback after order is completed
}

export function OrderLifecycleTimer({ 
  order, 
  variant = 'detailed',
  refreshInterval = 60000,
  onComplete
}: OrderLifecycleTimerProps): JSX.Element | null {
  const [lifecycle, setLifecycle] = useState<OrderLifecycleStatus | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const { showAlert } = useAlert();

  // Update lifecycle status periodically
  useEffect(() => {
    const updateLifecycle = () => {
      const status = getOrderLifecycleStatus(order);
      setLifecycle(status);
    };

    // Initial update
    updateLifecycle();

    // Set up interval for live updates
    const interval = setInterval(updateLifecycle, refreshInterval);

    return () => clearInterval(interval);
  }, [order, refreshInterval]);

  // Don't show anything if order is not paid or lifecycle can't be calculated
  if (!lifecycle) {
    return null;
  }

  const colors = getLifecycleColorClasses(lifecycle.statusColor);
  const icon = getLifecycleIcon(lifecycle.stage);

  const handleMarkComplete = () => {
    showAlert({
      title: '✅ Mark Order Complete?',
      message: `Manually complete Order #${displayOrderNumber(order)}?\n\n✓ Order will be marked as complete\n✓ Weekly invoice will be generated\n✓ Customer will receive notification\n✓ Invoice modal shown on customer login\n✓ Order moves to Complete Orders\n✓ Lifecycle timer stops\n\nThis action cannot be undone.`,
      icon: 'info',
      confirmText: 'MARK COMPLETE',
      cancelText: 'CANCEL',
      onConfirm: async () => {
        setIsCompleting(true);
        
        try {
          // ✅ Use unified service (Phase 2 refactor)
          const result = await completeOrderNow(order, {
            actor: 'admin-manual', // Manual completion via lifecycle timer
          });

          if (result.success) {
            showAlert({
              title: '✅ Order Completed!',
              message: `Order #${displayOrderNumber(order)} has been marked as complete.\n\nInvoice created and order locked.\n\n✅ Customer notification sent.\n\nThe order has been moved to History.`,
              icon: 'success',
            });

            // Call the onComplete callback if provided
            if (onComplete) {
              onComplete();
            }
          } else {
            throw new Error(result.error || 'Unknown error');
          }
        } catch (error) {
          showAlert({
            title: 'Error',
            message: `Failed to complete order: ${(error as any).message}`,
            icon: 'error',
          });
        } finally {
          setIsCompleting(false);
        }
      }
    });
  };

  const handleCopyOrderId = () => {
    const fallbackCopy = (text: string): boolean => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        console.error('Fallback copy failed:', err);
        document.body.removeChild(textArea);
        return false;
      }
    };

    // Try modern Clipboard API first, fall back to execCommand
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(displayOrderNumber(order))
        .then(() => {
          toast.success('Order ID copied!', {
            duration: 2000,
            position: 'top-center',
          });
        })
        .catch(() => {
          // If Clipboard API fails, try fallback
          const success = fallbackCopy(order.id);
          if (success) {
            toast.success('Order ID copied!', {
              duration: 2000,
              position: 'top-center',
            });
          } else {
            toast.error('Failed to copy', {
              duration: 2000,
              position: 'top-center',
            });
          }
        });
    } else {
      // Clipboard API not available, use fallback directly
      const success = fallbackCopy(order.id);
      if (success) {
        toast.success('Order ID copied!', {
          duration: 2000,
          position: 'top-center',
        });
      } else {
        toast.error('Failed to copy', {
          duration: 2000,
          position: 'top-center',
        });
      }
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colors.bg} ${colors.border}`}>
        <span className="text-lg">{icon}</span>
        <div className="flex flex-col">
          <span className={`text-xs font-bold ${colors.text} uppercase tracking-wide`}>
            {lifecycle.statusText}
          </span>
          <span className={`text-xs ${colors.text} font-medium`}>
            {formatLifecycleCountdown(lifecycle)}
          </span>
        </div>
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-2.5 space-y-2`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{icon}</span>
          <div className="space-y-0.5">
            <h4 className={`font-bold text-xs ${colors.text} uppercase tracking-wide`}>
              {lifecycle.statusText}
            </h4>
            {/* Order ID with Copy Icon */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-gray-600">
                {displayOrderNumber(order)}
              </span>
              <button
                onClick={handleCopyOrderId}
                className="p-0.5 hover:bg-black/5 rounded transition-colors group"
                title="Copy Order ID"
                aria-label="Copy Order ID"
              >
                <Copy className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </button>
            </div>
          </div>
        </div>
        
        {lifecycle.canAutoComplete && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-red-100 border border-red-300 rounded-full">
            <AlertCircle className="w-3 h-3 text-red-600" />
            <span className="text-[10px] font-bold text-red-600 uppercase">In Process</span>
          </div>
        )}
      </div>

      {/* Countdown */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 p-2 bg-white/60 rounded">
          <Clock className={`w-3.5 h-3.5 ${colors.text}`} />
          <div className="flex-1">
            <p className={`text-xs font-bold ${colors.text}`}>
              {formatLifecycleCountdown(lifecycle)}
            </p>
            <p className={`text-[10px] ${colors.text} opacity-75`}>
              Until you receive your weekly invoice
            </p>
          </div>
        </div>

        {/* Mark Complete Button */}
        <button
          onClick={handleMarkComplete}
          disabled={isCompleting}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#4CAF50] to-[#388E3C] hover:from-[#388E3C] hover:to-[#2E7D32] text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-green-600/30 shadow-sm"
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span className="text-xs font-bold uppercase tracking-wide">
            {isCompleting ? 'Completing...' : 'Mark Complete'}
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * Compact badge version for order lists
 */
export function OrderLifecycleBadge({ order }: { order: Order }): JSX.Element | null {
  const [lifecycle, setLifecycle] = useState<OrderLifecycleStatus | null>(null);

  useEffect(() => {
    const updateLifecycle = () => {
      const status = getOrderLifecycleStatus(order);
      setLifecycle(status);
    };

    updateLifecycle();
    const interval = setInterval(updateLifecycle, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [order]);

  if (!lifecycle) {
    return null;
  }

  const colors = getLifecycleColorClasses(lifecycle.statusColor);
  const icon = getLifecycleIcon(lifecycle.stage);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${colors.bg} ${colors.border}`}>
      <span className="text-sm">{icon}</span>
      <span className={`text-xs font-bold ${colors.text} uppercase tracking-wide`}>
        {formatLifecycleCountdown(lifecycle)}
      </span>
    </div>
  );
}