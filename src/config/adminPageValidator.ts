/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN PAGE VALIDATION UTILITIES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Runtime validation to ensure navigation config and renderer stay in sync.
 * Catches mismatches during development before they cause routing failures.
 * 
 * Usage:
 * - Import and call validateAdminPages() during development
 * - Will throw detailed errors if mismatches found
 * - Safe to remove in production (tree-shaking friendly)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { AdminPage, ADMIN_NAV_CONFIG, isValidAdminPage } from './adminNavigation';
import { logger } from '../utils/logger';


/**
 * All page IDs that should have renderer cases
 * ✅ MANUALLY UPDATE when adding pages to AdminPageRenderer.tsx
 */
const RENDERER_CASES: readonly AdminPage[] = [
  'pending',
  'approved',
  'unpaid',
  'history',
  'products',
  'customers',
  'registrations',
  'analytics',
  'settings',
  'weekly-invoices',
  'production-todo',
] as const;

/**
 * Validation result interface
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalPages: number;
    navConfigPages: number;
    rendererPages: number;
    missingInRenderer: AdminPage[];
    missingInNavConfig: AdminPage[];
  };
}

/**
 * Validate that all navigation entries have renderer cases
 * @returns Validation result with detailed errors/warnings
 */
export function validateAdminPages(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Get all unique page IDs from navigation config
  const navConfigPages = new Set<AdminPage>();
  ADMIN_NAV_CONFIG.forEach(item => navConfigPages.add(item.id));
  
  // Get all page IDs from renderer cases
  const rendererPages = new Set<AdminPage>(RENDERER_CASES);
  
  // Find pages in nav config but missing renderer cases
  const missingInRenderer: AdminPage[] = [];
  navConfigPages.forEach(pageId => {
    if (!rendererPages.has(pageId)) {
      missingInRenderer.push(pageId);
      errors.push(
        `❌ Page '${pageId}' is in navigation config but has no renderer case in AdminPageRenderer.tsx`
      );
    }
  });
  
  // Find renderer cases without nav config entries
  const missingInNavConfig: AdminPage[] = [];
  rendererPages.forEach(pageId => {
    if (!navConfigPages.has(pageId)) {
      missingInNavConfig.push(pageId);
      warnings.push(
        `⚠️ Page '${pageId}' has a renderer case but no navigation config entry (might be intentional if page is not in nav)`
      );
    }
  });
  
  // Validate that nav config IDs are valid AdminPage types
  ADMIN_NAV_CONFIG.forEach(item => {
    if (!isValidAdminPage(item.id)) {
      errors.push(
        `❌ Navigation item '${item.id}' is not a valid AdminPage type`
      );
    }
  });
  
  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalPages: new Set([...navConfigPages, ...rendererPages]).size,
      navConfigPages: navConfigPages.size,
      rendererPages: rendererPages.size,
      missingInRenderer,
      missingInNavConfig,
    },
  };
  
  return result;
}

/**
 * Assert that admin pages are valid (throws on error)
 * Use in development to catch issues early
 */
export function assertValidAdminPages(): void {
  const result = validateAdminPages();
  
  if (!result.valid) {
    console.error('❌ Admin Page Validation Failed!');
    console.error('═══════════════════════════════════════════════════════════');
    
    result.errors.forEach(error => console.error(error));
    result.warnings.forEach(warning => logger.warn(warning));
    
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Summary:', result.summary);
    
    throw new Error(
      `Admin page validation failed with ${result.errors.length} error(s). ` +
      `Check console for details.`
    );
  }
  
  // Log success in development
}

/**
 * Get detailed validation report (for debugging)
 */
export function getValidationReport(): string {
  const result = validateAdminPages();
  
  let report = '═══════════════════════════════════════════════════════════\n';
  report += 'ADMIN PAGE VALIDATION REPORT\n';
  report += '═══════════════════════════════════════════════════════════\n\n';
  
  // Summary
  report += '📊 SUMMARY\n';
  report += `   Total unique pages: ${result.summary.totalPages}\n`;
  report += `   Navigation config entries: ${result.summary.navConfigPages}\n`;
  report += `   Renderer cases: ${result.summary.rendererPages}\n`;
  report += `   Status: ${result.valid ? '✅ VALID' : '❌ INVALID'}\n\n`;
  
  // Errors
  if (result.errors.length > 0) {
    report += '❌ ERRORS\n';
    result.errors.forEach(error => report += `   ${error}\n`);
    report += '\n';
  }
  
  // Warnings
  if (result.warnings.length > 0) {
    report += '⚠️ WARNINGS\n';
    result.warnings.forEach(warning => report += `   ${warning}\n`);
    report += '\n';
  }
  
  // Missing pages
  if (result.summary.missingInRenderer.length > 0) {
    report += '🔍 MISSING RENDERER CASES\n';
    result.summary.missingInRenderer.forEach(pageId => {
      report += `   • ${pageId}\n`;
    });
    report += '\n';
  }
  
  if (result.summary.missingInNavConfig.length > 0) {
    report += '🔍 MISSING NAV CONFIG ENTRIES\n';
    result.summary.missingInNavConfig.forEach(pageId => {
      report += `   • ${pageId}\n`;
    });
    report += '\n';
  }
  
  // Success
  if (result.valid) {
    report += '✅ All admin pages are properly configured!\n';
    report += '   Navigation → Renderer mapping is 1:1\n';
  }
  
  report += '═══════════════════════════════════════════════════════════\n';
  
  return report;
}

/**
 * Log validation report to console (development helper)
 */
export function logValidationReport(): void {
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVELOPMENT MODE AUTO-VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Automatically validate in development mode
 * Will warn but not throw to avoid breaking the app
 */
