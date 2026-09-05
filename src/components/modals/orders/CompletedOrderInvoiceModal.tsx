/**
 * CompletedOrderInvoiceModal - Final invoice view for COMPLETED orders
 *
 * ✅ FEB 21, 2026: Implemented based on PaidOrderDetailsModal
 * ✅ FEB 21, 2026: Added to modal registry (was placeholder)
 * ✅ Uses info skin for neutral professional appearance
 *
 * This modal displays the final invoice for completed orders that have been delivered.
 *
 * Features:
 * - Clean professional invoice layout
 * - Complete order details with items breakdown
 * - Delivery confirmation information
 * - Download options (Excel/PDF)
 * - Order summary with totals
 *
 * Use Case: View final invoice for completed orders in WeeklyInvoices, CustomerInvoices, and CompleteOrders pages
 */

import { useState, useEffect } from "react";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { ModalFooterButtons } from "../../../ui/modals/ModalFooterButtons";
import {FileText, Download, CheckCircle, DollarSign, Loader2} from "lucide-react"
import type { Order, Product, Category } from "../../../types";
import { formatOrderDateWithFallback } from "../../../services/calculators";
import { displayOrderNumber, displayInvoiceNumber } from '../../../utils/displayId';
import { ModalThreeSections } from './ModalOrderSections';
import { downloadCompleteOrderPDF } from '../../../utils/pdf';

interface CompletedOrderInvoiceModalProps {
  order: Order;
  products: Product[];
  categories: Category[];
  onClose: () => void;
  onDownloadExcel?: (order: Order) => void;
  onDownloadPDF?: (order: Order) => void;
}

export function CompletedOrderInvoiceModal({
  order,
  products: productsProp = [],
  categories: categoriesProp = [],
  onClose,
  onDownloadExcel,
  onDownloadPDF,
}: CompletedOrderInvoiceModalProps): JSX.Element | null {
  const orderTotal = order.total || 0;

  // Self-fetch products & categories if not provided (e.g. opened from notification)
  const [products,   setProducts]   = useState<Product[]>(productsProp);
  const [categories, setCategories] = useState<Category[]>(categoriesProp);
  const [fetchingData, setFetchingData] = useState(false);

  useEffect(() => {
    if (productsProp.length > 0) { setProducts(productsProp); return; }
    if (categoriesProp.length > 0) { setCategories(categoriesProp); return; }
    // Products/categories not supplied — fetch from cache.
    // RACE-CONDITION FIX: if the modal unmounts before the parallel fetches
    // complete, the cancelled flag prevents setState on an unmounted component.
    let cancelled = false;
    setFetchingData(true);
    Promise.all([
      import('../../../services/data/productsDataService').then(m => m.getAll()).catch((): Product[] => []),
      import('../../../firebase/firestore').then(m => m.getCategories()).catch((): Category[] => []),
    ]).then(([prods, cats]) => {
      if (cancelled) return;
      if ((prods as Product[]).length) setProducts(prods as Product[]);
      if ((cats as Category[]).length) setCategories(cats as Category[]);
    }).finally(() => { if (!cancelled) setFetchingData(false); });
    return () => { cancelled = true; };
  }, []);

  // Guaranteed PDF handler — uses real products/categories regardless of source
  const handlePDF = () => {
    if (onDownloadPDF && typeof onDownloadPDF === 'function') {
      // Check it's not a no-op stub (stubs are empty arrow functions)
      const src = onDownloadPDF.toString().trim();
      const isStub = src === '() => {}' || src === '()=>{}' || src.length < 15;
      if (!isStub) { onDownloadPDF(order); return; }
    }
    // Fallback: call PDF generator directly with our fetched data
    try {
      downloadCompleteOrderPDF(order, products, categories);
    } catch (e) {
      console.error('PDF generation failed:', e);
    }
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="info"
      onClose={onClose}
      title="INVOICE"
      subtitle={`#${displayInvoiceNumber(order)}`}
      headerLeft={
        <div className="icon-container-md bg-white/20 rounded-full backdrop-blur-sm">
          <FileText className="icon-modal-header text-white" />
        </div>
      }
      footer={
        <ModalFooterButtons
          leftAction={onDownloadExcel ? {
            label: "Excel",
            onClick: () => onDownloadExcel(order),
            variant: "success",
            icon: <Download className="w-4 h-4" />,
          } : undefined}
          cancelButton={{
            label: fetchingData ? "Generating..." : "Download PDF",
            onClick: handlePDF,
            variant: "danger",
            disabled: fetchingData,
            loading: fetchingData,
            icon: <Download className="w-4 h-4" />,
          }}
          confirmButton={{ label: "Close", onClick: onClose, variant: "primary" }}
        />
      }
    >
      {/* Completion Status Alert - compact */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 sm:p-4 mb-1">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 bg-green-600 rounded-full flex items-center justify-center">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-green-900 text-[11px] sm:text-xs">✅ Order Completed & Delivered</p>
            <p className="text-green-700 text-[10px] sm:text-xs mt-0.5">
              Completed on {formatOrderDateWithFallback(order.completedAt || order.updatedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice Information */}
      <div className="bg-[#FFF8F0] border border-[#E8C4A2] rounded-xl overflow-hidden mt-4">
        <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-[#E8C4A2]">
          <span className="text-[#D4A574]"><FileText className="w-4 h-4" /></span>
          <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#8B6F47]">
            Invoice Details
          </h3>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="text-[9px] sm:text-xs text-gray-500 mb-1">
                Invoice Number
              </p>
              <p className="text-[10px] sm:text-xs font-bold text-[#333333] font-mono break-all leading-tight">
                {displayInvoiceNumber(order)}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-1">
                Order Date
              </p>
              <p className="text-xs sm:text-sm text-[#333333] font-semibold">
                {formatOrderDateWithFallback(order.createdAt)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-1">
                Payment Status
              </p>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                <span className="text-xs sm:text-sm text-green-600 font-semibold">
                  Paid
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-1">
                Delivery Status
              </p>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                <span className="text-xs sm:text-sm text-green-600 font-semibold">
                  Delivered
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ModalThreeSections order={order} products={products} summaryLabel="Invoice Total">
      </ModalThreeSections>
</StyleModalShell>
  );
}