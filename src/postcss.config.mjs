/**
 * PostCSS Configuration for Tailwind CSS v4
 * 
 * ✅ MAR 18, 2026: Ensures consistent CSS processing between dev and production
 * Tailwind v4 uses the new `@import "tailwindcss"` syntax and requires PostCSS
 */

export default {
  plugins: {
    'tailwindcss': {},
    'autoprefixer': {},
  },
}
