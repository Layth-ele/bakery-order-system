import { toDate } from '../../utils/timestampFormatting';
/**
 * OrderRow Component
 * 
 * Displays a single order with all its details, badges, and action buttons
 * ✅ MARCH 10, 2026: Refactored to use orderDisplayHelpers service
 */

import { User, ExternalLink } from 'lucide-react';
import { OrderStatusBadge } from './OrderStatusBadge';
import { OrderActionButtons } from './OrderActionButtons';
import { formatOrderDate, formatOrderTimestamp, formatDiscountPercentage, formatOrderDateWithFallback } from '../../services/calculators';
import { formatCurrency } from '../../utils/helpers';
import { useModal } from '../../contexts/ModalContextNew';
import type { Order } from '../../types';
import type { ActionButtonSection } from './UnifiedOrderList';

// ✅ MARCH 10, 2026: Import business logic from service
import {
  shouldShowReprintBadge,
  computeWeekRange,
  getProductCount,
  getTotalQuantity,
} from '../../services/orders/orderDisplayHelpers';
import { displayOrderNumber, displayInvoiceNumber, displayOrderLabel, invoiceFilename, orderFilename } from '../../utils/displayId';

interface OrderRowProps {
  order: Order;
  actionButtonSections: ActionButtonSection[];
  products?: any[]; // optional - passed by VirtualizedOrderList
  categories?: any[]; // optional - passed by VirtualizedOrderList
  showApprovedBy?: boolean;
  showRejectedInfo?: boolean;
  showCancelledInfo?: boolean;
  showCompletedInfo?: boolean;
  showUpdateRequested?: boolean;
  hideCustomerName?: boolean;
  isAdmin?: boolean;
  isMobileLayout?: boolean;
  useCardLayout?: boolean; // New prop for the card-style layout
  useCompactLayout?: boolean; // NEW: Compact layout like AdminUnpaidOrders
  renderExtra?: (order: Order) => React.ReactNode; // ✅ NEW: Render custom content for each order (e.g., lifecycle timer)
}

