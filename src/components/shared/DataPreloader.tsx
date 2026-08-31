/**
 * DataPreloader
 *
 * Eagerly fetches ALL critical Firebase data immediately after the user
 * authenticates, so every page renders with data already in the TanStack
 * Query cache — no per-page loading spinners for the first visit.
 *
 * Strategy:
 *  1. Mounted inside AppProviders, after auth is confirmed
 *  2. Fires all queries in parallel (Promise.all) and WAITS for completion
 *  3. Stores results in TanStack Query cache via queryClient.setQueryData
 *  4. Shows a full-screen branded loader until ALL initial data fetches complete
 *  5. After first load the cache handles everything — subsequent navigations
 *     are instant
 *
 * Loads: Products, Categories, Settings, Orders (and Customers for admin users only)
 */

import { useEffect, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged } from '../../firebase/auth';
import { getOrders, getCustomers, getSettings } from '../../services/dataService';
import { getAll as getProducts } from '../../services/data/productsDataService';
import { getAllCategories } from '../../services/data/categoriesDataService';
import { getCustomerForAuth } from '../../services/customersService';
// FIX BUG 2: Import customer-filtered query so non-admin users only fetch their own orders
import { getOrdersByCustomer } from '../../firebase/firestore/orders';
import { Loader2 } from 'lucide-react';
import { logger } from '../../utils/logger';


interface DataPreloaderProps {
  children: ReactNode;
}

export function DataPreloader({ children }: DataPreloaderProps) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // ── Step 1: Wait for Firebase Auth to resolve ──────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  // ── Step 2: Once auth is known, prefetch all data ──────────────────────
  useEffect(() => {
    if (!authChecked) return;

    // Not logged in — show app immediately (login page doesn't need data)
    if (!user) {
      setReady(true);
      return;
    }

    let cancelled = false;

    async function prefetch() {
      try {
        // First, get the current user's customer data to check if they are an admin
        const currentUserCustomer = await getCustomerForAuth(user.uid);
        const isAdmin = currentUserCustomer?.customerType === 'admin';

        // Prepare the queries - only include customers for admin users.
        // Typed as Promise<unknown>[] so heterogeneous fetchQuery return types
        // (Order[], Product[], Settings, Category[], Customer[]) can coexist.
        const queries: Promise<unknown>[] = [
          queryClient.fetchQuery({
            queryKey: ['products'],
            queryFn: () => getProducts(),
            staleTime: 5 * 60 * 1000,
          }),
          queryClient.fetchQuery({
            queryKey: ['categories'],
            queryFn: () => getAllCategories(),
            staleTime: 5 * 60 * 1000,
          }),
          queryClient.fetchQuery({
            queryKey: ['settings'],
            queryFn: () => getSettings(),
            staleTime: 5 * 60 * 1000,
          }),
          // FIX BUG 2: Non-admin users fetch only their own orders.
          // Previously getOrders() (no filter) was used for everyone, loading ALL
          // orders from every customer into the browser cache.
          // Admins still use getOrders() — they need the full list.
          isAdmin
            ? queryClient.fetchQuery({
                queryKey: ['orders'],
                queryFn: () => getOrders(),
                staleTime: 30 * 1000,
              })
            : queryClient.fetchQuery({
                queryKey: ['orders', user.uid],
                queryFn: () => getOrdersByCustomer(user.uid),
                staleTime: 30 * 1000,
              }),
        ];

        // Only fetch customers for admin users
        if (isAdmin) {
          queries.push(
            queryClient.fetchQuery({
              queryKey: ['customers'],
              queryFn: () => getCustomers(),
              staleTime: 60 * 1000,
            })
          );
        }

        // Execute all queries in parallel
        await Promise.all(queries);

        if (!cancelled) setReady(true);
      } catch (err) {
        // If prefetch fails, still show the app — pages handle their own errors
        logger.warn('[DataPreloader] Prefetch failed, showing app anyway:', err);
        if (!cancelled) setReady(true);
      }
    }

    prefetch();
    return () => { cancelled = true; };
  }, [authChecked, user, queryClient]);

  // ── Step 3: Show branded loader until ready ────────────────────────────
  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-[#1a1a1a] to-black flex items-center justify-center">
        <div className="text-center">
          {/* Logo */}
          <div className="mb-8">
            <h1 className="text-3xl font-serif text-[#D4A574] tracking-[0.2em] mb-1">
              DELIGHT BAKEHOUSE
            </h1>
            <p className="text-[#8B6F47] text-xs tracking-[0.3em] uppercase">
              Wholesale Order Management
            </p>
          </div>

          {/* Spinner */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#D4A574]/20 to-[#B8935E]/20 border border-[#D4A574]/30 mb-6">
            <Loader2 className="w-8 h-8 animate-spin text-[#D4A574]" />
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#D4A574]/60 animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>

          <p className="text-gray-500 text-sm mt-4 tracking-wide">
            Loading your data…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
