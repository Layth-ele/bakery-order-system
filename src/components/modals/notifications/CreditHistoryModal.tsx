import type { CreditNote } from '../../../types';
import { toDate } from '../../../utils/timestampFormatting';
/**
 * CreditHistoryModal - Shows customer's credit balance and usage history
 *
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ MAR 14, 2026: Integrated with Firebase - all data now fetched from Firestore
 */

import { toast } from 'sonner';
import { useState, useMemo } from "react";
import {
  requestCreditPayout,
  formatCreditAmount,
} from "../../../services/creditService";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { CloseFooter } from "../../../ui/modals/ModalFooterButtons";
import {
  Wallet,
  DollarSign,
  Package,
  Calendar,
  FileText,
  Clock,
  Download,
  Receipt,
  TrendingDown,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface CreditHistoryModalProps {
  customerId: string;
  onClose: () => void;
}

interface CreditApplication {
  creditNoteId: string;
  orderId: string;
  amount: number;
  appliedAt: string;
}

export function CreditHistoryModal({
  customerId,
  onClose,
}: CreditHistoryModalProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<
    "available" | "history" | "stats"
  >("available");
  const [isRequesting, setIsRequesting] = useState<
    string | null
  >(null);

 // Fetch credit notes from Firebase
  const { data: creditNotes = [], isLoading, error } = useQuery<CreditNote[]>({
    queryKey: ['creditNotes', customerId, 'history'],
    queryFn: async () => {
      const { getCreditNotes } = await import('../../../firebase/firestore');
      const notes = await getCreditNotes(customerId);
      return notes;
    },
    // ✅ initialData ensures data is always CreditNote[] (never undefined)
    initialData: [] as CreditNote[],
    enabled: !!customerId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // ✅ Calculate credit summary from Firebase data
  const creditSummary = useMemo(() => {
    const availableCredit = creditNotes
      .filter((note: CreditNote) => note.status === 'available' || note.status === 'partially_used')
      .reduce((sum: number, note: CreditNote) => sum + (note.remainingBalance ?? (note.amount ?? 0)), 0);

    const totalEarned = creditNotes.reduce((sum: number, note: CreditNote) => sum + (note.amount ?? 0), 0);
    
    const totalUsed = creditNotes.reduce((sum: number, note: CreditNote) => {
      const balance = note.remainingBalance ?? (note.amount ?? 0);
      return sum + ((note.amount ?? 0) - balance);
    }, 0);

    return {
      availableCredit,
      totalEarned,
      totalUsed,
      creditNotes,
    };
  }, [creditNotes]);

  // ✅ Calculate application history from credit notes
  const applicationHistory = useMemo(() => {
    // Extract applications from credit notes that have been used
    const applications: CreditApplication[] = [];
    
    creditNotes.forEach((note: CreditNote) => {
      const used = (note.amount ?? 0) - (note.remainingBalance ?? (note.amount ?? 0));
      if (used > 0) {
        applications.push({
          creditNoteId: note.id,
          orderId: note.orderId || "",
          amount: used,
          appliedAt: toDate(note.createdAt)?.toISOString() || "",
        });
      }
    });

    return applications.sort((a, b) => 
      (toDate(b.appliedAt)?.getTime() ?? 0) - (toDate(a.appliedAt)?.getTime() ?? 0)
    );
  }, [creditNotes]);

  // ✅ Calculate usage report statistics
  const usageReport = useMemo(() => {
    const totalCreditGenerated = creditSummary.totalEarned;
    const totalCreditUsed = creditSummary.totalUsed;
    const totalCreditRemaining = creditSummary.availableCredit;
    
    const ordersWithCreditApplied = new Set(
      applicationHistory.map((app) => app.orderId)
    ).size;
    
    const creditNoteCount = creditNotes.length;
    const fullyUsedCreditNotes = creditNotes.filter(
      (note) => note.status === 'fully_used'
    ).length;
    const partiallyUsedCreditNotes = creditNotes.filter(
      (note) => note.status === 'partially_used'
    ).length;
    const availableCreditNotes = creditNotes.filter(
      (note) => note.status === 'available'
    ).length;

    return {
      totalCreditGenerated,
      totalCreditUsed,
      totalCreditRemaining,
      ordersWithCreditApplied,
      creditNoteCount,
      fullyUsedCreditNotes,
      partiallyUsedCreditNotes,
      availableCreditNotes,
    };
  }, [creditNotes, creditSummary, applicationHistory]);

 // Fixed to use correct parameters and Firebase integration
  const handleRequestPayout = async (creditNoteId: string) => {
    setIsRequesting(creditNoteId);
    try {
      
      // ✅ Use customerId prop and creditNoteId parameter (no extraction needed)
      await requestCreditPayout(customerId, creditNoteId);
      
      toast.success(
        "Payout request submitted! Admin will process within 3-7 business days.",
      );
      
    } catch (error) {
      console.error('❌ [CreditHistoryModal] Payout request failed:', error);
      toast.error((error as any).message || "Failed to request payout");
    } finally {
      setIsRequesting(null);
    }
  };

  // ✅ Show loading state
  if (isLoading) {
    return (
      <StyleModalShell
        width="4xl"
        skinType="default"
        onClose={onClose}
        title="CREDIT HISTORY"
        subtitle="Loading..."
        headerLeft={
          <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-[#333333]" />
        }
      >
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4A574]"></div>
        </div>
        <CloseFooter onClose={onClose} />
      </StyleModalShell>
    );
  }

  // ✅ Show error state
  if (error) {
    return (
      <StyleModalShell
        onClose={onClose}
        title="CREDIT HISTORY"
        subtitle="Error loading data"
        width="4xl"
        headerLeft={
          <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-[#333333]" />
        }
      >
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 font-medium mb-2">Failed to load credit history</p>
          <p className="text-sm text-red-500">{(error as Error).message}</p>
        </div>
        <CloseFooter onClose={onClose} />
      </StyleModalShell>
    );
  }

  if (!creditSummary) return null;

  return (
    <StyleModalShell
      onClose={onClose}
      title="CREDIT HISTORY"
      subtitle={`${formatCreditAmount(creditSummary.availableCredit)} Available`}
      width="4xl"
      headerLeft={
        <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-[#333333]" />
      }
    >
      {/* Credit Summary Card */}
      <section className="bg-white rounded-xl p-5 border border-neutral-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-neutral-100 pb-2">
          <DollarSign className="size-4 text-[#D4A574]" />
          <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider">
            Current Balance
          </h3>
        </div>
        <div className="bg-gradient-to-br from-[#D4A574]/10 to-[#8B6F47]/10 border-2 border-[#D4A574] rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 mb-1">
                Available Credit
              </p>
              <p className="text-2xl font-bold text-[#D4A574]">
                {formatCreditAmount(
                  creditSummary.availableCredit,
                )}
              </p>
              <p className="text-xs text-neutral-500 mt-2">
                {creditSummary.creditNotes.length} credit note
                {creditSummary.creditNotes.length !== 1
                  ? "s"
                  : ""}
              </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#D4A574] flex items-center justify-center">
              <Wallet className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="bg-white rounded-xl p-5 border border-neutral-200 shadow-sm mt-6">
        <div className="flex gap-2 border-b border-neutral-100 pb-3">
          <button
            onClick={() => setActiveTab("available")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "available"
                ? "bg-[#D4A574] text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Available Credits
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "bg-[#D4A574] text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Usage History
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "stats"
                ? "bg-[#D4A574] text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Statistics
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {/* Available Credits Tab */}
          {activeTab === "available" && (
            <div className="space-y-4">
              {creditSummary.creditNotes.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-neutral-500 font-medium">
                    No available credit notes
                  </p>
                  <p className="text-sm text-neutral-400 mt-1">
                    Credits from order changes will appear here
                  </p>
                </div>
              ) : (
                creditSummary.creditNotes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 hover:border-[#D4A574]/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-sm font-bold text-neutral-800">
                            {note.id}
                          </span>
                          {note.status === "fully_used" && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full font-medium">
                              Fully Used
                            </span>
                          )}
                          {note.status === "partially_used" && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                              Partially Used
                            </span>
                          )}
                          {note.status === "available" && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                              Available
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-neutral-600">
                          <div className="flex items-center gap-2">
                            <Package className="size-3 text-neutral-400" />
                            <span className="font-medium">
                              Order:
                            </span>
                            <span className="font-mono">
                              {note.sourceOrderId}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="size-3 text-neutral-400" />
                            <span className="font-medium">
                              Created:
                            </span>
                            <span>
                              {(toDate(note.createdAt) ?? new Date()).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="size-3 text-neutral-400" />
                            <span className="font-medium">
                              Type:
                            </span>
                            <span className="capitalize">
                              {note.type}
                            </span>
                          </div>
                        </div>
                        {note.reason && (
                          <p className="text-xs text-neutral-500 italic mt-2 bg-white p-2 rounded border border-neutral-200">
                            Reason: {note.reason}
                          </p>
                        )}
                      </div>

                      <div className="text-right ml-4">
                        <p className="text-xs text-neutral-500 mb-1">
                          Remaining
                        </p>
                        <p className="text-2xl font-bold text-[#D4A574]">
                          {formatCreditAmount(
                            note.remainingBalance,
                          )}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                          of {formatCreditAmount((note.amount ?? 0))}
                        </p>
                      </div>
                    </div>

                    {/* Payout option */}
                    {note.remainingBalance > 0 &&
                      !note.payoutRequested && (
                        <div className="mt-3 pt-3 border-t border-neutral-200">
                          <button
                            onClick={() =>
                              handleRequestPayout(note.id)
                            }
                            disabled={isRequesting === note.id}
                            className="w-full px-4 py-2.5 bg-[#D4A574] text-white rounded-lg hover:bg-[#B8935E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold flex items-center justify-center gap-2"
                          >
                            {isRequesting === note.id ? (
                              <>
                                <Clock className="w-4 h-4 animate-spin" />
                                Requesting...
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" />
                                Request Cash Payout (3-7
                                business days)
                              </>
                            )}
                          </button>
                        </div>
                      )}

                    {note.payoutRequested && (
                      <div className="mt-3 pt-3 border-t border-neutral-200">
                        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">
                            Payout requested - Processing within
                            3-7 business days
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Usage History Tab */}
          {activeTab === "history" && (
            <div className="space-y-4">
              {applicationHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-neutral-500 font-medium">
                    No credit applications yet
                  </p>
                  <p className="text-sm text-neutral-400 mt-1">
                    Credits will appear here when applied to
                    orders
                  </p>
                </div>
              ) : (
                applicationHistory.map((application) => (
                  <div
                    key={`${application.creditNoteId}-${application.appliedAt}`}
                    className="bg-neutral-50 rounded-lg p-4 border border-neutral-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingDown className="w-4 h-4 text-green-600" />
                          <span className="font-semibold text-neutral-800">
                            Credit Applied
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500">
                          {(toDate(application.appliedAt) ?? new Date()).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        -
                        {formatCreditAmount(application.amount)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3 rounded border border-neutral-200">
                      <div>
                        <span className="text-neutral-500">
                          Credit Note:{" "}
                        </span>
                        <span className="font-mono font-semibold text-[#D4A574]">
                          {application.creditNoteId || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500">
                          Order:{" "}
                        </span>
                        <span className="font-mono font-semibold text-neutral-800">
                          {application.orderId}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === "stats" && usageReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                  <p className="text-xs text-blue-700 font-bold uppercase tracking-wider mb-2">
                    Total Generated
                  </p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCreditAmount(
                      usageReport.totalCreditGenerated,
                    )}
                  </p>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <p className="text-xs text-green-700 font-bold uppercase tracking-wider mb-2">
                    Total Used
                  </p>
                  <p className="text-2xl font-bold text-green-900">
                    {formatCreditAmount(
                      usageReport.totalCreditUsed,
                    )}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-[#D4A574]/20 to-[#8B6F47]/10 rounded-lg p-4 border-2 border-[#D4A574]">
                  <p className="text-xs text-[#8B6F47] font-bold uppercase tracking-wider mb-2">
                    Remaining Balance
                  </p>
                  <p className="text-2xl font-bold text-neutral-900">
                    {formatCreditAmount(
                      usageReport.totalCreditRemaining,
                    )}
                  </p>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                  <p className="text-xs text-purple-700 font-bold uppercase tracking-wider mb-2">
                    Orders with Credit
                  </p>
                  <p className="text-2xl font-bold text-purple-900">
                    {usageReport.ordersWithCreditApplied}
                  </p>
                </div>
              </div>

              <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                <h3 className="font-bold text-neutral-800 mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                  <FileText className="size-4 text-[#D4A574]" />
                  Credit Notes Breakdown
                </h3>
                <div className="space-y-3 bg-white p-4 rounded border border-neutral-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">
                      Total Credit Notes
                    </span>
                    <span className="font-bold text-neutral-900">
                      {usageReport.creditNoteCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">
                      Fully Used
                    </span>
                    <span className="font-bold text-green-600">
                      {usageReport.fullyUsedCreditNotes}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">
                      Partially Used
                    </span>
                    <span className="font-bold text-amber-600">
                      {usageReport.partiallyUsedCreditNotes}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">
                      Available
                    </span>
                    <span className="font-bold text-blue-600">
                      {usageReport.availableCreditNotes}
                    </span>
                  </div>
                </div>
              </div>

              {/* Download Report */}
              <button
                onClick={() => {
                  // In a real app, this would generate and download a PDF/CSV
                  toast.info(
                    "Report download feature coming soon!",
                  );
                }}
                className="w-full px-4 py-3 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Credit Report
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Close Footer */}
      <CloseFooter onClose={onClose} />
    </StyleModalShell>
  );
}