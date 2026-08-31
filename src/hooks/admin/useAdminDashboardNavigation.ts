/**
 * useAdminDashboardNavigation.ts
 * 
 * ✅ PHASE 2: Admin Pages Standardization - Navigation Logic Layer
 * 
 * PURPOSE:
 * - Extract all navigation logic from AdminDashboard
 * - Handle page changes, sidebar state, keyboard shortcuts
 * - Calculate badge counts for navigation items
 * - Single source of truth for navigation behavior
 * 
 * ARCHITECTURE:
 * - Input: currentPage, setCurrentPage, badge counts, modal actions
 * - Output: Navigation handlers and state
 * - Encapsulates all navigation business logic
 * 
 * EXTRACTED FROM: /pages/admin/AdminDashboard.tsx
 */

import { useState, useCallback, useMemo } from 'react';
import { useModal } from '../../contexts/ModalContextNew';
import { handleSmoothPageChange } from '../../utils/pageTransitions';
import { invalidateCache } from '../../hooks/useCachedFirebase';
import {
  useKeyboardShortcuts,
  KeyboardShortcut,
} from '../useKeyboardShortcuts';
import type { AdminPage } from '../../config/adminNavigation';

interface UseAdminDashboardNavigationProps {
  isActive: boolean;
  currentPage: AdminPage; // ✅ FIXED: Changed from string to AdminPage type
  setCurrentPage: (page: AdminPage) => void;
  badgeCounts: {
    pending: number;
    registrations: number;
    unpaid: number;
    approved: number;
  };
  onShowNotification: (message: string) => void;
  selectedOrder: any | null;
  setSelectedOrder: (order: any | null) => void;
}

interface AdminDashboardNavigation {
  // State
  sidebarOpen: boolean;
  showKeyboardShortcuts: boolean;
  
  // Handlers
  setSidebarOpen: (open: boolean) => void;
  setShowKeyboardShortcuts: (show: boolean) => void;
  handlePageChange: (page: AdminPage) => void;
  getBadgeCount: (pageId: AdminPage) => number | undefined;
}

/**
 * Hook to manage navigation logic for AdminDashboard
 * 
 * Handles:
 * - Page navigation with modal cleanup
 * - Sidebar toggle state
 * - Badge count calculations
 * - Keyboard shortcuts
 * - Keyboard shortcuts help modal
 * 
 * @param props - Navigation configuration
 * @returns Navigation handlers and state
 */
export function useAdminDashboardNavigation({
  isActive,
  currentPage,
  setCurrentPage,
  badgeCounts,
  onShowNotification,
  selectedOrder,
  setSelectedOrder,
}: UseAdminDashboardNavigationProps): AdminDashboardNavigation {
  // ============================================================================
  // STATE
  // ============================================================================
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  
  // ============================================================================
  // MODAL CONTEXT
  // ============================================================================
  
  const { closeAllModals } = useModal();
  
  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================
  
  /**
   * Safe page navigation with modal cleanup
   * Prevents stuck scroll-lock when changing tabs while modals are open
   */
  const handlePageChange = useCallback(
    (page: AdminPage) => {
      closeAllModals(); // Close all modals to prevent scroll-lock getting stuck
      handleSmoothPageChange(page, setCurrentPage);
    },
    [closeAllModals, setCurrentPage]
  );
  
  /**
   * Get badge count for a navigation item
   * Returns undefined if count is 0 (no badge shown)
   */
  const getBadgeCount = useCallback(
    (pageId: AdminPage): number | undefined => {
      const count = badgeCounts[pageId as keyof typeof badgeCounts];
      return count > 0 ? count : undefined;
    },
    [badgeCounts]
  );
  
  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================
  
  const shortcuts = useMemo<KeyboardShortcut[]>(
    () => [
      // General
      {
        key: '?',
        description: 'Show keyboard shortcuts help',
        action: () => setShowKeyboardShortcuts(true),
        category: 'general',
      },
      {
        key: 'Escape',
        description: 'Close current modal or panel',
        action: () => {
          if (showKeyboardShortcuts) {
            setShowKeyboardShortcuts(false);
          } else if (sidebarOpen) {
            setSidebarOpen(false);
          } else if (selectedOrder) {
            setSelectedOrder(null);
          }
        },
        category: 'general',
      },
  
      // Navigation
      {
        key: 'p',
        description: 'Go to Pending Orders',
        action: () => handlePageChange('pending'),
        category: 'navigation',
      },
      {
        key: 'a',
        description: 'Go to Approved Orders',
        action: () => handlePageChange('approved'),
        category: 'navigation',
      },
      {
        key: 'u',
        description: 'Go to Unpaid Orders',
        action: () => handlePageChange('unpaid'),
        category: 'navigation',
      },
      {
        key: 'i',
        description: 'Go to In-Process Orders',
        action: () => handlePageChange('approved'),
        category: 'navigation',
      },
      {
        key: 'c',
        description: 'Go to Completed Orders',
        action: () => handlePageChange('history'),
        category: 'navigation',
      },
      {
        key: 'r',
        description: 'Go to Registration Requests',
        action: () => handlePageChange('registrations'),
        category: 'navigation',
      },
      {
        key: 'm',
        description: 'Toggle sidebar menu',
        action: () => setSidebarOpen(!sidebarOpen),
        category: 'navigation',
      },
  
      // Actions
      {
        key: 'r',
        ctrlKey: true,
        description: 'Refresh data',
        action: () => {
          invalidateCache.orders();
          invalidateCache.customers();
          onShowNotification('Data refreshed');
        },
        category: 'actions',
      },
    ],
    [
      showKeyboardShortcuts,
      sidebarOpen,
      selectedOrder,
      handlePageChange,
      onShowNotification,
      setSelectedOrder,
    ]
  );
  
  // Register keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts,
    enabled: isActive,
  });
  
  // ============================================================================
  // RETURN HANDLERS
  // ============================================================================
  
  return {
    // State
    sidebarOpen,
    showKeyboardShortcuts,
    
    // Handlers
    setSidebarOpen,
    setShowKeyboardShortcuts,
    handlePageChange,
    getBadgeCount,
  };
}