export function OrderRow({
  order,
  actionButtonSections,
  showApprovedBy = false,
  showRejectedInfo = false,
  showCancelledInfo = false,
  showCompletedInfo = false,
  showUpdateRequested = false,
  hideCustomerName = false,
  isAdmin = true,
  isMobileLayout = false,
  useCardLayout = false, // New default
  useCompactLayout = false, // NEW default
  renderExtra // ✅ NEW: Render custom content for each order (e.g., lifecycle timer)
}: OrderRowProps) {
  const { openModal } = useModal();

  // Reprint badge calculation

  // ✅ Use helpers from service instead of inline functions
  const showReprintBadge = shouldShowReprintBadge(order);
  const weekRange = computeWeekRange(order);
  const productCount = getProductCount(order);
  const totalQuantity = getTotalQuantity(order);

  const handleCustomerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (openModal as any)('CUSTOMER_PROFILE', {
      customerEmail: order.customerEmail || order.customerId || "",
      onClose: () => {},
      isAdmin: isAdmin,
      openModal, // Pass openModal so nested modals can open
    }, 'lg');
  };

  // CARD LAYOUT (for Active Orders page)
  if (useCardLayout) {
    return (
      <div className="bg-gradient-to-br from-[#2a2a2a] to-[#1f1f1f] border border-[#D4A574]/40 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:border-[#D4A574]/60">
        {/* Order ID Header */}
        <div className="px-6 py-4 border-b border-[#D4A574]/20">
          <div className="text-[#D4A574] font-bold text-lg tracking-wide">
            {displayOrderNumber(order)}
          </div>
        </div>

        {/* Order Details Grid */}
        <div className="px-6 py-6 grid grid-cols-4 gap-6">
          {/* Week & Delivery Dates */}
          <div>
            <div className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Delivery Week</div>
            <div className="text-white font-semibold text-base">Week {order.week}</div>
            <div className="text-neutral-400 text-xs mt-1">{weekRange}</div>
          </div>

          {/* Status */}
          <div>
            <div className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Status</div>
            <div>
              {order.status === 'pending' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FF9800] text-white text-xs font-bold uppercase">
                  PENDING
                </span>
              )}
              {order.status === 'approved' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#4CAF50] text-white text-xs font-bold uppercase">
                  APPROVED
                </span>
              )}
              {order.status === 'in_process' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#2196F3] text-white text-xs font-bold uppercase">
                  IN PRODUCTION
                </span>
              )}
              {order.status === 'completed' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-600 text-white text-xs font-bold uppercase">
                  COMPLETED
                </span>
              )}
            </div>
          </div>

          {/* Total */}
          <div>
            <div className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Total</div>
            <div className="text-[#4CAF50] font-bold text-base">{formatCurrency(order.total)}</div>
          </div>

          {/* Order Date & Payment Date */}
          <div>
            <div className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Order Date</div>
            <div className="text-white font-semibold text-base">{formatOrderDate(toDate(order.createdAt) as any ?? "")}</div>
            {(((order as any).paymentConfirmedAt) || ((order as any).paymentReceivedAt)) && (
              <div className="text-[#4CAF50] text-xs mt-1">
                Paid: {formatOrderDateWithFallback(toDate((order as any).paymentConfirmedAt || (order as any).paymentReceivedAt))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-gradient-to-br from-[#1a1a1a] to-[#252525] border-t border-[#D4A574]/20 flex items-center justify-between gap-4">
          {actionButtonSections.map((section, sectionIdx) => (
            <div key={sectionIdx} className="flex items-center gap-4 w-full">
              {section.buttons.map((button: any, btnIdx: any) => {
                // Check if button should be shown
                if (button.show && !button.show(order)) return null;

                const IconComponent = typeof button.icon === 'function' ? button.icon(order) : button.icon;
                const label = typeof button.label === 'function' ? button.label(order) : button.label;
                const variant = typeof button.variant === 'function' ? button.variant(order) : button.variant;

                // Determine button styling based on variant
                let buttonClasses = '';
                if (variant === 'view') {
                  buttonClasses = 'flex items-center justify-center gap-2 px-6 py-3 bg-[#8B7355] hover:bg-[#7A6349] text-white rounded-lg transition-all duration-300 font-medium text-sm shadow-md hover:shadow-lg flex-1';
                } else if (variant === 'edit') {
                  buttonClasses = 'flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF9800] to-[#F57C00] hover:from-[#F57C00] hover:to-[#E65100] text-white rounded-lg transition-all duration-300 font-medium text-sm shadow-md hover:shadow-lg flex-1';
                } else {
                  // Default styling for other buttons
                  buttonClasses = 'flex items-center justify-center gap-2 px-6 py-3 bg-[#D4A574] hover:bg-[#D4A574] text-white rounded-lg transition-all duration-300 font-medium text-sm shadow-md hover:shadow-lg flex-1';
                }

                return (
                  <button
                    key={btnIdx}
                    onClick={() => button.onClick(order)}
                    className={buttonClasses}
                    type="button"
                  >
                    {IconComponent && <IconComponent className="w-4 h-4" />}
                    <span className="uppercase tracking-wide">{label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* ✅ Render extra content (e.g., lifecycle timer) */}
        {renderExtra && renderExtra(order)}
      </div>
    );
  }

  // COMPACT LAYOUT (like AdminUnpaidOrders - White card with gold accents)
  if (useCompactLayout) {
    return (
      <div className="border border-[#E8C4A2] rounded-lg p-2.5 sm:p-3.5 hover:border-[#D4A574] transition-all bg-white shadow-sm hover:shadow-md">
        {/* MOBILE LAYOUT */}
        <div className="block sm:hidden">
          {/* Row 1: Store Name Button - Centered */}
          {!hideCustomerName ? (
            <>
              <div className="flex justify-center mb-3">
                {isAdmin ? (
                  <button
                    onClick={handleCustomerClick}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#8B6F47] to-[#A67C52] hover:from-[#7A5F3E] hover:to-[#8B6F47] text-white transition-all duration-200 shadow-sm text-xs"
                    type="button"
                  >
                    <User className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-bold uppercase">
                      {order.customerName || 'Unknown'}
                    </span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </button>
                ) : (
                  <div className="text-center">
                    <span className="text-[8px] text-neutral-400 uppercase tracking-wide mb-1 block">Store</span>
                    <div className="text-[#8B6F47] font-bold text-sm leading-tight">
                      {order.customerName || 'Unknown'}
                    </div>
                  </div>
                )}
              </div>

              {/* Row 2: Total Qty + Products */}
              <div className="flex items-start justify-between gap-4 mb-3">
                {/* Total Qty */}
                <div className="flex-1">
                  <span className="text-[8px] text-neutral-400 uppercase tracking-wide mb-1 block">Total Qty</span>
                  <div className="text-[#333] font-bold text-sm leading-tight">
                    {totalQuantity} units
                  </div>
                </div>

                {/* Products */}
                <div className="flex-1 text-right">
                  <span className="text-[8px] text-neutral-400 uppercase tracking-wide mb-1 block">Products</span>
                  <div className="text-[#333] font-bold text-sm leading-tight">
                    {productCount} {productCount === 1 ? 'item' : 'items'}
                  </div>
                </div>
              </div>

              {/* Row 3: Week + Status */}
              <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-[#E8C4A2]/50">
                {/* Week */}
                <div className="flex-1">
                  <span className="text-[8px] text-neutral-400 uppercase tracking-wide mb-1 block">Week</span>
                  <div className="text-[#8B6F47] font-bold text-sm leading-tight">
                    Week {order.week || 'N/A'}
                  </div>
                </div>

                {/* Status - Plain Text */}
                <div className="flex-1 text-right">
                  <span className="text-[8px] text-neutral-400 uppercase tracking-wide mb-1 block">Status</span>
                  {order.status === 'pending' && (
                    <div className="text-[#FF9800] font-bold text-sm leading-tight uppercase">
                      Pending
                    </div>
                  )}
                  {order.status === 'approved' && (
                    order.paymentSubmitted ? (
                      <div className="text-[#FF9800] font-bold text-sm leading-tight uppercase">
                        Waiting
                      </div>
                    ) : (
                      <div className="text-[#F44336] font-bold text-sm leading-tight uppercase">
                        Payment
                      </div>
                    )
                  )}
                  {order.status === 'rejected' && (
                    <div className="text-neutral-600 font-bold text-sm leading-tight uppercase">
                      Rejected
                    </div>
                  )}
                  {order.status === 'cancelled' && (
                    <div className="text-neutral-600 font-bold text-sm leading-tight uppercase">
                      Cancelled
                    </div>
                  )}
                  {order.status === 'completed' && (
                    <div className="text-[#4CAF50] font-bold text-sm leading-tight uppercase">
                      Completed
                    </div>
                  )}
                  {order.status === 'in_process' && (
                    <div className="text-[#2196F3] font-bold text-sm leading-tight uppercase">
                      Production
                    </div>
                  )}
                </div>
              </div>

              {/* Row 4: Week Range - Centered */}
              {weekRange && (
                <div className="text-center mb-4 pb-4 border-b border-[#E8C4A2]/50">
                  <div className="text-[10px] text-neutral-500">
                    {weekRange}
                  </div>
                </div>
              )}
            </>
          ) : (
            // When customer name is hidden, show Week + Status Badge in first row
            <>
              {/* Row 1: Week + Status Badge */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <span className="text-[8px] text-neutral-400 uppercase tracking-wide mb-1 block">Week</span>
                  <div className="text-[#8B6F47] font-bold text-sm leading-tight">
                    Week {order.week || 'N/A'}
                  </div>
                  {weekRange && (
                    <div className="text-[9px] text-neutral-400 mt-0.5">
                      {weekRange}
                    </div>
                  )}
                </div>
                
                {/* Status - Plain Text */}
                <div className="flex-shrink-0 text-right">
                  {order.status === 'pending' && (
                    <div className="order-card-meta text-[#FF9800] font-bold leading-tight uppercase">
                      Pending
                    </div>
                  )}
                  {order.status === 'approved' && (
                    order.paymentSubmitted ? (
                      <div className="order-card-meta text-[#FF9800] font-bold leading-tight uppercase">
                        Waiting
                      </div>
                    ) : (
                      <div className="order-card-meta text-[#F44336] font-bold leading-tight uppercase">
                        Payment
                      </div>
                    )
                  )}
                  {order.status === 'rejected' && (
                    <div className="order-card-meta text-neutral-600 font-bold leading-tight uppercase">
                      Rejected
                    </div>
                  )}
                  {order.status === 'cancelled' && (
                    <div className="order-card-meta text-neutral-600 font-bold leading-tight uppercase">
                      Cancelled
                    </div>
                  )}
                  {order.status === 'completed' && (
                    <div className="order-card-meta text-[#4CAF50] font-bold leading-tight uppercase">
                      Completed
                    </div>
                  )}
                  {order.status === 'in_process' && (
                    <div className="order-card-meta text-[#2196F3] font-bold leading-tight uppercase">
                      Production
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Total Qty + Products */}
              <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-[#E8C4A2]/50">
                {/* Total Qty */}
                <div className="flex-1">
                  <span className="text-[8px] text-neutral-400 uppercase tracking-wide mb-1 block">Total Qty</span>
                  <div className="text-[#333] font-bold text-sm leading-tight">
                    {totalQuantity} units
                  </div>
                </div>

                {/* Products */}
                <div className="flex-1 text-right">
                  <span className="text-[8px] text-neutral-400 uppercase tracking-wide mb-1 block">Products</span>
                  <div className="text-[#333] font-bold text-sm leading-tight">
                    {productCount} {productCount === 1 ? 'item' : 'items'}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ✅ MOVED: Render extra content (e.g., lifecycle timer) BEFORE action buttons */}
          {renderExtra && (
            <div className="mb-4">
              {renderExtra(order)}
            </div>
          )}

          {/* Action Buttons - Responsive Flexbox Layout */}
          <div className="flex flex-col sm:flex-row items-stretch justify-around gap-2 sm:gap-4 w-full">
            {(() => {
              // Collect all visible buttons
              const visibleButtons: Array<{
                sectionIdx: number;
                btnIdx: number;
                button: typeof actionButtonSections[0]['buttons'][0];
                IconComponent: any;
                label: string;
                variant: string;
              }> = [];

              actionButtonSections.forEach((section, sectionIdx) => {
                section.buttons.forEach((button: any, btnIdx: any) => {
                  // Check if button should be shown
                  if (button.show && !button.show(order)) return;

                  const IconComponent = typeof button.icon === 'function' ? button.icon(order) : button.icon;
                  const label = typeof button.label === 'function' ? button.label(order) : button.label;
                  const variant = typeof button.variant === 'function' ? button.variant(order) : button.variant;

                  visibleButtons.push({
                    sectionIdx,
                    btnIdx,
                    button,
                    IconComponent,
                    label,
                    variant
                  });
                });
              });

              // Render buttons
              return visibleButtons.map((btn, index) => {
                // Determine button styling based on variant - Mobile optimized
                let buttonClasses = 'flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg transition-all duration-300 font-medium shadow-sm hover:shadow-md uppercase tracking-wide flex-1';
                
                if (btn.variant === 'view') {
                  buttonClasses += ' bg-gradient-to-r from-[#8B6F47] to-[#A67C52] hover:from-[#7A5F3E] hover:to-[#8B6F47] text-white';
                } else if (btn.variant === 'approve') {
                  buttonClasses += ' bg-gradient-to-r from-[#2196F3] to-[#1E88E5] hover:from-[#1976D2] hover:to-[#1565C0] text-white';
                } else if (btn.variant === 'reject' || btn.variant === 'danger') {
                  buttonClasses += ' bg-gradient-to-r from-[#F44336] to-[#D32F2F] hover:from-[#D32F2F] hover:to-[#B71C1C] text-white';
                } else if (btn.variant === 'cancel') {
                  buttonClasses += ' bg-gradient-to-r from-[#F44336] to-[#D32F2F] hover:from-[#D32F2F] hover:to-[#B71C1C] text-white';
                } else if (btn.variant === 'edit') {
                  buttonClasses += ' bg-gradient-to-r from-[#D4A574] to-[#C9995E] hover:from-[#C9995E] hover:to-[#B8864D] text-white';
                } else if (btn.variant === 'download') {
                  buttonClasses += ' bg-gradient-to-r from-[#D4A574] to-[#C9995E] hover:from-[#C9995E] hover:to-[#B8864D] text-white';
                } else if (btn.variant === 'primary') {
                  buttonClasses += ' bg-gradient-to-r from-[#2196F3] to-[#1976D2] hover:from-[#1976D2] hover:to-[#1565C0] text-white';
                } else if (btn.variant === 'pending') {
                  buttonClasses += ' bg-gradient-to-r from-[#FF9800] to-[#F57C00] hover:from-[#F57C00] hover:to-[#E65100] text-white';
                } else {
                  buttonClasses += ' bg-gradient-to-r from-[#D4A574] to-[#E8C4A2] hover:from-[#D4A574] hover:to-[#D4A574] text-white';
                }

                return (
                  <button
                    key={`${btn.sectionIdx}-${btn.btnIdx}`}
                    onClick={() => btn.button.onClick(order)}
                    className={buttonClasses}
                    type="button"
                  >
                    {btn.IconComponent && <btn.IconComponent className="w-4 h-4 flex-shrink-0" />}
                    <span className="text-xs sm:text-sm font-bold leading-tight text-center truncate">{btn.label}</span>
                  </button>
                );
              });
            })()}
          </div>
        </div>

        {/* DESKTOP LAYOUT (Original) */}
        <div className="hidden sm:block">
          {/* Row 1: Store Name, Week, Product Count, Total Qty, Status Badge */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8C4A2]/50">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Store Name Badge (Admin Only) */}
              {!hideCustomerName && isAdmin && (
                <>
                  <div>
                    <span className="text-xs text-neutral-500 uppercase tracking-wide block mb-1">Store</span>
                    <button
                      onClick={handleCustomerClick}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#8B6F47] to-[#A67C52] hover:from-[#7A5F3E] hover:to-[#8B6F47] text-white transition-all duration-200 group shadow-sm hover:shadow-md"
                      type="button"
                    >
                      <User className="w-4 h-4 flex-shrink-0" />
                      <span className="font-bold text-sm uppercase">
                        {order.customerName || 'Unknown Customer'}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </button>
                  </div>

                  {/* Separator */}
                  <div className="h-10 w-px bg-[#E8C4A2]"></div>
                </>
              )}
              
              {/* Store Name - Non-clickable (Customer View) */}
              {!hideCustomerName && !isAdmin && (
                <>
                  <div>
                    <span className="text-xs text-neutral-500 uppercase tracking-wide block mb-1">Store</span>
                    <div className="text-[#8B6F47] font-bold text-base">
                      {order.customerName || 'Unknown Customer'}
                    </div>
                  </div>

                  {/* Separator */}
                  <div className="h-10 w-px bg-[#E8C4A2]"></div>
                </>
              )}

              {/* Week */}
              <div>
                <span className="text-xs text-neutral-500 uppercase tracking-wide">Week</span>
                <div className="text-[#333] font-semibold text-base">
                  Week {order.week || 'N/A'} {weekRange && `(${weekRange})`}
                </div>
              </div>

              {/* Separator */}
              <div className="h-10 w-px bg-[#E8C4A2]"></div>

              {/* Product Count */}
              <div>
                <span className="text-xs text-neutral-500 uppercase tracking-wide">Products</span>
                <div className="text-[#333] font-semibold text-base">
                  {productCount} {productCount === 1 ? 'item' : 'items'}
                </div>
              </div>

              {/* Separator */}
              <div className="h-10 w-px bg-[#E8C4A2]"></div>

              {/* Total Quantity */}
              <div>
                <span className="text-xs text-neutral-500 uppercase tracking-wide">Total Qty</span>
                <div className="text-[#333] font-semibold text-base">
                  {totalQuantity} units
                </div>
              </div>
            </div>

            {/* Status Badge - Aligned with Store Badge */}
            <div className="ml-auto">
              {order.status === 'pending' && (
                <span className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF9800] to-[#F57C00] text-white text-sm font-bold uppercase shadow-sm whitespace-nowrap block">
                  ⏳ PENDING REVIEW
                </span>
              )}
              {order.status === 'approved' && (
                order.paymentSubmitted ? (
                  // Payment has been submitted, waiting for admin confirmation
 // Updated badge text for customer clarity
                  <span className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF9800] to-[#F57C00] text-white text-sm font-bold uppercase shadow-sm whitespace-nowrap block">
                    ⏳ WAITING CONFIRM PAYMENT
                  </span>
                ) : (
                  // Payment not yet submitted
                  <span className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#F44336] to-[#D32F2F] text-white text-sm font-bold uppercase shadow-sm whitespace-nowrap block">
                    💰 WAITING PAYMENT
                  </span>
                )
              )}
              {order.status === 'rejected' && (
                <span className="px-4 py-2 rounded-lg bg-gradient-to-r from-neutral-500 to-neutral-600 text-white text-sm font-bold uppercase shadow-sm whitespace-nowrap block">
                  ❌ REJECTED
                </span>
              )}
              {order.status === 'cancelled' && (
                <span className="px-4 py-2 rounded-lg bg-gradient-to-r from-neutral-500 to-neutral-600 text-white text-sm font-bold uppercase shadow-sm whitespace-nowrap block">
                  🚫 CANCELLED
                </span>
              )}
              {order.status === 'completed' && (
                <span className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#4CAF50] to-[#66BB6A] text-white text-sm font-bold uppercase shadow-sm whitespace-nowrap block">
                  ✅ COMPLETED
                </span>
              )}
              {order.status === 'in_process' && (
                <span className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#2196F3] to-[#1E88E5] text-white text-sm font-bold uppercase shadow-sm whitespace-nowrap block">
                  🛠️ IN PRODUCTION
                </span>
              )}
            </div>
          </div>

          {/* ✅ MOVED: Render extra content (e.g., lifecycle timer) BEFORE action buttons */}
          {renderExtra && (
            <div className="mb-4">
              {renderExtra(order)}
            </div>
          )}

          {/* Row 2: Action Buttons - Responsive Flexbox Layout */}
          <div className="flex flex-col sm:flex-row items-stretch justify-around gap-2 sm:gap-4 w-full">
            {(() => {
              // Collect all visible buttons
              const visibleButtons: Array<{
                sectionIdx: number;
                btnIdx: number;
                button: typeof actionButtonSections[0]['buttons'][0];
                IconComponent: any;
                label: string;
                variant: string;
              }> = [];

              actionButtonSections.forEach((section, sectionIdx) => {
                section.buttons.forEach((button: any, btnIdx: any) => {
                  // Check if button should be shown
                  if (button.show && !button.show(order)) return;

                  const IconComponent = typeof button.icon === 'function' ? button.icon(order) : button.icon;
                  const label = typeof button.label === 'function' ? button.label(order) : button.label;
                  const variant = typeof button.variant === 'function' ? button.variant(order) : button.variant;

                  visibleButtons.push({
                    sectionIdx,
                    btnIdx,
                    button,
                    IconComponent,
                    label,
                    variant
                  });
                });
              });

              // Render buttons
              return visibleButtons.map((btn, index) => {
                // Determine button styling based on variant - Mobile optimized
                let buttonClasses = 'flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg transition-all duration-300 font-medium shadow-sm hover:shadow-md uppercase tracking-wide flex-1';
                
                if (btn.variant === 'view') {
                  buttonClasses += ' bg-gradient-to-r from-[#8B6F47] to-[#A67C52] hover:from-[#7A5F3E] hover:to-[#8B6F47] text-white';
                } else if (btn.variant === 'approve') {
                  buttonClasses += ' bg-gradient-to-r from-[#2196F3] to-[#1E88E5] hover:from-[#1976D2] hover:to-[#1565C0] text-white';
                } else if (btn.variant === 'reject' || btn.variant === 'danger') {
                  buttonClasses += ' bg-gradient-to-r from-[#F44336] to-[#D32F2F] hover:from-[#D32F2F] hover:to-[#B71C1C] text-white';
                } else if (btn.variant === 'cancel') {
                  buttonClasses += ' bg-gradient-to-r from-[#F44336] to-[#D32F2F] hover:from-[#D32F2F] hover:to-[#B71C1C] text-white';
                } else if (btn.variant === 'edit') {
                  buttonClasses += ' bg-gradient-to-r from-[#D4A574] to-[#C9995E] hover:from-[#C9995E] hover:to-[#B8864D] text-white';
                } else if (btn.variant === 'download') {
                  buttonClasses += ' bg-gradient-to-r from-[#D4A574] to-[#C9995E] hover:from-[#C9995E] hover:to-[#B8864D] text-white';
                } else if (btn.variant === 'primary') {
                  buttonClasses += ' bg-gradient-to-r from-[#2196F3] to-[#1976D2] hover:from-[#1976D2] hover:to-[#1565C0] text-white';
                } else if (btn.variant === 'pending') {
                  buttonClasses += ' bg-gradient-to-r from-[#FF9800] to-[#F57C00] hover:from-[#F57C00] hover:to-[#E65100] text-white';
                } else {
                  buttonClasses += ' bg-gradient-to-r from-[#D4A574] to-[#E8C4A2] hover:from-[#D4A574] hover:to-[#D4A574] text-white';
                }

                return (
                  <button
                    key={`${btn.sectionIdx}-${btn.btnIdx}`}
                    onClick={() => btn.button.onClick(order)}
                    className={buttonClasses}
                    type="button"
                  >
                    {btn.IconComponent && <btn.IconComponent className="w-4 h-4 flex-shrink-0" />}
                    <span className="text-xs sm:text-sm font-bold leading-tight text-center truncate">{btn.label}</span>
                  </button>
                );
              });
            })()}
          </div>
        </div>
        
        {/* ✅ Render extra content (e.g., lifecycle timer) - REMOVED FROM HERE, NOW RENDERED ABOVE */}
      </div>
    );
  }

  return (
    <div className="border-2 border-amber-500/30 rounded-xl p-4 sm:p-6 hover:border-amber-500/60 transition-all bg-gradient-to-br from-zinc-900 to-zinc-800 shadow-lg hover:shadow-xl">
      {/* MOBILE LAYOUT */}
      {isMobileLayout && (
        <div className="sm:hidden space-y-3">
          {/* Row 1: Customer Name - Centered */}
          {!hideCustomerName && (
            <div className="flex justify-center">
              <button
                onClick={handleCustomerClick}
                className="group relative px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 text-sm font-bold"
                type="button"
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">👤</span>
                  {order.customerName || 'Unknown Customer'}
                </span>
              </button>
            </div>
          )}

          {/* Row 2: Order Number and Tags - Space Between */}
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <span className="text-amber-500 font-bold text-base">{displayOrderNumber(order)}</span>
            {order.quantitiesUpdated && (
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 text-xs font-bold uppercase">
                UPDATED
              </span>
            )}
            {/* ✅ NEW: Show production reprint badge when adjustment payment is confirmed */}
            {showReprintBadge && (
              <span className="px-3 py-1 rounded-full bg-amber-500 text-black border border-amber-600 text-xs font-bold uppercase animate-pulse flex items-center gap-1 shadow-lg">
                <span>⚠️</span>
                <span>UPDATED - REPRINT REQUIRED</span>
              </span>
            )}
            {order.discount && order.discount > 0 && (
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-bold uppercase flex items-center gap-1">
                <span>🏷️</span>
                <span>{formatDiscountPercentage(order.discountPercentage)}</span>
              </span>
            )}
            {order.status === "approved" && (
              <span className="px-3 py-1 rounded-full bg-red-500 text-white text-xs font-bold uppercase">
                UNPAID
              </span>
            )}
            {order.status === "completed" && (
              <span className="px-3 py-1 rounded-full bg-green-600 text-white text-xs font-bold uppercase">
                COMPLETED
              </span>
            )}
          </div>

          {/* Row 3: Two-Column Layout - Space Around */}
          <div className="flex justify-around items-start gap-4">
            {/* Left Column: Week & Status */}
            <div className="flex flex-col justify-between gap-3">
              <div>
                <div className="text-zinc-400 text-xs mb-1">Week</div>
                <div className="text-zinc-100 font-semibold text-sm">Week {order.week}</div>
              </div>
              <div>
                <div className="text-zinc-400 text-xs mb-1">Status</div>
                <div><OrderStatusBadge status={order.status} /></div>
              </div>
            </div>

            {/* Right Column: Total & Date */}
            <div className="flex flex-col justify-between gap-3">
              <div>
                <div className="text-zinc-400 text-xs mb-1">Total</div>
                <div className="text-amber-500 font-bold text-sm">{formatCurrency(order.total)}</div>
              </div>
              <div>
                <div className="text-zinc-400 text-xs mb-1">Date</div>
                <div className="text-zinc-100 font-semibold text-sm">{formatOrderDate(toDate(order.createdAt) as any ?? "")}</div>
              </div>
            </div>
          </div>

          {/* Row 5: Approved By - Centered */}
          {showApprovedBy && order.approvedBy && order.approvedAt && (
            <div className="text-green-400 text-xs flex flex-col items-center justify-center text-center gap-1 pt-3 border-t border-amber-500/20">
              <span className="font-bold">✓ Approved by: <span className="opacity-90">{order.approvedBy}</span></span>
              <span className="opacity-90">{formatOrderTimestamp(toDate(order.approvedAt) as any ?? "")}</span>
            </div>
          )}
        </div>
      )}

      {/* DESKTOP LAYOUT */}
      {!isMobileLayout && (
        <div className="hidden sm:block">
          {/* Order Header */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {!hideCustomerName && (
                <>
                  <button
                    onClick={handleCustomerClick}
                    className="group relative px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 text-sm font-bold"
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-lg">👤</span>
                      {order.customerName || 'Unknown Customer'}
                    </span>
                  </button>
                  <span className="text-zinc-600">-</span>
                </>
              )}
              <span className="text-amber-500 font-bold text-base">{displayOrderNumber(order)}</span>
              {order.quantitiesUpdated && (
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 text-xs font-bold uppercase">
                  UPDATED
                </span>
              )}
              {/* ✅ NEW: Show production reprint badge when adjustment payment is confirmed */}
              {showReprintBadge && (
                <span className="px-3 py-1 rounded-full bg-amber-500 text-black border border-amber-600 text-xs font-bold uppercase animate-pulse flex items-center gap-1 shadow-lg">
                  <span>⚠️</span>
                  <span>UPDATED - REPRINT REQUIRED</span>
                </span>
              )}
              {order.discount && order.discount > 0 && (
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-bold uppercase flex items-center gap-1">
                  <span>🏷️</span>
                  <span>{formatDiscountPercentage(order.discountPercentage)}</span>
                </span>
              )}
              {order.status === "approved" && (
                <span className="px-3 py-1 rounded-full bg-red-500 text-white text-xs font-bold uppercase">
                  UNPAID
                </span>
              )}
              {order.status === "completed" && (
                <span className="px-3 py-1 rounded-full bg-green-500 text-white text-xs font-bold uppercase">
                  PAID
                </span>
              )}
            </div>
          </div>

          {/* Order Details Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-zinc-400 text-xs mb-1">Week</div>
              <div className="text-zinc-100 font-semibold text-sm">Week {order.week}</div>
            </div>
            <div>
              <div className="text-zinc-400 text-xs mb-1">Status</div>
              <div><OrderStatusBadge status={order.status} /></div>
            </div>
            <div>
              <div className="text-zinc-400 text-xs mb-1">Total</div>
              <div className="text-amber-500 font-bold text-sm">{formatCurrency(order.total)}</div>
            </div>
            <div>
              <div className="text-zinc-400 text-xs mb-1">Date</div>
              <div className="text-zinc-100 font-semibold text-sm">{formatOrderDate(toDate(order.createdAt) as any ?? "")}</div>
            </div>
          </div>

          {/* Approved By Section */}
          {showApprovedBy && order.approvedBy && order.approvedAt && (
            <div className="text-green-400 text-xs mb-3 flex items-center gap-2 flex-wrap">
              <span className="font-bold">✓ Approved by:</span>
              <span className="opacity-90">{order.approvedBy}</span>
              <span className="opacity-60">•</span>
              <span className="opacity-90">{formatOrderTimestamp(toDate(order.approvedAt) as any ?? "")}</span>
            </div>
          )}
        </div>
      )}

      {/* Additional Info Sections (Shared by both layouts) */}
      {showRejectedInfo && order.rejectionReason && (
        <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-[#FFEBEE] border-l-2 sm:border-l-4 border-[#F44336] rounded">
          <div className="text-[#F44336] text-xs font-bold mb-1">Rejection Reason:</div>
          <div className="text-[#333333] text-xs">{order.rejectionReason}</div>
          {order.rejectedBy && (
            <div className="text-[#666666] text-xs mt-1">
              Rejected by: {order.rejectedBy}
            </div>
          )}
        </div>
      )}

      {showCancelledInfo && order.cancellationReason && (
        <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-[#F5F5F5] border-l-2 sm:border-l-4 border-[#9E9E9E] rounded">
          <div className="text-[#666666] text-xs font-bold mb-1">Cancellation Reason:</div>
          <div className="text-[#333333] text-xs">{order.cancellationReason}</div>
          {order.cancellationFee && order.cancellationFee > 0 && (
            <div className="text-[#F44336] text-xs font-bold mt-1">
              Cancellation Fee: {formatCurrency(order.cancellationFee)}
            </div>
          )}
        </div>
      )}

      {showCompletedInfo && order.completedAt && (
        <div className="text-[#00BCD4] text-xs mb-2 sm:mb-3 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="font-bold">✓ Completed:</span>
            <span className="opacity-90">{formatOrderTimestamp(toDate(order.completedAt) as any ?? "")}</span>
          </div>
          <span className="text-gray-300">•</span>
          <div className="flex items-center gap-1">
            <span className="font-bold">Amount:</span>
            <span className="opacity-90">{formatCurrency(order.total)}</span>
          </div>
          <span className="text-gray-300">•</span>
          <div className="flex items-center gap-1">
            <span className="font-bold">Week:</span>
            <span className="opacity-90">{order.week} ({weekRange})</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <OrderActionButtons order={order} actionButtonSections={actionButtonSections} />

      {/* ✅ NEW: Render custom content for each order (e.g., lifecycle timer) */}
      {renderExtra && renderExtra(order)}
    </div>
  );
}