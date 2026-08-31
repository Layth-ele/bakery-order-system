/**
 * RouteLoader.tsx
 * Branded loading components for route transitions
 * 
 * Features:
 * - Luxury black and gold aesthetic
 * - Multiple loading variants for different contexts
 * - Smooth animations
 * - Consistent branding across all loading states
 */

import { Loader2, ShoppingBag } from 'lucide-react';
import { motion } from 'motion/react';

interface RouteLoaderProps {
  message?: string;
  variant?: 'default' | 'minimal' | 'fullscreen';
}

/**
 * Default route loader - used for lazy-loaded route components
 */
export function RouteLoader({ 
  message = 'Loading...', 
  variant = 'default' 
}: RouteLoaderProps): JSX.Element | null {
  if (variant === 'minimal') {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4A574]" />
      </div>
    );
  }
  
  if (variant === 'fullscreen') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-[#1a1a1a] to-black flex items-center justify-center">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#D4A574]/20 to-[#B8935E]/20 border-2 border-[#D4A574]/30 mb-6"
          >
            <Loader2 className="w-10 h-10 animate-spin text-[#D4A574]" />
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="text-gray-400 text-lg"
          >
            {message}
          </motion.p>
        </div>
      </div>
    );
  }
  
  // Default variant
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#D4A574]/20 to-[#B8935E]/20 border-2 border-[#D4A574]/30 mb-4"
        >
          <Loader2 className="w-8 h-8 animate-spin text-[#D4A574]" />
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-gray-600 text-base"
        >
          {message}
        </motion.p>
      </div>
    </div>
  );
}

/**
 * Admin route loader - matches admin dashboard aesthetic
 */
export function AdminRouteLoader({ message = 'Loading...' }: { message?: string }): JSX.Element | null {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#D4A574]/20 to-[#B8935E]/20 border-2 border-[#D4A574]/30 mb-6"
        >
          <Loader2 className="w-10 h-10 animate-spin text-[#D4A574]" />
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-gray-400 text-lg"
        >
          {message}
        </motion.p>
      </div>
    </div>
  );
}

/**
 * Customer route loader - matches customer dashboard aesthetic
 */
export function CustomerRouteLoader({ message = 'Loading...' }: { message?: string }): JSX.Element | null {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4a4a4a] via-[#3a3a3a] to-[#2a2a2a] flex items-center justify-center">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#D4A574]/20 to-[#B8935E]/20 border-2 border-[#D4A574]/30 mb-6"
        >
          <ShoppingBag className="w-10 h-10 text-[#D4A574] animate-pulse" />
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-gray-300 text-lg"
        >
          {message}
        </motion.p>
      </div>
    </div>
  );
}

/**
 * Page skeleton loader - shows content structure while loading
 */
export function PageSkeleton(): JSX.Element | null {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f5] via-[#e8e8e8] to-[#f0f0f0] py-8 animate-pulse">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header skeleton */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-2 border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 rounded-xl" />
            <div className="flex-1">
              <div className="h-8 bg-gray-200 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-64" />
            </div>
          </div>
        </div>
        
        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
        
        {/* Content skeleton */}
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Card skeleton - for loading individual cards
 */
export function CardSkeleton({ count = 1 }: { count?: number }): JSX.Element | null {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200 animate-pulse">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gray-200 rounded-lg" />
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-32 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-48" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Table skeleton - for loading tables
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }): JSX.Element | null {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-gray-200 animate-pulse">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              {[...Array(4)].map((_, i) => (
                <th key={i} className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, i) => (
              <tr key={i} className="border-b border-gray-100">
                {[...Array(4)].map((_, j) => (
                  <td key={j} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 rounded w-32" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
