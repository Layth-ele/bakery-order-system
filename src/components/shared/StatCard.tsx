/**
 * StatCard - Shared Statistics Card Component
 * 
 * ✅ UPDATED: March 10, 2026 - Fixed sizing for consistency
 * 
 * CHANGES:
 * - Reduced icon size from icon-xl (32px) to icon-lg (24px)
 * - Reduced value size from stat-value (30px) to stat-value-sm (24px)
 * - Added responsive padding and spacing
 * - Ensured consistent sizing across all devices
 * 
 * ✅ CREATED: March 10, 2026 - Phase 1 Layout Consistency
 * 
 * PURPOSE:
 * - Reusable stats card component for both Admin and Customer dashboards
 * - Consistent styling, colors, and layout across all pages
 * - Uses design system typography and icon classes
 * 
 * FEATURES:
 * - 7 color variants (tan, blue, purple, red, green, orange, teal)
 * - Responsive design with hover effects
 * - Icon + label + value layout
 * - Gradient backgrounds matching bakery brand
 * - Perfect sizing on mobile and desktop
 * 
 * USAGE:
 * ```tsx
 * import { StatCard } from '@/components/shared/StatCard';
 * 
 * <StatCard
 *   icon={CreditCard}
 *   label="Unpaid Orders"
 *   value={25}
 *   color="red"
 * />
 * ```
 */

import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  /** Icon to display at the top of the card */
  icon: LucideIcon;
  
  /** Label text (e.g., "Total Orders") */
  label: string;
  
  /** Value to display (number or string) */
  value: string | number;
  
  /** Color theme for the card */
  color: 'tan' | 'blue' | 'purple' | 'red' | 'green' | 'orange' | 'teal';
  
  /** Optional onClick handler to make card clickable */
  onClick?: () => void;
  
  /** Whether the card is currently active/selected */
  isActive?: boolean;
}

/**
 * StatCard Component
 * 
 * Displays a statistics card with icon, label, and value.
 * Used across both Admin and Customer dashboards for consistency.
 * 
 * SIZING:
 * - Icon: icon-lg (24px desktop, 22px mobile)
 * - Value: stat-value-sm (24px desktop, 20px mobile)
 * - Label: body-sm (14px desktop, 13px mobile)
 * - Padding: p-4 (responsive)
 */
export function StatCard({ icon: Icon, label, value, color, onClick, isActive }: StatCardProps): JSX.Element | null {
  // ✅ Color style definitions matching bakery brand colors
  const colorStyles = {
    tan: {
      bg: 'from-white to-[#F5E6D3]',
      border: 'border-[#D4A574]/40',
      iconBg: 'bg-[#D4A574]/15',
      iconColor: 'text-[#8B6F47]',
      valueColor: 'text-[#8B6F47]',
    },
    blue: {
      bg: 'from-white to-[#E3F2FD]',
      border: 'border-[#2196F3]/40',
      iconBg: 'bg-[#2196F3]/15',
      iconColor: 'text-[#1976D2]',
      valueColor: 'text-[#1976D2]',
    },
    purple: {
      bg: 'from-white to-[#F3E5F5]',
      border: 'border-[#9C27B0]/40',
      iconBg: 'bg-[#9C27B0]/15',
      iconColor: 'text-[#7B1FA2]',
      valueColor: 'text-[#7B1FA2]',
    },
    red: {
      bg: 'from-white to-[#FFEBEE]',
      border: 'border-[#F44336]/40',
      iconBg: 'bg-[#F44336]/15',
      iconColor: 'text-[#D32F2F]',
      valueColor: 'text-[#D32F2F]',
    },
    green: {
      bg: 'from-white to-[#E8F5E9]',
      border: 'border-[#4CAF50]/40',
      iconBg: 'bg-[#4CAF50]/15',
      iconColor: 'text-[#388E3C]',
      valueColor: 'text-[#388E3C]',
    },
    orange: {
      bg: 'from-white to-[#FFF3E0]',
      border: 'border-[#FF9800]/40',
      iconBg: 'bg-[#FF9800]/15',
      iconColor: 'text-[#F57C00]',
      valueColor: 'text-[#F57C00]',
    },
    teal: {
      bg: 'from-white to-[#E0F2F1]',
      border: 'border-[#009688]/40',
      iconBg: 'bg-[#009688]/15',
      iconColor: 'text-[#00796B]',
      valueColor: 'text-[#00796B]',
    },
  };

  const style = colorStyles[color];

  return (
    <div
      className={`bg-gradient-to-br ${style.bg} rounded-xl border-2 ${isActive ? 'border-[#D4A574] ring-2 ring-[#D4A574]/30 shadow-lg' : style.border + ' shadow-sm'} hover:shadow-md transition-all flex flex-col items-center text-center p-2.5 sm:p-4 ${onClick ? 'cursor-pointer active:scale-95 hover:scale-[1.02]' : ''}`}
      onClick={onClick}
    >
      {/* Icon — tighter on mobile */}
      <div className={`p-1.5 sm:p-2.5 ${style.iconBg} rounded-lg sm:rounded-xl mb-1.5 sm:mb-2.5`}>
        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${style.iconColor}`} />
      </div>

      {/* Label */}
      <div className="text-[10px] sm:text-xs text-neutral-600 font-medium mb-0.5 sm:mb-1.5 leading-tight">
        {label}
      </div>

      {/* Value */}
      <div className={`text-lg sm:text-2xl font-bold leading-none ${style.valueColor}`}>
        {value}
      </div>
    </div>
  );
}