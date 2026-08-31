import type { CreditNote } from '../../../types';
/**
 * CreditReceivedModal - Shows confetti animation and credit details
 *
 * ✅ FIX: Replaced TanStack Query with direct async fetch + retry loop
 *    to avoid the race condition where the modal opens before the credit
 *    note is visible in Firestore (staleTime:0 is not enough — the query
 *    key might have a cached empty result from a previous render cycle).
 * ✅ FIX: Auto-opens on login if unread credit notifications exist
 */

import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { CloseFooter } from "../../../ui/modals/ModalFooterButtons";
import { Wallet, ArrowRight, Sparkles } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { formatCreditAmount } from "../../../services/creditService";
import { toDate } from '../../../utils/timestampFormatting';

interface CreditReceivedModalProps {
  customerId: string;
  onClose: () => void;
  onViewCredit: () => void;
}

export function CreditReceivedModal({
  customerId,
  onClose,
  onViewCredit,
}: CreditReceivedModalProps): JSX.Element | null {
  const [showConfetti, setShowConfetti] = useState(true);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const retryRef = useRef(0);
  const maxRetries = 5;

  // Direct fetch with retry — bypasses TanStack Query cache entirely
  // Retries up to 5 times with 800ms spacing to wait for Firestore commit
  useEffect(() => {
    if (!customerId) { setIsLoading(false); return; }

    let cancelled = false;

    async function fetchWithRetry() {
      const { getCreditNotes } = await import('../../../firebase/firestore');

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (cancelled) return;

        // Wait before retry (not on first attempt)
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, 800));
        }

        try {
          const notes = await getCreditNotes(customerId);
          if (cancelled) return;

          // Sort newest first
          const sorted = [...notes].sort((a, b) => {
            const da = toDate(a.createdAt)?.getTime() ?? 0;
            const db = toDate(b.createdAt)?.getTime() ?? 0;
            return db - da;
          });

          // Filter to credits created in the last 7 days (generous window for delayed logins)
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const recent = sorted.filter(note => {
            const d = toDate(note.createdAt) ?? new Date();
            return d > sevenDaysAgo;
          });

          // If we found recent credits OR exhausted retries, stop
          if (recent.length > 0 || attempt === maxRetries) {
            // Use recent credits; if none, fall back to most recent 3 overall
            setCreditNotes(recent.length > 0 ? recent : sorted.slice(0, 3));
            setIsLoading(false);
            return;
          }
          // Otherwise retry — credit note not yet visible
          retryRef.current = attempt + 1;
        } catch {
          if (attempt === maxRetries) setIsLoading(false);
        }
      }
    }

    fetchWithRetry();
    return () => { cancelled = true; };
  }, [customerId]);

  useEffect(() => {
    setTimeout(() => setShowConfetti(false), 3000);
  }, []);

  const totalNewCredit = creditNotes.reduce(
    (sum, note) => sum + (note.amount ?? 0),
    0,
  );

  const formatDate = (timestamp: any) => {
    const date = toDate(timestamp) ?? new Date();
    return date.toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <StyleModalShell
        width="4xl"
        skinType="success"
        onClose={onClose}
        title="🎉 Congratulations! 🎉"
        subtitle="Loading credit details..."
        icon={
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4A574] to-[#FFD700] flex items-center justify-center shadow-2xl">
            <Wallet className="w-6 h-6 text-white" />
          </div>
        }
      >
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4A574]" />
          <p className="text-sm text-gray-500">Fetching your credit...</p>
        </div>
      </StyleModalShell>
    );
  }

  return (
    <>
      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[10001]">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: "-10%",
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: ["#D4A574","#FFD700","#FF9800","#4CAF50","#2196F3"][
                    Math.floor(Math.random() * 5)
                  ],
                }}
              />
            </div>
          ))}
        </div>
      )}

      <StyleModalShell
        onClose={onClose}
        title="🎉 Congratulations! 🎉"
        subtitle="You've received credit!"
        icon={
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4A574] to-[#FFD700] flex items-center justify-center animate-bounce shadow-2xl">
            <Wallet className="w-6 h-6 text-white" />
          </div>
        }
        width="4xl"
        footer={
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={onViewCredit}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#D4A574] to-[#FFD700] text-white rounded-lg hover:from-[#C49563] hover:to-[#E5C100] transition-all shadow-lg font-bold text-sm group"
            >
              <span>View History</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <CloseFooter onClose={onClose} />
          </div>
        }
      >
        <div className="relative bg-gradient-to-br from-white via-[#FFF8F0] to-[#FFE4C4] rounded-lg p-4 -m-6 mb-0">
          <div className="relative space-y-4">
            {/* Hero amount */}
            <div className="bg-gradient-to-r from-[#D4A574] to-[#FFD700] rounded-xl p-4 shadow-xl border-2 border-white">
              <div className="text-xs text-white/90 mb-1 font-medium uppercase tracking-wider">
                Total Credit Received
              </div>
              <div className="text-3xl font-bold text-white mb-1 tracking-tight">
                ${totalNewCredit.toFixed(2)}
              </div>
              <div className="text-xs text-white/80">💳 Available now in your account</div>
            </div>

            {/* Individual credit notes */}
            {creditNotes.length > 0 && (
              <div className="space-y-2">
                {creditNotes.map((note) => {
                  const displayAmount = note.remainingBalance ?? note.amount ?? 0;
                  const creditType = note.type || 'refund';
                  const displayType =
                    creditType === 'refund' ? '💚 Order Refund'
                    : creditType === 'admin_edit' ? '🎁 Manual Credit'
                    : creditType === 'overpayment' ? '💳 Overpayment'
                    : '💰 Credit';
                  return (
                    <div key={note.id} className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-[#E8C4A2]">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">{displayType}</div>
                          <div className="text-lg font-bold text-[#D4A574]">{formatCreditAmount(displayAmount)}</div>
                        </div>
                        <div className="text-xs text-gray-500 text-right">{formatDate(note.createdAt)}</div>
                      </div>
                      {note.reason && (
                        <div className="text-xs text-gray-700 bg-[#FFF8F0] rounded p-2 border border-[#E8C4A2]">
                          <span className="font-semibold text-[#D4A574]">Reason: </span>{note.reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Info box */}
            <div className="bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] rounded-lg p-3 border border-[#4CAF50]">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-[#4CAF50] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-800">
                  <p className="font-semibold mb-1 text-[#4CAF50]">✓ How to Use:</p>
                  <ul className="space-y-0.5 opacity-80">
                    <li>• Applied automatically to next order</li>
                    <li>• Check history anytime in Outstanding tab</li>
                    <li>• Never expires</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </StyleModalShell>

      <style>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti { animation: confetti linear forwards; }
      `}</style>
    </>
  );
}

export default CreditReceivedModal;
