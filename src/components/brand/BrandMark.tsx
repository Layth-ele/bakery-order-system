/**
 * The business logo for the app headers (from Admin → System Settings);
 * falls back to the generic package icon until a logo is uploaded.
 */
import { Package } from 'lucide-react';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';

export function BrandMark() {
  const { businessSettings } = useBusinessSettings();
  if (!businessSettings.logoUrl) {
    return <Package className="w-6 h-6 md:w-8 md:h-8 text-[#e8dcc8]" aria-hidden="true" />;
  }
  return (
    <img
      src={businessSettings.logoUrl}
      alt={businessSettings.businessName || 'Logo'}
      className="h-7 w-7 md:h-9 md:w-9 rounded-md object-contain"
    />
  );
}
