/**
 * 🔍 SearchBar Component - Unified Search Input
 * 
 * ✅ MARCH 9, 2026: Created as part of search bar consolidation project
 * 
 * PURPOSE:
 * - Single reusable search bar component for entire app
 * - Consistent styling, behavior, and accessibility
 * - Replaces 5+ inline search implementations
 * 
 * FEATURES:
 * - 🎨 Two variants: 'standard' and 'luxury' (gold accents)
 * - 🔍 Search icon on left
 * - ❌ Optional clear button
 * - ⌨️ Optional autofocus
 * - 📱 Fully responsive
 * - ♿ Accessible with ARIA labels
 * 
 * USAGE:
 * ```tsx
 * <SearchBar
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   placeholder="Search by name, email, or ID..."
 *   variant="luxury"
 *   showClearButton
 *   autoFocus
 * />
 * ```
 */

import { Search, X } from 'lucide-react';

export interface SearchBarProps {
  /** Current search value */
  value: string;
  
  /** Called when search value changes */
  onChange: (value: string) => void;
  
  /** Placeholder text */
  placeholder?: string;
  
  /** Show clear button when value exists */
  showClearButton?: boolean;
  
  /** Style variant */
  variant?: 'standard' | 'luxury';
  
  /** Auto-focus on mount */
  autoFocus?: boolean;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Disable the input */
  disabled?: boolean;
  
  /** ARIA label for accessibility */
  ariaLabel?: string;
  
  /** Input ID */
  id?: string;
}

/**
 * Unified search bar component
 * 
 * @example Standard variant
 * ```tsx
 * <SearchBar
 *   value={query}
 *   onChange={setQuery}
 *   placeholder="Search..."
 * />
 * ```
 * 
 * @example Luxury variant with gold accents
 * ```tsx
 * <SearchBar
 *   value={query}
 *   onChange={setQuery}
 *   placeholder="Search customers..."
 *   variant="luxury"
 *   showClearButton
 * />
 * ```
 */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  showClearButton = true,
  variant = 'standard',
  autoFocus = false,
  className = '',
  disabled = false,
  ariaLabel,
  id,
}: SearchBarProps): JSX.Element | null {
  
  const handleClear = () => {
    onChange('');
  };
  
  // Variant-specific styling
  const iconColor = variant === 'luxury' 
    ? 'text-[#D4A574]' 
    : 'text-gray-400';
  
  const inputStyles = variant === 'luxury'
    ? 'border-2 border-[#D4A574]/30 focus:border-[#D4A574]'
    : 'border border-gray-300 focus:ring-2 focus:ring-[#D4A574] focus:border-transparent';
  
  const clearButtonColor = variant === 'luxury'
    ? 'text-[#D4A574] hover:text-[#8B6F47]'
    : 'text-gray-400 hover:text-gray-600';
  
  return (
    <div className={`relative ${className}`}>
      {/* Search Icon */}
      <Search 
        className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${iconColor} ${disabled ? 'opacity-50' : ''}`}
        aria-hidden="true"
      />
      
      {/* Input Field */}
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        className={`
          w-full pl-10 pr-${showClearButton && value ? '10' : '4'} py-2.5
          ${inputStyles}
          rounded-lg
          focus:outline-none
          text-sm
          placeholder:text-xs sm:placeholder:text-sm
          placeholder-gray-400
          disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60
          transition-colors
        `}
      />
      
      {/* Clear Button */}
      {showClearButton && value && !disabled && (
        <button
          onClick={handleClear}
          className={`absolute right-3 top-1/2 -translate-y-1/2 ${clearButtonColor} transition-colors`}
          aria-label="Clear search"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

/**
 * Compact variant for tight spaces (smaller padding and icon)
 */
export function SearchBarCompact({
  value,
  onChange,
  placeholder = 'Search...',
  showClearButton = true,
  variant = 'standard',
  className = '',
  ...props
}: SearchBarProps): JSX.Element | null {
  const iconColor = variant === 'luxury' 
    ? 'text-[#D4A574]' 
    : 'text-gray-400';
  
  const inputStyles = variant === 'luxury'
    ? 'border-2 border-[#D4A574]/30 focus:border-[#D4A574]'
    : 'border border-gray-300 focus:ring-2 focus:ring-[#D4A574] focus:border-transparent';
  
  return (
    <div className={`relative ${className}`}>
      <Search 
        className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 ${iconColor}`}
        aria-hidden="true"
      />
      
      <input
        type="text"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`
          w-full pl-8 pr-${showClearButton && value ? '8' : '3'} py-1.5
          ${inputStyles}
          rounded-lg
          focus:outline-none
          text-xs
          placeholder-gray-400
          transition-colors
        `}
        {...props}
      />
      
      {showClearButton && value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}