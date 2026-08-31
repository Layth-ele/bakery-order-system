/**
 * PaymentReceivedSuccessModal - Admin successfully received and confirmed payment
 *
 * ✅ FEB 21, 2026: Updated to use success skin (skin system)
 * ✅ FEB 21, 2026: Standardized loading states
 * ✅ FEB 19, 2026: MOVED to /components/modals/payments/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 * ✅ MAR 13, 2026: Fixed to use Firebase layer directly
 */

import { useEffect, useState } from "react";
import { formatTimestamp, toDate } from '../../../utils/timestampFormatting';
import {
  CheckCircle,
  Download,
  ArrowRight,
  Package,
  Clock,
  User,
  DollarSign,
  Info,
} from "lucide-react";
import { Order, Product, Category } from "../../../types";
import { getOrders } from "../../../services/data/ordersDataService";
import { downloadOrderPDF } from "../../../utils/pdf";
import { formatCurrency } from "../../../utils/helpers"; // Using canonical formatCurrency
import { ModalThreeSections } from '../orders/ModalOrderSections';
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { ModalLoading } from "../../../ui/modals/ModalLoadingState";

interface PaymentReceivedSuccessModalProps {
  orderId: string;
  amount?: number;
  order?: Order;
  products?: Product[];
  categories?: Category[];
  onClose: () => void;
}

export function PaymentReceivedSuccessModal({
  orderId,
  amount,
  order: providedOrder,
  products: providedProducts,
  categories: providedCategories,
  onClose,
}: PaymentReceivedSuccessModalProps): JSX.Element | null {
  const [order, setOrder] = useState<Order | null>(
    providedOrder || null,
  );
  const [products, setProducts] = useState<Product[]>(
    providedProducts || [],
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(!providedOrder);

  // Load order data if not provided
  useEffect(() => {
    const loadOrderData = async () => {
      try {
        // Only show loading if we really need to fetch
        if (!providedOrder) setIsLoading(true);

        const orders = await getOrders();
        const foundOrder = orders.find((o) => o.id === orderId);

        if (foundOrder) {
          setOrder(foundOrder);
        }

        if (providedProducts) setProducts(providedProducts);
        if (providedCategories) setCategories(providedCategories);
      } catch (error) {
        console.error("Failed to load order data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrderData();
  }, [orderId, providedOrder]);

  const handleDownloadInvoice = () => {
    if (!order) {
      console.error(
        "Cannot download invoice: Order data not available",
      );
      return;
    }

    try {
      downloadOrderPDF(order, products, categories);
    } catch (error) {
      console.error("Failed to download invoice:", error);
    }
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="success"
      onClose={onClose}
      title="PAYMENT CONFIRMED"
      subtitle="Order payment received and confirmed"
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#D4A574] flex items-center justify-center shadow-lg">
          <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      }
      headerRight={
        <div className="flex items-center bg-black/20 rounded px-2 py-1 gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500 text-white text-xs font-bold uppercase shadow-md">
            <CheckCircle className="w-3 h-3" />
            Paid
          </span>
        </div>
      }
    >
      {isLoading && !order ? (
        <ModalLoading
          message="Compiling invoice data..."
        />
      ) : (
        <ModalThreeSections order={order!} products={products} summaryLabel="Amount Paid">
        </ModalThreeSections>
      )}
    </StyleModalShell>
  );
}