/**
 * AddressAutocomplete — Google Places API powered address autocomplete
 * Requires VITE_GOOGLE_MAPS_API_KEY in .env
 *
 * - Full Canadian address support
 * - Structured address fields (street, city, province, postal code)
 * - Graceful fallback to plain text input if API key is missing
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
  darkMode?: boolean;
  disabled?: boolean;
  onValidationChange?: (valid: boolean) => void;
}

// Load the Google Maps Places script once
let scriptLoaded = false;
let scriptLoading = false;
const callbacks: Array<() => void> = [];

// Inject a one-time global style so the Google Places dropdown (.pac-container)
// appears above all modals (modal base z-index is 20000).
let pacStyleInjected = false;
function injectPacStyle() {
  if (pacStyleInjected) return;
  pacStyleInjected = true;
  const style = document.createElement('style');
  style.textContent = '.pac-container { z-index: 99999 !important; }';
  document.head.appendChild(style);
}

function loadGoogleMapsScript(cb: () => void) {
  if (!GOOGLE_API_KEY) { cb(); return; }
  if (scriptLoaded) { cb(); return; }
  callbacks.push(cb);
  if (scriptLoading) return;
  scriptLoading = true;
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&language=en&region=CA`;
  script.async = true;
  script.defer = true;
  script.setAttribute('loading', 'async');
  script.onload = () => {
    scriptLoaded = true;
    scriptLoading = false;
    callbacks.forEach(fn => fn());
    callbacks.length = 0;
  };
  script.onerror = () => { scriptLoading = false; };
  document.head.appendChild(script);
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onBlur,
  placeholder = 'Start typing your address...',
  className = '',
  label,
  required = false,
  darkMode = false,
  disabled = false,
  onValidationChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(scriptLoaded);
  const [isSelected, setIsSelected] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [loading, setLoading] = useState(!scriptLoaded && !!GOOGLE_API_KEY);

  // Initialise Google Place Autocomplete once script is ready
  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places) return;
    setLoading(false);
    setIsReady(true);

    // Ensure .pac-container (Google's dropdown) renders above all modals
    injectPacStyle();

    // Use SessionToken for better billing and caching.
    // Cast to `any`: AutocompleteSessionToken exists at runtime but is absent
    // from the current @types/google.maps typedefs for the Places library.
    const placesLib = window.google.maps.places as any;
    const sessionToken = new placesLib.AutocompleteSessionToken();

    // Create Autocomplete with latest options
    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ['address'],
        componentRestrictions: { country: 'ca' },
        fields: ['formatted_address', 'address_components', 'geometry'],
        sessionToken,
      } as google.maps.places.AutocompleteOptions
    );

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (!place?.formatted_address) return;
      onChange(place.formatted_address);
      setIsSelected(true);
      setAddressError('');
      onValidationChange?.(true);
    });
  }, [onChange, onValidationChange]);

  useEffect(() => {
    if (!GOOGLE_API_KEY) {
      setIsReady(true);
      setLoading(false);
      return;
    }
    loadGoogleMapsScript(() => initAutocomplete());
  }, [initAutocomplete]);

  // Re-init if input ref changes
  useEffect(() => {
    if (scriptLoaded && inputRef.current && !autocompleteRef.current) {
      initAutocomplete();
    }
  }, [initAutocomplete]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsSelected(false);
    setAddressError('');
    onValidationChange?.(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (value && !isSelected && GOOGLE_API_KEY) {
        setAddressError('Please select an address from the dropdown for accuracy.');
        onValidationChange?.(false);
      }
      onBlur?.();
    }, 200);
  };

  const baseInput = className || `w-full pl-10 pr-4 py-3 rounded-xl border bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition text-sm ${
    addressError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
      : isSelected
        ? 'border-green-400 focus:border-green-500 focus:ring-green-500/20'
        : 'border-gray-200 focus:border-[#D4A574] focus:ring-[#D4A574]/30'
  }`;

  return (
    <div className="relative w-full">
      {label && (
        <label className={`block mb-1.5 text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-700'}`}>
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Icon */}
        {loading ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#D4A574] animate-spin z-10 pointer-events-none" />
        ) : isSelected ? (
          <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500 z-10 pointer-events-none" />
        ) : (
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
        )}

        <input
          ref={inputRef}
          type="text"
          name="autocomplete_disable"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={() => { if (isSelected) { setIsSelected(false); } }}
          placeholder={placeholder}
          required={required}
          disabled={disabled || loading}
          autoComplete="new-password"
          className={baseInput}
        />
      </div>

      {/* Error */}
      {addressError && (
        <div className="flex items-start gap-1.5 mt-1.5 text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>{addressError}</span>
        </div>
      )}

      {/* Missing API key warning (dev only) */}
      {!GOOGLE_API_KEY && import.meta.env.DEV && (
        <p className="mt-1 text-[10px] text-amber-600">
          ⚠️ Add VITE_GOOGLE_MAPS_API_KEY to .env to enable Google address autocomplete
        </p>
      )}
    </div>
  );
};
