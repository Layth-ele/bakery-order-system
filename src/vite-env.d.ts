/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

// Google Maps Places API types (loaded dynamically via script tag)
declare namespace google {
  namespace maps {
    namespace places {
      class Autocomplete {
        constructor(input: HTMLInputElement, opts?: AutocompleteOptions);
        addListener(event: string, handler: () => void): void;
        getPlace(): PlaceResult;
      }
      interface AutocompleteOptions {
        types?: string[];
        componentRestrictions?: { country: string | string[] };
        fields?: string[];
      }
      interface PlaceResult {
        formatted_address?: string;
        address_components?: AddressComponent[];
        geometry?: { location: { lat(): number; lng(): number } };
      }
      interface AddressComponent {
        long_name: string;
        short_name: string;
        types: string[];
      }
    }
  }
}
