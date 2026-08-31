/**
 * ModalLoadingState - Standardized loading component for all modals
 *
 * ✅ FEB 21, 2026: Created for modal consistency project
 *
 * Provides consistent loading states across all modals:
 * - Full modal loading (when fetching data)
 * - Inline loading (when processing actions)
 * - Button loading (when submitting forms)
 *
 * Design: Luxury gold theme with professional animations
 */

import React from "react";
import { Loader2 } from "lucide-react";

// ============================================
// FULL MODAL LOADING STATE
// ============================================
// Use when modal is fetching initial data
interface ModalLoadingProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

export function ModalLoading({
  message = "Loading...",
  size = "md",
}: ModalLoadingProps): JSX.Element | null {
  const sizeClasses = {
    sm: "py-8",
    md: "py-12",
    lg: "py-16",
  };

  const spinnerSizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center ${sizeClasses[size]} space-y-4`}
    >
      <div
        className={`${spinnerSizes[size]} border-4 border-[#D4A574] border-t-transparent rounded-full animate-spin`}
      />
      <p className="text-neutral-500 font-bold uppercase text-[10px] tracking-widest">
        {message}
      </p>
    </div>
  );
}

// ============================================
// INLINE LOADING STATE
// ============================================
// Use for loading within a section of a modal
interface InlineLoadingProps {
  message?: string;
}

export function InlineLoading({
  message = "Loading...",
}: InlineLoadingProps): JSX.Element | null {
  return (
    <div className="flex items-center justify-center py-6 space-x-3">
      <div className="spinner-md border-[#D4A574] border-t-transparent rounded-full animate-spin" />
      <span className="body-sm text-neutral-600 font-medium">
        {message}
      </span>
    </div>
  );
}

// ============================================
// BUTTON LOADING STATE
// ============================================
// Use for button loading indicators (submit, process, etc.)
interface ButtonLoadingProps {
  message?: string;
  variant?: "light" | "dark";
}

export function ButtonLoading({
  message = "Processing...",
  variant = "light",
}: ButtonLoadingProps): JSX.Element | null {
  const borderColor =
    variant === "light"
      ? "border-white/30 border-t-white"
      : "border-[#D4A574]/30 border-t-[#D4A574]";

  return (
    <span className="flex items-center justify-center gap-2">
      <div
        className={`spinner-sm ${borderColor} rounded-full animate-spin`}
      />
      {message}
    </span>
  );
}

// ============================================
// SPINNER ICON ONLY
// ============================================
// Use for compact loading indicators
interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  color?: "gold" | "white" | "dark";
}

export function Spinner({
  size = "sm",
  color = "gold",
}: SpinnerProps): JSX.Element | null {
  const sizeClasses = {
    xs: "w-3 h-3 border-2",
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-3",
    lg: "w-8 h-8 border-4",
  };

  const colorClasses = {
    gold: "border-[#D4A574] border-t-transparent",
    white: "border-white border-t-transparent",
    dark: "border-neutral-700 border-t-transparent",
  };

  return (
    <div
      className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-spin`}
    />
  );
}

// ============================================
// LUCIDE ICON SPINNER
// ============================================
// Use Loader2 icon from lucide-react for alternative style
interface IconSpinnerProps {
  size?: number;
  className?: string;
}

export function IconSpinner({
  size = 20,
  className = "text-[#D4A574]",
}: IconSpinnerProps): JSX.Element | null {
  return (
    <Loader2
      className={`animate-spin ${className}`}
      size={size}
    />
  );
}

// ============================================
// SKELETON LOADER (with shimmer animation)
// ============================================
// Use for content placeholders while loading
interface SkeletonProps {
  lines?: number;
  className?: string;
}

export function Skeleton({
  lines = 3,
  className = "",
}: SkeletonProps): JSX.Element | null {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 shimmer rounded"
            style={{
              width: i === lines - 1 ? "80%" : "100%",
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// 1. FULL MODAL LOADING (fetching initial data)
if (loading) {
  return (
    <StyleModalShell title="Order Details" onClose={onClose}>
      <ModalLoading message="Loading order details..." size="md" />
    </StyleModalShell>
  );
}

// 2. INLINE LOADING (loading section data)
{loading && <InlineLoading message="Fetching customer data..." />}

// 3. BUTTON LOADING (submitting form)
<button disabled={submitting}>
  {submitting ? <ButtonLoading message="Saving..." /> : 'Save Order'}
</button>

// 4. SPINNER ONLY (compact indicator)
{processing && <Spinner size="sm" color="gold" />}

// 5. ICON SPINNER (lucide alternative)
{loading && <IconSpinner size={24} className="text-blue-500" />}

// 6. SKELETON LOADER (content placeholder)
{loading ? <Skeleton lines={5} /> : <Content />}
*/