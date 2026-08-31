/**
 * usePerformanceMonitor Hook
 * 🟢 HOOK - Performance monitoring and optimization
 * 
 * REFACTORED - Phase 3: Performance Optimizations
 * - Monitors component render performance
 * - Tracks expensive operations
 * - Provides optimization insights
 * 
 * Responsibilities:
 * - Render time tracking
 * - Re-render counting
 * - Performance warnings
 * - Memory usage monitoring
 * 
 * Usage:
 * const perf = usePerformanceMonitor('ComponentName');
 * // Component automatically tracked
 * 
 * Development Only:
 * - Only active in development mode
 * - Zero overhead in production
 * 
 * Location: /hooks/shared/usePerformanceMonitor.ts
 */

import { useEffect, useRef } from 'react';
import { debug } from '../../utils/debug';
import { logger } from '../../utils/logger';


// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceMetrics {
  componentName: string;
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  slowRenders: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SLOW_RENDER_THRESHOLD = 16; // 16ms = 60fps threshold
const isDevelopment = process.env.NODE_ENV === 'development';

// ============================================================================
// HOOK
// ============================================================================

export function usePerformanceMonitor(
  componentName: string,
  enabled: boolean = isDevelopment
): PerformanceMetrics {
  
  const renderCountRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);
  const slowRendersRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  
  // Track render start time
  if (enabled) {
    startTimeRef.current = performance.now();
  }
  
  // ============================================================================
  // TRACK RENDER COMPLETION
  // ============================================================================
  
  useEffect(() => {
    if (!enabled) return;
    
    const endTime = performance.now();
    const renderTime = endTime - startTimeRef.current;
    
    // Increment render count
    renderCountRef.current++;
    
    // Track render times
    renderTimesRef.current.push(renderTime);
    
    // Keep only last 100 renders
    if (renderTimesRef.current.length > 100) {
      renderTimesRef.current.shift();
    }
    
    // Track slow renders
    if (renderTime > SLOW_RENDER_THRESHOLD) {
      slowRendersRef.current++;
      logger.warn(
        `⚠️ Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`
      );
    }
    
    // Log every 10 renders in development
    if (renderCountRef.current % 10 === 0) {
      const avgRenderTime =
        renderTimesRef.current.reduce((a, b) => a + b, 0) /
        renderTimesRef.current.length;
      
      debug.log(
        `📊 ${componentName} Performance:`,
        `\n  Renders: ${renderCountRef.current}`,
        `\n  Avg Time: ${avgRenderTime.toFixed(2)}ms`,
        `\n  Slow Renders: ${slowRendersRef.current}`,
        `\n  Last Render: ${renderTime.toFixed(2)}ms`
      );
    }
  });
  
  // ============================================================================
  // CALCULATE METRICS
  // ============================================================================
  
  const averageRenderTime =
    renderTimesRef.current.length > 0
      ? renderTimesRef.current.reduce((a, b) => a + b, 0) /
        renderTimesRef.current.length
      : 0;
  
  const lastRenderTime =
    renderTimesRef.current.length > 0
      ? renderTimesRef.current[renderTimesRef.current.length - 1]
      : 0;
  
  // ============================================================================
  // RETURN METRICS
  // ============================================================================
  
  return {
    componentName,
    renderCount: renderCountRef.current,
    lastRenderTime,
    averageRenderTime,
    slowRenders: slowRendersRef.current,
  };
}

// ============================================================================
// UTILITY: Track expensive operations
// ============================================================================

export function trackOperation<T>(
  operationName: string,
  operation: () => T
): T {
  if (!isDevelopment) {
    return operation();
  }
  
  const start = performance.now();
  const result = operation();
  const duration = performance.now() - start;
  
  if (duration > SLOW_RENDER_THRESHOLD) {
    logger.warn(
      `⚠️ Slow operation: ${operationName} took ${duration.toFixed(2)}ms`
    );
  }
  
  return result;
}

// ============================================================================
// UTILITY: Measure async operations
// ============================================================================

export async function measureAsync<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  if (!isDevelopment) {
    return operation();
  }
  
  const start = performance.now();
  const result = await operation();
  const duration = performance.now() - start;
  
  
  return result;
}
