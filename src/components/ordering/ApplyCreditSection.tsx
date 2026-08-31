/**
 * Apply Credit Section
 *
 * Allows customers to apply available credit to their order during checkout.
 * Shows in OrderSummaryPanel — hidden entirely when no credit is available.
 *
 * ✅ Uses useCachedCreditBalance (TanStack Query)
 * ✅ Hidden when availableCredit <= 0
 */

import { useState, useEffect } from 'react';
import { DollarSign, Info, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { toDate } from '../../utils/timestampFormatting';
import { formatCreditAmount, getAllCreditNotes } from '../../services/creditService';
import { useCachedCreditBalance } from '../../hooks/useCachedFirebase';

interface ApplyCreditSectionProps {
  customerId: string;
  orderTotal: number;
  onCreditChange: (creditAmount: number, shouldApply: boolean) => void;
}

export function ApplyCreditSection({
  customerId,
  orderTotal,
  onCreditChange,
}: ApplyCreditSectionProps): JSX.Element | null {
  const [applyCreditEnabled, setApplyCreditEnabled] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);

  const { data: availableCredit = 0 } = useCachedCreditBalance(customerId, {
    refetchInterval: 30_000,
  });

  const creditToApply = Math.min(availableCredit, orderTotal);

  // Notify parent
  useEffect(() => {
    onCreditChange(applyCreditEnabled ? creditToApply : 0, applyCreditEnabled);
  }, [applyCreditEnabled, creditToApply]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-disable if credit removed
  useEffect(() => {
    if (availableCredit <= 0 && applyCreditEnabled) {
      setApplyCreditEnabled(false);
    }
  }, [availableCredit, applyCreditEnabled]);

  // Lazy-load note details
  useEffect(() => {
    if (!showDetails) return;
    getAllCreditNotes(customerId)
      .then(notes =>
        setCreditNotes(
          notes
            .filter(n => n.status === 'available' || n.status === 'partially_used')
            .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))
        )
      )
      .catch(() => setCreditNotes([]));
  }, [showDetails, customerId]);

  // Hidden when no credit
  if (availableCredit <= 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-[#D4A574]/30">
      {/* Main credit card */}
      <div
        className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${
          applyCreditEnabled
            ? 'border-[#D4A574] bg-gradient-to-br from-[#FFF8EC] to-[#FFF3DC] shadow-md'
            : 'border-[#D4A574]/40 bg-gradient-to-br from-[#FDFAF5] to-[#FAF5EC]'
        }`}
      >
        {/* Header row */}
        <div className="flex items-center gap-3 p-3">
          {/* Icon */}
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
              applyCreditEnabled
                ? 'bg-gradient-to-br from-[#D4A574] to-[#C89968] shadow-sm'
                : 'bg-[#D4A574]/20'
            }`}
          >
            <DollarSign className={`w-4 h-4 ${applyCreditEnabled ? 'text-white' : 'text-[#8B6F47]'}`} />
          </div>

          {/* Label + balance */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#4A3728] leading-tight">
              Use Store Credit
            </p>
            <p className="text-xs text-[#8B6F47] font-medium mt-0.5">
              <span className="font-bold text-[#6B5030]">{formatCreditAmount(availableCredit)}</span>
              {' '}available
              {applyCreditEnabled && creditToApply > 0 && (
                <span className="ml-1 text-green-700">
                  · saving {formatCreditAmount(creditToApply)}
                </span>
              )}
            </p>
          </div>

          {/* Info toggle */}
          <button
            onClick={() => setShowDetails(v => !v)}
            className="text-[#D4A574]/60 hover:text-[#8B6F47] transition-colors p-1 rounded flex-shrink-0"
            aria-label="Show credit details"
          >
            {showDetails ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Toggle switch */}
          <button
            onClick={() => setApplyCreditEnabled(v => !v)}
            role="switch"
            aria-checked={applyCreditEnabled}
            aria-label="Apply credit to order"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50 focus:ring-offset-2 flex-shrink-0 ${
              applyCreditEnabled
                ? 'bg-gradient-to-r from-[#D4A574] to-[#C89968]'
                : 'bg-neutral-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                applyCreditEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Applied summary bar */}
        {applyCreditEnabled && creditToApply > 0 && (
          <div className="mx-3 mb-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-green-700">Credit applied to order</span>
            </div>
            <span className="text-sm font-bold text-green-700">
              −{formatCreditAmount(creditToApply)}
            </span>
          </div>
        )}

        {/* Expandable details */}
        {showDetails && (
          <div className="border-t border-[#D4A574]/20 bg-white/60 px-3 py-3 space-y-2">
            <p className="text-[10px] font-bold text-[#8B6F47] uppercase tracking-widest mb-1">
              Credit Notes
            </p>

            {creditNotes.length === 0 ? (
              <p className="text-xs text-neutral-400 italic">Loading notes…</p>
            ) : (
              <>
                {creditNotes.slice(0, 3).map(note => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between bg-white border border-[#D4A574]/30 rounded-lg px-3 py-2 gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#4A3728] truncate">
                        {note.creditNoteNumber || note.id}
                      </p>
                      <p className="text-[10px] text-neutral-500">
                        {(toDate(note.createdAt) ?? new Date()).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-[#8B6F47] flex-shrink-0">
                      {formatCreditAmount(note.remainingBalance ?? note.amount ?? 0)}
                    </span>
                  </div>
                ))}
                {creditNotes.length > 3 && (
                  <p className="text-xs text-neutral-500 italic pl-1">
                    +{creditNotes.length - 3} more credit note{creditNotes.length - 3 !== 1 ? 's' : ''}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
