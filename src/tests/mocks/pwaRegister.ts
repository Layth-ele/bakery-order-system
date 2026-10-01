/**
 * Test stand-in for vite-plugin-pwa's `virtual:pwa-register/react` module
 * (virtual modules only exist when the PWA plugin runs in a Vite build).
 */
import { useState } from 'react';

export function useRegisterSW() {
  const needRefresh = useState(false);
  const offlineReady = useState(false);
  return { needRefresh, offlineReady, updateServiceWorker: async () => {} };
}
