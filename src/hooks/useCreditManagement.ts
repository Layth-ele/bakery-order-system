/**
 * useCreditManagement.ts
 * ✅ PHASE 3 APPROVED: UI State Management (Acceptable Pattern)
 * 
 * PURPOSE:
 * - Manage credit application UI state
 * - Coordinate credit availability with service
 * - Calculate final total with credit applied
 * 
 * STATUS: ✅ GOOD - Minimal business logic, delegates to creditService
 * 
 * RESPONSIBILITIES:
 * - ✅ UI state (applyCreditEnabled, creditToApply)
 * - ✅ Service delegation (getAvailableCredit)
 * - ✅ Simple calculations (finalTotal) - acceptable for UI
 * 
 * Version: 2.0.0 - Reviewed March 8, 2026
 */

import { useState, useEffect, useCallback } from 'react';
import { getAvailableCredit } from '../services/creditService';

interface UseCreditManagementProps {
  customerId: string;
  baseTotal: number;
}

interface UseCreditManagementReturn {
  applyCreditEnabled: boolean;
  creditToApply: number;
  availableCredit: number;
  finalTotal: number;
  handleCreditChange: (creditAmount: number, shouldApply: boolean) => void;
  resetCredit: () => void;
}

export function useCreditManagement({
  customerId,
  baseTotal,
}: UseCreditManagementProps): UseCreditManagementReturn {
  const [applyCreditEnabled, setApplyCreditEnabled] = useState<boolean>(false);
  const [creditToApply, setCreditToApply] = useState<number>(0);
  const [availableCredit, setAvailableCredit] = useState<number>(0);

  // Load available credit on mount and when customerId changes
  useEffect(() => {
    getAvailableCredit(customerId).then(setAvailableCredit).catch(() => setAvailableCredit(0));
  }, [customerId]);

  // Calculate final total with credit applied
  const finalTotal = applyCreditEnabled
    ? Math.max(0, baseTotal - creditToApply)
    : baseTotal;

  // Handle credit change
  const handleCreditChange = useCallback(
    (creditAmount: number, shouldApply: boolean) => {
      setApplyCreditEnabled(shouldApply);
      setCreditToApply(creditAmount);
    },
    []
  );

  // Reset credit state
  const resetCredit = useCallback(() => {
    setApplyCreditEnabled(false);
    setCreditToApply(0);
    getAvailableCredit(customerId).then(setAvailableCredit).catch(() => setAvailableCredit(0));
  }, [customerId]);

  return {
    applyCreditEnabled,
    creditToApply,
    availableCredit,
    finalTotal,
    handleCreditChange,
    resetCredit,
  };
}