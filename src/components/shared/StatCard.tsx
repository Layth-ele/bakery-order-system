/**
 * Shared statistics card used across the admin and customer dashboards.
 * This is the single source of truth for summary-card sizing, spacing, and color.
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
  color: 'tan' | 'blue' | 'purple' | 'red' | 'green' | 'orange' | 'teal' | 'amber';
  
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
      bg: 'bg-[#f5efe7]',
      border: 'border-[#D4A574]',
      iconBg: 'bg-[#f0e0c8]',
      iconColor: 'text-[#8B6F47]',
      valueColor: 'text-[#8B6F47]',
    },
    blue: {
      bg: 'bg-[#edf5fb]',
      border: 'border-[#7BB6E8]',
      iconBg: 'bg-[#dfeef9]',
      iconColor: 'text-[#2E7AC7]',
      valueColor: 'text-[#2E7AC7]',
    },
    purple: {
      bg: 'bg-[#f5f0fb]',
      border: 'border-[#B08CC9]',
      iconBg: 'bg-[#eadcf8]',
      iconColor: 'text-[#7E57C2]',
      valueColor: 'text-[#7E57C2]',
    },
    red: {
      bg: 'bg-[#fdf0f0]',
      border: 'border-[#E58A8A]',
      iconBg: 'bg-[#f9d9d9]',
      iconColor: 'text-[#D64545]',
      valueColor: 'text-[#D64545]',
    },
    green: {
      bg: 'bg-[#edf8ee]',
      border: 'border-[#8CCB93]',
      iconBg: 'bg-[#d9efdd]',
      iconColor: 'text-[#3E9C57]',
      valueColor: 'text-[#3E9C57]',
    },
    orange: {
      bg: 'bg-[#fff5eb]',
      border: 'border-[#E6AA6A]',
      iconBg: 'bg-[#f9e3c8]',
      iconColor: 'text-[#DA7A1A]',
      valueColor: 'text-[#DA7A1A]',
    },
    amber: {
      bg: 'bg-[#fff4e6]',
      border: 'border-[#D9A15C]',
      iconBg: 'bg-[#f4deba]',
      iconColor: 'text-[#C0771F]',
      valueColor: 'text-[#C0771F]',
    },
    teal: {
      bg: 'bg-[#edf9f7]',
      border: 'border-[#8BCFC6]',
      iconBg: 'bg-[#d8f0ee]',
      iconColor: 'text-[#0F8A7A]',
      valueColor: 'text-[#0F8A7A]',
    },
  };

  const style = colorStyles[color];

  return (
    <div
      className={`w-full h-full min-h-[172px] sm:min-h-[182px] ${style.bg} rounded-2xl border-2 ${isActive ? 'border-[#D4A574] ring-2 ring-[#D4A574]/25 shadow-lg' : `${style.border} shadow-sm`} hover:shadow-md transition-all flex flex-col items-center justify-center text-center p-3 sm:p-4 ${onClick ? 'cursor-pointer active:scale-[0.99] hover:scale-[1.01]' : ''}`}
      onClick={onClick}
    >
      <div className={`p-2.5 sm:p-3 ${style.iconBg} rounded-xl mb-3 sm:mb-4 shadow-inner`}>
        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${style.iconColor}`} />
      </div>

      <div className="text-[11px] sm:text-sm text-neutral-700 font-medium mb-1 leading-tight">
        {label}
      </div>

      <div className={`text-2xl sm:text-3xl font-bold leading-none ${style.valueColor}`}>
        {value}
      </div>
    </div>
  );
}