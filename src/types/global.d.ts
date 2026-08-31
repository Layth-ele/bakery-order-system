/**
 * Global Type Definitions
 * Extends the Window interface with third-party analytics tools
 */

declare global {
  interface Window {
    /**
     * Google Analytics (gtag.js)
     * Documentation: https://developers.google.com/analytics/devguides/collection/gtagjs
     */
    gtag?: (
      command: 'event' | 'config' | 'set',
      targetOrAction: string,
      parameters?: Record<string, unknown>
    ) => void;

    /**
     * Mixpanel Analytics (optional)
     * Documentation: https://developer.mixpanel.com/docs/javascript
     */
    mixpanel?: {
      track: (eventName: string, properties?: Record<string, unknown>) => void;
      identify: (userId: string) => void;
      people: {
        set: (properties: Record<string, unknown>) => void;
      };
    };

    /**
     * Amplitude Analytics (optional)
     * Documentation: https://www.docs.developers.amplitude.com/data/sdks/browser-2/
     */
    amplitude?: {
      track: (eventName: string, eventProperties?: Record<string, unknown>) => void;
      setUserId: (userId: string) => void;
    };
  }
}

export {};
