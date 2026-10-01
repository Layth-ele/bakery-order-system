/**
 * Generates every PWA icon from public/app-icon.svg:
 *   npm run generate:icons
 * Outputs (committed, in public/): favicon.ico, pwa-64x64.png,
 * pwa-192x192.png, pwa-512x512.png, maskable-icon-512x512.png,
 * apple-touch-icon-180x180.png
 */
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // The source already has a full-bleed background, so no extra padding
    // or background colour is needed for the maskable / Apple variants.
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#5C4330' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#5C4330' } },
  },
  images: ['public/app-icon.svg'],
});
