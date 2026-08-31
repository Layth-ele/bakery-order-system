/**
 * Order UI Utilities
 * 
 * Button styles and UI-related formatting for orders
 */

import type { ActionButton } from '../components/order/UnifiedOrderList';

/**
 * Get Tailwind classes for action button variants
 */
export function getButtonStyles(variant: ActionButton['variant']): string {
  const baseStyles = 'flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors text-xs font-semibold shadow-md uppercase';
  
  switch (variant) {
    case 'view':
      return `${baseStyles} bg-[#E8C4A2] text-[#333333] hover:bg-[#D4A574] hover:text-white`;
    case 'download':
      return `${baseStyles} bg-[#FF9800] text-white hover:bg-[#F57C00]`;
    case 'upload':
      return `${baseStyles} bg-[#9C27B0] text-white hover:bg-[#7B1FA2]`;
    case 'approve':
      return `${baseStyles} bg-[#4CAF50] text-white hover:bg-[#45A049] flex-1 max-w-[200px] justify-center px-4`;
    case 'reject':
      return `${baseStyles} bg-[#F44336] text-white hover:bg-[#D32F2F] flex-1 max-w-[200px] justify-center px-4`;
    case 'cancel':
      return `${baseStyles} bg-[#F44336] text-white hover:bg-[#D32F2F] flex-1 max-w-[200px] justify-center px-4`;
    case 'complete':
      return `${baseStyles} bg-[#2196F3] text-white hover:bg-[#1976D2] flex-1 max-w-[200px] justify-center px-4`;
    case 'primary':
      return `${baseStyles} bg-[#2196F3] text-white hover:bg-[#1976D2]`;
    case 'secondary':
      return `${baseStyles} bg-[#9E9E9E] text-white hover:bg-[#757575]`;
    case 'danger':
      return `${baseStyles} bg-[#F44336] text-white hover:bg-[#D32F2F]`;
    case 'edit':
      return `${baseStyles} bg-[#FF9800] text-white hover:bg-[#F57C00]`;
    case 'pending':
      return `${baseStyles} bg-gradient-to-r from-[#FFC107] to-[#FF9800] text-white hover:from-[#FFB300] hover:to-[#F57C00] animate-pulse`;
    default:
      return baseStyles;
  }
}
