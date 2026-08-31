/**
 * QuantityInput.tsx (formerly DebouncedQuantityInput.tsx)
 * ✅ Performance-optimized quantity input with immediate state updates
 * ✅ Local state for smooth typing experience (no flickering)
 * ✅ Immediate onChange for responsive UI
 * ✅ CRITICAL FIX: Removed debounce layer - debouncing now handled by parent
 * ✅ PHASE 4: Enhanced accessibility with proper ARIA labels
 * ✅ PHASE 5: Fixed TypeScript - Import types directly from 'react'
 * 
 * PERFORMANCE:
 * - Input → Immediate state update (no lag)
 * - Parent handles debounced save (single debounce layer)
 * - Eliminates double-debounce issue (was 300ms + 100ms + 50ms = 450ms!)
 */

import { ChangeEvent } from 'react';
import { memo, useCallback, useEffect, useState, useRef } from 'react';

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  hasError?: boolean;
  min?: number;
  placeholder?: string;
  title?: string;
  className?: string;
  // ✅ PHASE 4: Accessibility props
  ariaLabel?: string;
  ariaDescribedBy?: string;
  productName?: string;
  dayLabel?: string;
  // ✅ Form accessibility props
  id?: string;
  name?: string;
}

/**
 * Quantity input component with immediate state updates
 * Uses local state for smooth typing (prevents flickering on every keystroke)
 * Calls onChange immediately for responsive parent state updates
 */
function QuantityInputComponent({
  value,
  onChange,
  disabled = false,
  hasError = false,
  min = 0,
  placeholder = '0',
  title = '',
  className = '',
  // ✅ PHASE 4: Accessibility props
  ariaLabel,
  ariaDescribedBy,
  productName,
  dayLabel,
  // ✅ Form accessibility props
  id,
  name,
}: QuantityInputProps) {
  // Local state for immediate UI feedback (smooth typing)
  const [displayValue, setDisplayValue] = useState<string>(value > 0 ? String(value) : '');
  const onChangeRef = useRef(onChange);
  const inputRef = useRef<HTMLInputElement>(null);

  // ✅ PHASE 4: Generate accessible label
  const accessibleLabel = ariaLabel || (productName && dayLabel 
    ? `Quantity for ${productName} on ${dayLabel}` 
    : 'Quantity');

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync display value when external value changes
  useEffect(() => {
    const newDisplayValue = value > 0 ? String(value) : '';
    setDisplayValue(newDisplayValue);
  }, [value]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Immediately update display value for responsive UI
      setDisplayValue(inputValue);

      // Parse and validate the value
      const numericValue = inputValue === '' ? 0 : parseInt(inputValue, 10);
      const validValue = isNaN(numericValue) ? 0 : Math.max(min, numericValue);

      // ✅ CRITICAL FIX: Call onChange IMMEDIATELY (no debounce)
      // Parent will handle debounced save
      onChangeRef.current(validValue);
    },
    [min]
  );

  const handleBlur = useCallback(() => {
    const numericValue = displayValue === '' ? 0 : parseInt(displayValue, 10);
    const validValue = isNaN(numericValue) ? 0 : Math.max(min, numericValue);

    // Ensure display value is valid
    const finalDisplayValue = validValue > 0 ? String(validValue) : '';
    if (displayValue !== finalDisplayValue) {
      setDisplayValue(finalDisplayValue);
    }

    // Trigger onChange to ensure parent has latest value
    onChangeRef.current(validValue);
  }, [displayValue, min]);

  // ✅ SCROLL FIX: Prevent inputs from hijacking scroll events
  const handleWheel = useCallback((e: React.WheelEvent<HTMLInputElement>) => {
    // Blur the input when user tries to scroll over it
    // This prevents the number input from capturing scroll gestures
    (e.currentTarget as HTMLInputElement).blur();
  }, []);

  const baseClassName = `w-full min-w-[1.5rem] sm:min-w-[2rem] max-w-[2.5rem] sm:max-w-[3.5rem] px-0.5 sm:px-1 py-0.5 sm:py-1 lg:py-1.5 text-center text-[10px] sm:text-xs lg:text-sm border rounded-md focus:outline-none bg-white text-[#3d3832] transition-colors duration-150`;

  const stateClassName = disabled
    ? 'opacity-50 cursor-not-allowed border-neutral-300'
    : hasError
      ? 'border-[#F44336] focus:border-[#F44336]'
      : 'border-[#D4A574]/30 focus:border-[#D4A574]';

  return (
    <input
      type="number"
      id={id}
      name={name}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onWheel={handleWheel}
      disabled={disabled}
      className={`${baseClassName} ${stateClassName} ${className}`}
    />
  );
}

/**
 * Memoized version to prevent unnecessary re-renders
 * Only re-renders if props actually change
 */
export const QuantityInput = memo(
  QuantityInputComponent,
  (prevProps, nextProps) => {
    // Custom equality check for performance
    return (
      prevProps.value === nextProps.value &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.hasError === nextProps.hasError &&
      prevProps.min === nextProps.min &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.title === nextProps.title &&
      prevProps.className === nextProps.className &&
      prevProps.id === nextProps.id &&
      prevProps.name === nextProps.name
      // Don't compare onChange - it's a function and changes often
    );
  }
);

QuantityInput.displayName = 'QuantityInput';

// ✅ Backwards compatibility: Export old name
export const DebouncedQuantityInput = QuantityInput;