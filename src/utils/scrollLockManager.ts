/**
 * ===================================================================
 * Centralized Scroll Lock Manager
 * ===================================================================
 * 
 * PROBLEM SOLVED:
 * - UI freezes when moving between tabs after modal/alert actions
 * - Race conditions between ModalRoot and AlertContext scroll locks
 * - Stuck scroll lock when components unmount unexpectedly
 * - Conflicting mechanisms (position:fixed vs overflow:hidden)
 * 
 * SOLUTION:
 * - Single source of truth with reference counting
 * - Only locks when first component requests it
 * - Only unlocks when last component releases it
 * - Automatic cleanup and failsafe recovery
 * 
 * ✅ FIXED: March 10, 2026 - Removed require() calls
 * 
 * Version: 1.0.0 - February 9, 2026
 */

import { useEffect } from 'react';
import { logger } from './logger';
 // ✅ FIX: Import React at top

interface ScrollLockState {
  lockCount: number;
  scrollY: number;
  originalStyles: {
    position: string;
    top: string;
    width: string;
    paddingRight: string;
    overflow: string;
  };
  isLocked: boolean;
}

class ScrollLockManager {
  private state: ScrollLockState = {
    lockCount: 0,
    scrollY: 0,
    originalStyles: {
      position: '',
      top: '',
      width: '',
      paddingRight: '',
      overflow: '',
    },
    isLocked: false,
  };

  private debug = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  /**
   * Request scroll lock (increments reference count)
   * Returns a cleanup function to call when done
   */
  public lock(source?: string): () => void {
    this.state.lockCount++;

    if (this.debug) {
    }

    // First lock - actually lock the scroll
    if (this.state.lockCount === 1) {
      this.applyScrollLock();
    }

    // Return cleanup function
    return () => this.unlock(source);
  }

  /**
   * Release scroll lock (decrements reference count)
   */
  public unlock(source?: string): void {
    if (this.state.lockCount > 0) {
      this.state.lockCount--;

      if (this.debug) {
      }

      // Last unlock - actually unlock the scroll
      if (this.state.lockCount === 0) {
        this.removeScrollLock();
      }
    } else if (this.debug) {
      logger.warn(`⚠️ [ScrollLock] Unlock called by "${source || 'unknown'}" but lockCount is already 0`);
    }
  }

  /**
   * Force unlock all locks (emergency/failsafe)
   * ✅ FEB 17, 2026: Changed warning to info - this is normal cleanup behavior
   */
  public forceUnlock(reason?: string): void {
    const hadLock = this.state.lockCount > 0;
    
    if (this.debug && hadLock) {
 // Changed from console.warn to console.log
      // This is a normal safety mechanism, not an error condition
      // The failsafe is working correctly by recovering from stuck locks
    } else if (this.debug && !hadLock) {
      // Just info if no lock existed (preventive call)
    }

    this.state.lockCount = 0;
    this.removeScrollLock();
  }

  /**
   * Check if scroll is currently locked
   */
  public isLocked(): boolean {
    return this.state.isLocked;
  }

  /**
   * Get current lock count (for debugging)
   */
  public getLockCount(): number {
    return this.state.lockCount;
  }

  /**
   * Apply scroll lock to document.body
   */
  private applyScrollLock(): void {
    // Save current scroll position
    this.state.scrollY = window.scrollY;

    // Calculate scrollbar width for padding compensation
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Save original styles
    this.state.originalStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      paddingRight: document.body.style.paddingRight,
      overflow: document.body.style.overflow,
    };

    // Apply lock using position:fixed (most reliable method)
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.state.scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = 'hidden'; // Belt and suspenders

    this.state.isLocked = true;

    if (this.debug) {
    }
  }

  /**
   * Remove scroll lock from document.body
   */
  private removeScrollLock(): void {
    if (!this.state.isLocked) {
      if (this.debug) {
      }
      return;
    }

 // Capture scroll position before removing lock
    const savedScrollY = this.state.scrollY;

    // Restore original styles
    document.body.style.position = this.state.originalStyles.position;
    document.body.style.top = this.state.originalStyles.top;
    document.body.style.width = this.state.originalStyles.width;
    document.body.style.paddingRight = this.state.originalStyles.paddingRight;
    document.body.style.overflow = this.state.originalStyles.overflow;

    this.state.isLocked = false;

 // Restore scroll immediately and silently
    // Use scrollTo with instant behavior (no smooth scrolling)
    window.scrollTo({
      top: savedScrollY,
      left: 0,
      behavior: 'instant' as ScrollBehavior
    });

    if (this.debug) {
    }
  }

  /**
   * Debug info (development only)
   */
  public getDebugInfo(): ScrollLockState {
    return { ...this.state };
  }
}

// Singleton instance
export const scrollLockManager = new ScrollLockManager();

// Convenience React hook
export function useScrollLock(enabled: boolean, source?: string): void {
  if (typeof window === 'undefined') return; // SSR safety

  useEffect(() => {
    if (!enabled) return;

    // Request lock and get cleanup function
    const unlock = scrollLockManager.lock(source);

    // Cleanup on unmount
    return unlock;
  }, [enabled, source]);
}

// Export for window object (debugging in console)
if (typeof window !== 'undefined') {
  (window as any).scrollLockManager = scrollLockManager;
}