/**
 * 🔄 PAID ORDER LIFECYCLE SERVICE
 * 
 * - checkAndCompleteExpiredOrders() now uses getOrders() from data service
 * - completeOrder() now uses getOrder() from data service
 */

import { Order } from '../types';
import { toDate } from '../utils/timestampFormatting';
import { getNowInVancouver } from '../utils/timezone';
import { completeOrderNow } from './orderCompletion/completeOrderNow';
import { getOrders, getOrder } from './data/ordersDataService';
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
  const deliveryEndDate = getNextFridayNoonVancouver(order);
  
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
 * Calculate the next Friday at 12:00 PM Vancouver time
 * ✅ Uses getNowInVancouver() — canonical Vancouver time source
 */
function getNextFridayNoonVancouver(_order: Order): Date | null {
  try {
    const now = getNowInVancouver();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Vancouver',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hour12: false,
    }).formatToParts(now);
    const yr  = Number(parts.find(p => p.type === 'year')?.value);
    const mo  = Number(parts.find(p => p.type === 'month')?.value) - 1;
    const dy  = Number(parts.find(p => p.type === 'day')?.value);
    const hr  = Number(parts.find(p => p.type === 'hour')?.value);
    const dow = now.getDay(); // getDay() on Vancouver date object gives Vancouver day

    let daysUntilFriday = (5 - dow + 7) % 7;
    if (daysUntilFriday === 0 && hr >= 12) daysUntilFriday = 7; // past Friday noon

    // Build Vancouver-local Friday noon as a UTC Date
    const fridayLocal = new Date(yr, mo, dy + daysUntilFriday, 12, 0, 0, 0);
    const offset = now.getTimezoneOffset(); // device offset (minutes)
    const vancOffset = -420; // PDT = UTC-7; adjust to -480 in winter if needed
    return new Date(fridayLocal.getTime() + (offset - vancOffset) * 60000);
  } catch (error) {
    if (DEBUG) console.error('Error calculating Friday noon Vancouver:', error);
    return null;
  }
}

/**
 * Check all paid orders and auto-complete those whose delivery week has ended
 */
export async function checkAndCompleteExpiredOrders(): Promise<{
  completedCount: number;
  completedOrders: Order[];
  errors: string[];
}> {
  if (DEBUG) logger.log('🔄 [PaidOrderLifecycle] Checking for expired paid orders...');

  const errors: string[] = [];
  const completedOrders: Order[] = [];

  try {
    // ✅ PASS 4: Was `getOrders()` (unbounded fetch + client-side filter)
    // — now uses a status-filtered query so Firestore returns only the
    // active orders we actually iterate. Reduces billed reads from
    // O(all orders) to O(active orders), which is typically 10–50x smaller.
    const allOrders = await getOrders({
      status: ['pending', 'approved', 'in_process'],
      limit: 1000, // explicit ceiling — we don't expect 1000+ active orders
    });

    // Find paid orders that are ready to complete
    const paidOrders = allOrders.filter(
      (o: Order) => o.paymentReceived && o.status !== 'completed' && o.status !== 'cancelled'
    );

    if (DEBUG) logger.log(`📋 Found ${paidOrders.length} paid orders to check`);

    for (const order of paidOrders) {
      const lifecycle = getOrderLifecycleStatus(order);
      
      if (lifecycle && lifecycle.canAutoComplete) {
        if (DEBUG) logger.log(`✅ Order ${order.id} is ready to auto-complete`);
        
        try {
          const result = await completeOrder(order.id, 'system', true);
          
          if (result.success) {
            completedOrders.push(result.order!);
          } else {
            errors.push(`Failed to complete order ${order.id}: ${result.error}`);
          }
        } catch (error) {
          errors.push(`Error completing order ${order.id}: ${(error as any).message}`);
          if (DEBUG) console.error(`❌ Error completing order ${order.id}:`, error);
        }
      }
    }

    return {
      completedCount: completedOrders.length,
      completedOrders,
      errors
    };

  } catch (error) {
    const errorMsg = `Fatal error in checkAndCompleteExpiredOrders: ${(error as any).message}`;
    if (DEBUG) console.error('❌', errorMsg, error);
    return {
      completedCount: 0,
      completedOrders: [],
      errors: [errorMsg]
    };
  }
}

/**
 * ✅ REFACTORED: Feb 13, 2026 - Now delegates to completeOrderNow()
 * 
 * Complete a paid order (manual or automatic)
 * This is now a thin wrapper around the canonical completeOrderNow() service.
 */
export async function completeOrder(
  orderId: string,
  completedBy: string = 'system',
  isAutomatic: boolean = false
): Promise<{
  success: boolean;
  order?: Order;
  invoiceNumber?: string;
  error?: string;
}> {


  try {
    const order = await getOrder(orderId);

    if (!order) {
      return { success: false, error: `Order ${orderId} not found` };
    }

    // Validate order is paid
    if (!order.paymentReceived) {
      return { success: false, error: 'Order payment not confirmed' };
    }

    // ✅ DELEGATE to canonical completion service
    const result = await completeOrderNow(order, {
      actor: completedBy
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to complete order'
      };
    }

    // ✅ MAR 17: Re-fetch the completed order from data service
    const completedOrder = await getOrder(orderId);
    
    if (completedOrder) {


      return {
        success: true,
        order: completedOrder,
        invoiceNumber: result.invoiceId ? result.invoiceId : undefined
      };
    }
    return {
      success: true,
      invoiceNumber: result.invoiceId ? result.invoiceId : undefined
    };

  } catch (error) {
    const errorMsg = `Failed to complete order: ${(error as any).message}`;
    if (DEBUG) console.error('❌', errorMsg, error);
    return {
      success: false,
      error: errorMsg
    };
  }
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