/**
 * Configuration Barrel Export
 * ✅ FEB 18, 2026: Centralized configuration export
 * 
 * PURPOSE:
 * - Single import point for all configurations
 * - Clean import statements throughout the app
 * - Easy to maintain and extend
 * 
 * USAGE:
 * ```typescript
 * // Instead of:
 * import { ENV_CONFIG } from '@/config/environment';
 * import { customerDashboardPages } from '@/config/customerDashboard';
 * 
 * // Use:
 * import { ENV_CONFIG, customerDashboardPages } from '@/config';
 * ```
 */

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

export * from './environment';
export type { EnvironmentConfig } from './environment';

// ============================================================================
// NAVIGATION CONFIGURATION
// ============================================================================

export * from './adminNavigation';
export * from './customerDashboard';

// ============================================================================
// DATA MODE CONFIGURATION
// ============================================================================

// ✅ REMOVED MAR 14, 2026: dataMode.ts is deprecated
// The codebase now uses isFirebaseConfigured from firebase/config.ts


// ============================================================================
// PAGE VALIDATION
// ============================================================================

export * from './adminPageValidator';