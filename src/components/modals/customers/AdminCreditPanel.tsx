/**
 * Admin → customer profile: the customer's store credit and any payout
 * requests. Balances use the same rule as everywhere else: credit reserved
 * for a payout isn't spendable (creditService.getAvailableCredit).
 */
import { useCallback, useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { getAllCreditNotes } from '../../../services/creditService';
import { callableErrorMessage, resolveCreditPayoutViaCloudFunction } from '../../../services/firebase/cloudFunctions';
import { invalidateCache } from '../../../hooks/useCachedFirebase';
import type { CreditNote } from '../../../types';

const money = (n: number) => `$${n.toFixed(2)}`;
const balanceOf = (n: CreditNote) => Number(n.remainingBalance ?? n.amount ?? 0) || 0;
const isOpen = (n: CreditNote) => n.status === 'available' || n.status === 'partially_used';

export function AdminCreditPanel({ customerId }: { customerId: string }) {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setNotes(await getAllCreditNotes(customerId).catch(() => []));
  }, [customerId]);
  useEffect(() => { load(); }, [load]);

  const open = notes.filter(isOpen);
  const available = open.filter((n) => !n.payoutRequested).reduce((s, n) => s + balanceOf(n), 0);
  const requests = open.filter((n) => n.payoutRequested);

  const resolve = async (note: CreditNote, outcome: 'paid' | 'declined') => {
    setBusy(note.id);
    try {
      const r = await resolveCreditPayoutViaCloudFunction({ creditNoteId: note.id, outcome });
      toast.success(outcome === 'paid' ? `${money(r.amount)} marked as paid out` : 'Payout declined — the credit is spendable again');
      await Promise.all([load(), invalidateCache.credit(customerId)]);
    } catch (error) {
      toast.error(callableErrorMessage(error, outcome === 'paid' ? 'mark the payout as paid' : 'decline the payout'));
    } finally {
      setBusy(null);
    }
  };

  if (open.length === 0) return null;
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Account Credits</h3>
      <div className="bg-gradient-to-r from-[#D4A574]/10 to-[#C5A028]/10 border border-[#D4A574]/20 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#D4A574]" />
            <span className="font-semibold text-gray-900 text-sm">Available to spend</span>
          </div>
          <span className="text-xl font-bold text-[#D4A574]">{money(available)}</span>
        </div>
      </div>
      {requests.map((n) => (
        <div key={n.id} className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-sm text-amber-900">
            <strong>Payout requested:</strong> {money(balanceOf(n))}
            {n.creditNoteNumber ? <span className="text-amber-700"> · {n.creditNoteNumber}</span> : null}
          </p>
          <p className="text-xs text-amber-800 mt-1">Send the money (e.g. e-transfer), then mark it paid. Declining puts the credit back on the account.</p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              disabled={busy === n.id}
              onClick={() => resolve(n, 'paid')}
              className="flex-1 min-h-[40px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              Mark paid
            </button>
            <button
              type="button"
              disabled={busy === n.id}
              onClick={() => resolve(n, 'declined')}
              className="flex-1 min-h-[40px] rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-800 text-xs font-semibold disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
