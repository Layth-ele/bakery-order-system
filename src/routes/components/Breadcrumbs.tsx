/**
 * Breadcrumbs.tsx
 * Auto-generating breadcrumb navigation component
 * 
 * Features:
 * - Auto-generates from route hierarchy
 * - Click to navigate to parent routes
 * - Luxury light design with gold accents
 * - Responsive design
 * - Smart truncation for long paths
 */

import { Link, useMatches } from 'react-router';
import { ChevronRight, Home } from 'lucide-react';
import { motion } from 'motion/react';

interface BreadcrumbMatch {
  id: string;
  pathname: string;
  data?: any;
  handle?: {
    crumb?: string | ((data?: any) => string);
  };
}

/**
 * Main breadcrumbs component
 */
export function Breadcrumbs(): JSX.Element | null {
  const matches = useMatches() as BreadcrumbMatch[];
  
  // Filter matches that have breadcrumb handles
  const crumbs = matches
    .filter((match) => match.handle?.crumb)
    .map((match) => ({
      pathname: match.pathname,
      label: typeof match.handle?.crumb === 'function' 
        ? match.handle.crumb(match.data)
        : match.handle?.crumb || '',
    }));
  
  // Don't show breadcrumbs if there's only one or zero crumbs
  if (crumbs.length <= 1) {
    return null;
  }
  
  return (
    <nav 
      aria-label="Breadcrumb" 
      className="mb-6"
    >
      <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-white/80 to-gray-50/80 backdrop-blur-sm border border-gray-200/50 shadow-sm">
        {/* Home icon */}
        <Link
          to="/"
          className="flex items-center gap-2 px-2 py-1 rounded-full text-gray-600 hover:text-[#D4A574] hover:bg-[#D4A574]/5 transition-all duration-200 group"
          aria-label="Home"
        >
          <Home className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
        </Link>
        
        {/* Breadcrumb items */}
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          
          return (
            <div key={crumb.pathname} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-gray-300" />
              
              {isLast ? (
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#D4A574]/10 to-[#C4956A]/10 text-[#D4A574] font-semibold text-sm">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.pathname}
                  className="px-2 py-1 rounded-full text-gray-600 hover:text-[#D4A574] hover:bg-[#D4A574]/5 transition-all duration-200 text-sm font-medium"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Admin breadcrumbs - styled for admin dashboard
 */
export function AdminBreadcrumbs(): JSX.Element | null {
  const matches = useMatches() as BreadcrumbMatch[];
  
  const crumbs = matches
    .filter((match) => match.handle?.crumb)
    .map((match) => ({
      pathname: match.pathname,
      label: typeof match.handle?.crumb === 'function' 
        ? match.handle.crumb(match.data)
        : match.handle?.crumb || '',
    }));
  
  if (crumbs.length <= 1) {
    return null;
  }
  
  return (
    <nav 
      aria-label="Breadcrumb" 
      className="mb-8"
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-white/80 to-gray-50/80 backdrop-blur-sm border border-gray-200/50 shadow-sm"
      >
        {/* Home icon */}
        <Link
          to="/admin"
          className="flex items-center gap-2 px-2 py-1 rounded-full text-gray-600 hover:text-[#D4A574] hover:bg-[#D4A574]/5 transition-all duration-200 group"
          aria-label="Admin Dashboard"
        >
          <Home className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
          <span className="hidden sm:inline text-sm font-medium">Dashboard</span>
        </Link>
        
        {/* Breadcrumb items */}
        {crumbs.slice(1).map((crumb, index) => {
          const isLast = index === crumbs.length - 2;
          
          return (
            <div key={crumb.pathname} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-gray-300" />
              
              {isLast ? (
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#D4A574]/10 to-[#C4956A]/10 text-[#D4A574] font-semibold text-sm">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.pathname}
                  className="px-2 py-1 rounded-full text-gray-600 hover:text-[#D4A574] hover:bg-[#D4A574]/5 transition-all duration-200 text-sm font-medium"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          );
        })}
      </motion.div>
    </nav>
  );
}

/**
 * Customer breadcrumbs - styled for customer dashboard
 */
export function CustomerBreadcrumbs(): JSX.Element | null {
  const matches = useMatches() as BreadcrumbMatch[];
  
  const crumbs = matches
    .filter((match) => match.handle?.crumb)
    .map((match) => ({
      pathname: match.pathname,
      label: typeof match.handle?.crumb === 'function' 
        ? match.handle.crumb(match.data)
        : match.handle?.crumb || '',
    }));
  
  if (crumbs.length <= 1) {
    return null;
  }
  
  return (
    <nav 
      aria-label="Breadcrumb" 
      className="mb-8"
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-white/80 to-gray-50/80 backdrop-blur-sm border border-gray-200/50 shadow-sm"
      >
        {/* Home icon */}
        <Link
          to="/customer"
          className="flex items-center gap-2 px-2 py-1 rounded-full text-gray-600 hover:text-[#D4A574] hover:bg-[#D4A574]/5 transition-all duration-200 group"
          aria-label="Customer Dashboard"
        >
          <Home className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
          <span className="hidden sm:inline text-sm font-medium">Dashboard</span>
        </Link>
        
        {/* Breadcrumb items */}
        {crumbs.slice(1).map((crumb, index) => {
          const isLast = index === crumbs.length - 2;
          
          return (
            <div key={crumb.pathname} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-gray-300" />
              
              {isLast ? (
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#D4A574]/10 to-[#C4956A]/10 text-[#D4A574] font-semibold text-sm">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.pathname}
                  className="px-2 py-1 rounded-full text-gray-600 hover:text-[#D4A574] hover:bg-[#D4A574]/5 transition-all duration-200 text-sm font-medium"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          );
        })}
      </motion.div>
    </nav>
  );
}

/**
 * Compact breadcrumbs - optimized for mobile/small screens
 */
export function CompactBreadcrumbs(): JSX.Element | null {
  const matches = useMatches() as BreadcrumbMatch[];
  
  const crumbs = matches
    .filter((match) => match.handle?.crumb)
    .map((match) => ({
      pathname: match.pathname,
      label: typeof match.handle?.crumb === 'function' 
        ? match.handle.crumb(match.data)
        : match.handle?.crumb || '',
    }));
  
  if (crumbs.length <= 1) {
    return null;
  }
  
  // Only show the last crumb on mobile for space
  const lastCrumb = crumbs[crumbs.length - 1];
  const parentCrumb = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;
  
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-sm"
      >
        {parentCrumb && (
          <>
            <Link
              to={parentCrumb.pathname}
              className="text-gray-500 hover:text-[#D4A574] transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          </>
        )}
        <span className="text-[#D4A574] font-semibold text-xs">
          {lastCrumb.label}
        </span>
      </motion.div>
    </nav>
  );
}
