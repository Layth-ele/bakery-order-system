import React from "react";
import { CheckCircle, XCircle, Clock, Ban } from 'lucide-react';

interface OrderStatusBadgeProps {
  status: string;
}

/**
 * Get status icon based on order status
 */
function getStatusIcon(status: string) {
  switch (status) {
    case 'approved':
      return <CheckCircle className="w-5 h-5 text-[#4CAF50]" />;
    case 'rejected':
      return <XCircle className="w-5 h-5 text-[#F44336]" />;
    case 'cancelled':
    case 'canceled':
      return <Ban className="w-5 h-5 text-[#FF5722]" />;
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-[#2196F3]" />;
    case 'pending':
      return <Clock className="w-5 h-5 text-[#FF9800]" />;
    default:
      return null;
  }
}

/**
 * Get status background color
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-[#4CAF50] text-white';
    case 'rejected':
      return 'bg-[#F44336] text-white';
    case 'cancelled':
    case 'canceled':
      return 'bg-[#FF5722] text-white';
    case 'completed':
      return 'bg-[#2196F3] text-white';
    case 'pending':
      return 'bg-[#FF9800] text-white';
    default:
      return 'bg-gray-200 text-gray-700';
  }
}

/**
 * Get user-friendly status label
 */
function getStatusLabel(status: string): string {
  // Safety check for undefined/null status
  if (!status) {
    return 'Unknown';
  }
  if (status === 'completed') {
    return 'Paid';
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * OrderStatusBadge - Displays order status with icon and styling
 * 
 * Features:
 * - Dynamic color based on status
 * - Icon representation
 * - User-friendly labels
 * - Prominent display
 */
export function OrderStatusBadge({ status }: OrderStatusBadgeProps): JSX.Element | null {
  return (
    <div className={`px-4 py-3 rounded-lg flex items-center justify-center gap-2 ${getStatusColor(status)}`}>
      {getStatusIcon(status)}
      <strong className="text-lg uppercase tracking-wide">
        Status: {getStatusLabel(status)}
      </strong>
    </div>
  );
}

/**
 * Export utility functions for use in other components
 */
export { getStatusIcon, getStatusColor, getStatusLabel };