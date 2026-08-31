/**
 * Environment-Specific Configuration
 * ✅ MAR 11, 2026: Enhanced with Vite support and logging controls
 * 
 * PURPOSE:
 * - Single source of truth for environment detection
 * - Feature flag management
 * - Environment-specific API endpoints
 * - Centralized logging control
 * 
 * USAGE:
 * ```typescript
 * import { ENV } from '@/config/environment';
 * 
 * if (ENV.isDevelopment) {
 *   console.log('Debug info...');
 * }
 * 
 * if (ENV.features.enableServiceCharge) {
 *   // Apply service charge
 * }
 * 
 * if (ENV.shouldLogToConsole()) {
 *   console.log('Logging enabled');
 * }
 * ```
 */

// ✅ Support both Vite and Next.js environments
const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

const isViteDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;
const isViteProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD === true;
const nodeEnv = getEnvVar('NODE_ENV');

export const ENV = {
  /**
   * Environment Detection (supports Vite and Next.js)
   */
  isDevelopment: isViteDev || nodeEnv === 'development',
  isProduction: isViteProd || nodeEnv === 'production',
  isTest: nodeEnv === 'test',

  /**
   * API Configuration
   */
  api: {
    url: getEnvVar('NEXT_PUBLIC_API_URL') || getEnvVar('VITE_API_URL') || '',
    timeout: 30000, // 30 seconds
  },

  /**
   * Feature Flags
   * Control which features are enabled in the application
   */
  features: {
    // ID Generation Strategy
    useCloudFunctions: getEnvVar('NEXT_PUBLIC_USE_CLOUD_FUNCTIONS') === 'true' || 
                      getEnvVar('VITE_USE_CLOUD_FUNCTIONS') === 'true' ||
                      false, // ✅ DEFAULT: false (client-side IDs work NOW, switch to true when Cloud Functions deployed)
    
    // Pricing Features
    enableServiceCharge: getEnvVar('NEXT_PUBLIC_ENABLE_SERVICE_CHARGE') === 'true' || 
                        getEnvVar('VITE_ENABLE_SERVICE_CHARGE') === 'true',
    enableEarlyOrderDiscount: getEnvVar('NEXT_PUBLIC_EARLY_DISCOUNT') === 'true' || 
                             getEnvVar('VITE_EARLY_DISCOUNT') === 'true',
    enableBulkDiscount: getEnvVar('NEXT_PUBLIC_BULK_DISCOUNT') === 'true' || 
                       getEnvVar('VITE_BULK_DISCOUNT') === 'true',
    
    // Payment Features
    enableManualPayment: true, // Currently always enabled (e-transfer)
    enableCreditCard: getEnvVar('NEXT_PUBLIC_ENABLE_CREDIT_CARD') === 'true' || 
                     getEnvVar('VITE_ENABLE_CREDIT_CARD') === 'true',
    
    // Analytics Features
    enablePerformanceMonitoring: getEnvVar('NEXT_PUBLIC_ENABLE_PERF_MONITORING') === 'true' || 
                                getEnvVar('VITE_PERF_MONITOR') === 'true',
    enableErrorTracking: getEnvVar('NEXT_PUBLIC_ENABLE_ERROR_TRACKING') === 'true' || 
                        getEnvVar('VITE_ERROR_REPORTING') === 'true',
    
    // Debug Features (Development Only)
    enableDebugLogging: (isViteDev || nodeEnv === 'development') && 
                       (getEnvVar('VITE_DEBUG') === 'true' || getEnvVar('NEXT_PUBLIC_DEBUG') === 'true'),
    enableDebugMode: (isViteDev || nodeEnv === 'development') && 
                    (getEnvVar('VITE_DEBUG') === 'true' || getEnvVar('NEXT_PUBLIC_DEBUG') === 'true'),
    showRenderTracking: (isViteDev || nodeEnv === 'development') && 
                       (getEnvVar('VITE_RENDER_TRACKING') === 'true' || getEnvVar('NEXT_PUBLIC_RENDER_TRACKING') === 'true'),
  },

  /**
   * Application Metadata
   */
  app: {
    name: 'Bakery Order Management System',
    version: getEnvVar('NEXT_PUBLIC_APP_VERSION') || getEnvVar('VITE_APP_VERSION') || '1.0.0',
    timezone: 'America/Vancouver',
  },

  /**
   * Computed helper: Should we log to console?
   * Returns true in development or if debug logging is explicitly enabled
   */
  shouldLogToConsole(): boolean {
    return this.isDevelopment || this.features.enableDebugLogging;
  },

  /**
   * Computed helper: Should we log errors?
   * Always log errors in production, but can be disabled for tests
   */
  shouldLogErrors(): boolean {
    return !this.isTest;
  },

  /**
   * Computed helper: Should we report to external error service?
   */
  shouldReportErrors(): boolean {
    return this.isProduction && this.features.enableErrorTracking;
  },
} as const;

/**
 * Type-safe environment configuration
 */
export type EnvironmentConfig = typeof ENV;

/**
 * Helper function to check if we're in development
 */
export const isDev = () => ENV.isDevelopment;

/**
 * Helper function to check if we're in production
 */
export const isProd = () => ENV.isProduction;

/**
 * Helper function to check if a feature is enabled
 */
export const isFeatureEnabled = (feature: keyof typeof ENV.features): boolean => {
  return ENV.features[feature] === true;
};

// ✅ Backward compatibility export
export const ENV_CONFIG = ENV;