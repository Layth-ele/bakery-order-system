/**
 * Paid order lifecycle — the countdown shown on paid orders.
 *
 * Display only: completion itself runs on the server (completeOrder callable
 * and the Friday autoCompleteOrders schedule). The due time comes from the
 * shared rule in src/functions/src/lib/orderCompletion.ts, so the timer and
 * the scheduler always agree.
 */

import { Order } from '../types';
import { toDate } from '../utils/timestampFormatting';
import { getNowInVancouver } from '../utils/timezone';
import { deliveryWeekCloseAt } from '../functions/src/lib/orderCompletion';
import { logger } from '../utils/logger';
 // ✅ MAR 17: Use data service

const DEBUG = false;

/**
 * Order Lifecycle Status
 */
export interface OrderLifecycleStatus {
  stage: 'preparing' | 'delivering' | 'completed' | 'overdue';
  daysUntilCompletion: number;
  hoursUntilCompletion: number;
  minutesUntilCompletion: number;
  progressPercentage: number;
  statusText: string;
  statusColor: 'blue' | 'green' | 'yellow' | 'red';
  canAutoComplete: boolean;
  deliveryEndDate: Date;
  completionMessage: string;
}

/**
 * Calculate the lifecycle status of a paid order
 */
export function getOrderLifecycleStatus(order: Order): OrderLifecycleStatus | null {
  // Only applies to paid orders that haven't been completed yet
  if (!order.paymentReceived || order.status === 'completed') {
    return null;
  }

  // Calculate delivery end date: Next Friday at 12:00 PM Vancouver time
  // Friday 12:00 Vancouver of the order's delivery week — the same rule the
  // server's weekly autoCompleteOrders uses (shared lib/orderCompletion.ts).
  const deliveryEndDate = deliveryWeekCloseAt(order.year, order.week);
  
  if (!deliveryEndDate) {
    if (DEBUG) logger.warn('⚠️ Could not calculate delivery end date for order:', order.id);
    return null;
  }

  const now = getNowInVancouver();
  const timeUntilCompletion = deliveryEndDate.getTime() - now.getTime();
  
  // Calculate time components
  const daysUntilCompletion = Math.floor(timeUntilCompletion / (1000 * 60 * 60 * 24));
  const hoursUntilCompletion = Math.floor((timeUntilCompletion % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesUntilCompletion = Math.floor((timeUntilCompletion % (1000 * 60 * 60)) / (1000 * 60));

  // Determine stage
  let stage: OrderLifecycleStatus['stage'];
  let completionMessage: string;
  
  // Calculate progress percentage (0-100%)
  // Assume a typical order lifecycle is 7 days
  const paymentDate = toDate(order.paymentReceivedAt) ?? toDate(order.approvedAt) ?? toDate(order.createdAt) ?? new Date();
  const totalDuration = deliveryEndDate.getTime() - paymentDate.getTime();
  const elapsed = now.getTime() - paymentDate.getTime();
  const progressPercentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  if (timeUntilCompletion < 0) {
    // Delivery week has ended - ready to complete
    stage = 'overdue';
    completionMessage = `Delivery week ended ${Math.abs(daysUntilCompletion)} days ago. Ready to finalize and generate invoice.`;
  } else if (daysUntilCompletion === 0) {
    // Last day of delivery
    stage = 'delivering';
    completionMessage = `Order completes today at ${deliveryEndDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (daysUntilCompletion <= 2) {
    // Actively delivering
    stage = 'delivering';
    completionMessage = `Delivery week ends in ${daysUntilCompletion} ${daysUntilCompletion === 1 ? 'day' : 'days'}`;
  } else {
    // Still in preparation/early delivery
    stage = 'preparing';
    completionMessage = `Order completes in ${daysUntilCompletion} ${daysUntilCompletion === 1 ? 'day' : 'days'}`;
  }

  // Determine status and color based on time remaining
  let statusText: string;
  let statusColor: 'blue' | 'green' | 'yellow' | 'red';
  const canAutoComplete = timeUntilCompletion < 0;

  if (canAutoComplete) {
    statusText = 'In Process to Complete';
    statusColor = 'red';
  } else if (daysUntilCompletion <= 1) {
    statusText = 'Processing Week - Final Day';
    statusColor = 'red';
  } else if (daysUntilCompletion <= 2) {
    statusText = 'Processing Week - Ending Soon';
    statusColor = 'yellow';
  } else if (daysUntilCompletion <= 4) {
    statusText = 'Processing Week - In Progress';
    statusColor = 'green';
  } else {
    statusText = 'Processing Week - Just Started';
    statusColor = 'blue';
  }

  return {
    stage,
    daysUntilCompletion,
    hoursUntilCompletion,
    minutesUntilCompletion,
    progressPercentage,
    statusText,
    statusColor,
    canAutoComplete,
    deliveryEndDate,
    completionMessage
  };
}

/**
 * Format lifecycle countdown for display
 */
export function formatLifecycleCountdown(lifecycle: OrderLifecycleStatus): string {
  const { daysUntilCompletion, hoursUntilCompletion, minutesUntilCompletion } = lifecycle;

  if (daysUntilCompletion < 0) {
    return `Overdue by ${Math.abs(daysUntilCompletion)} ${Math.abs(daysUntilCompletion) === 1 ? 'day' : 'days'}`;
  }

  if (daysUntilCompletion === 0) {
    if (hoursUntilCompletion === 0) {
      return `${minutesUntilCompletion}m remaining`;
    }
    return `${hoursUntilCompletion}h ${minutesUntilCompletion}m remaining`;
  }

  if (daysUntilCompletion === 1) {
    return `1 day ${hoursUntilCompletion}h remaining`;
  }

  return `${daysUntilCompletion} days remaining`;
}

/**
 * Get color classes for lifecycle stage
 */
export function getLifecycleColorClasses(color: OrderLifecycleStatus['statusColor']): {
  bg: string;
  text: string;
  border: string;
} {
  switch (color) {
    case 'blue':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-300'
      };
    case 'green':
      return {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-300'
      };
    case 'yellow':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-300'
      };
    case 'red':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-300'
      };
  }
}

/**
 * Get emoji icon for lifecycle stage
 */
export function getLifecycleIcon(stage: OrderLifecycleStatus['stage']): string {
  switch (stage) {
    case 'preparing':
      return '🔨'; // In production
    case 'delivering':
      return '🚚'; // Active delivery
    case 'completed':
      return '✅'; // Completed
    case 'overdue':
      return '⏰'; // Ready to finalize
  }
}