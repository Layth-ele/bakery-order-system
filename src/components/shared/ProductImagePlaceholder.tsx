/**
 * ProductImagePlaceholder
 * Branded SVG placeholder shown when a product has no image.
 * Matches the Delight Bakehouse tan/gold palette.
 */

interface ProductImagePlaceholderProps {
  className?: string;
  /** Size variant controls the icon/text proportions */
  size?: 'sm' | 'md' | 'lg';
}

export function ProductImagePlaceholder({
  className = '',
  size = 'md',
}: ProductImagePlaceholderProps): JSX.Element {
  const iconSize = size === 'sm' ? 16 : size === 'md' ? 24 : 36;
  return (
    <div
      className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#faf5ee] to-[#ede5d8] border-2 border-dashed border-[#D4A574]/40 rounded-xl select-none ${className}`}
      aria-label="No product image"
      role="img"
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mb-1 opacity-60"
      >
        {/* Croissant / bakery icon outline */}
        <circle cx="24" cy="24" r="20" stroke="#D4A574" strokeWidth="2" />
        {/* Simple bread loaf shape */}
        <path
          d="M12 30 Q12 18 24 18 Q36 18 36 30 Q36 33 33 33 H15 Q12 33 12 30Z"
          fill="#D4A574"
          fillOpacity="0.25"
          stroke="#D4A574"
          strokeWidth="1.5"
        />
        {/* Scoring lines */}
        <path d="M20 20 Q24 16 28 20" stroke="#D4A574" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M18 24 Q24 20 30 24" stroke="#D4A574" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6" />
      </svg>
      {size !== 'sm' && (
        <span className="text-[#D4A574]/70 font-medium" style={{ fontSize: size === 'lg' ? '11px' : '9px' }}>
          No photo
        </span>
      )}
    </div>
  );
}
