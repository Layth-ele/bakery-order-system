/**
 * Track component renders and performance
 * ✅ FEB 17, 2026: Fixed missing React imports
 */

import { useEffect, useRef } from 'react';
import { logger } from '../utils/logger';


// Performance thresholds
const THRESHOLDS = {
  SLOW_RENDER_MS: 16, // Target 60fps = 16.67ms per frame
  SLOW_FIRST_RENDER_MS: 50, // First render might be slower
  SLOW_MOUNT_MS: 100, // Mount should be fast
  EXCESSIVE_RENDERS: 15, // More than 15 renders might indicate a problem (increased from 10 for complex components with multiple async data sources)
 // Add realistic thresholds for data-heavy admin components
  DATA_HEAVY_RENDER_MS: 25, // Components with lots of order data
};

// Metrics storage
interface RenderMetrics {
  componentName: string;
  renderCount: number;
  lastRenderTime: number;
  totalRenderTime: number;
  averageRenderTime: number;
  mountTime: number;
}

const renderMetrics = new Map<string, RenderMetrics>();

export function useRenderTracking(
  componentName: string, 
  enabled: boolean = true,
  customRenderThreshold?: number, // Optional custom render threshold
  customMountThreshold?: number, // Optional custom mount threshold
  customExcessiveRenderCount?: number // Optional custom excessive render count threshold
) {
 // PERFORMANCE FIX - Only track in development mode
  // Production should not have any performance logging to avoid slowdowns
  if (!(typeof import.meta !== 'undefined' && import.meta.env?.DEV) || !enabled) {
    return; // Early return in production - no tracking overhead
  }
  
  const renderCount = useRef(0);
  const mountTime = useRef<number | null>(null);
  const lastRenderStart = useRef<number>(0);
  
  // Track mount time
  if (mountTime.current === null) {
    mountTime.current = performance.now();
  }

  // Increment render count
  renderCount.current++;

  // Measure render time
  lastRenderStart.current = performance.now();

  useEffect(() => {
    const renderDuration = performance.now() - lastRenderStart.current;
    
 // PERFORMANCE FIX - Reduce metric storage overhead
    // Only store metrics on first render and every 10th render to reduce Map operations
    const shouldStoreMetrics = renderCount.current === 1 || renderCount.current % 10 === 0;
    
    if (shouldStoreMetrics) {
      const currentMetrics = renderMetrics.get(componentName) || {
        componentName,
        renderCount: 0,
        lastRenderTime: 0,
        totalRenderTime: 0,
        averageRenderTime: 0,
        mountTime: mountTime.current!,
      };

      // Update metrics
      currentMetrics.renderCount = renderCount.current;
      currentMetrics.lastRenderTime = renderDuration;
      currentMetrics.totalRenderTime += renderDuration;
      currentMetrics.averageRenderTime = currentMetrics.totalRenderTime / currentMetrics.renderCount;

      renderMetrics.set(componentName, currentMetrics);
    }

 // PERFORMANCE FIX - Reduced excessive logging
    // Only log warnings on first render or if there's an actual performance issue
    // Avoid logging on every render to reduce console overhead
 // Use different threshold for first render vs subsequent renders
 // Use custom threshold for first render if provided
    const isFirstRender = renderCount.current === 1;
    const firstRenderThreshold = customRenderThreshold || customMountThreshold || THRESHOLDS.SLOW_FIRST_RENDER_MS;
    const renderThreshold = isFirstRender ? firstRenderThreshold : (customRenderThreshold || THRESHOLDS.SLOW_RENDER_MS);
    const shouldLog = renderDuration > renderThreshold;
    
    if (shouldLog) {
      logger.warn(
        `⚠️ [Performance] ${componentName} render #${renderCount.current} took ${renderDuration.toFixed(2)}ms (threshold: ${renderThreshold}ms)`
      );
    }

    // Only warn about excessive renders once
    const excessiveRenderCount = customExcessiveRenderCount || THRESHOLDS.EXCESSIVE_RENDERS;
    if (renderCount.current === excessiveRenderCount) {
      logger.warn(
        `⚠️ [Performance] ${componentName} has rendered ${renderCount.current} times (threshold: ${excessiveRenderCount})`
      );
    }

    // Log mount time on first render only
    if (renderCount.current === 1) {
      const mountDuration = performance.now() - mountTime.current!;
      const mountThreshold = customMountThreshold || THRESHOLDS.SLOW_MOUNT_MS;
      if (mountDuration > mountThreshold) {
        logger.warn(
          `⚠️ [Performance] ${componentName} mount took ${mountDuration.toFixed(2)}ms (threshold: ${mountThreshold}ms)`
        );
      }
      // ✅ Removed success mount logging to reduce console spam
    }

    // Cleanup tracking on unmount - simplified
  });
}

// Export function to get all metrics (useful for debugging)
export function getAllRenderMetrics(): RenderMetrics[] {
  return Array.from(renderMetrics.values());
}

// Export function to clear metrics
export function clearRenderMetrics(): void {
  renderMetrics.clear();
}