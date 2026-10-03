/**
 * Invoice Preview — shows the exact document the customer/admin downloads
 * (utils/pdf/invoiceDocument): same layout, Settings-driven business and
 * payment details, the order's real state and its change history.
 */
import React from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { useCachedSettings } from '../../../hooks/useCachedFirebase';
import { fetchOrderChanges } from '../../../utils/documents/orderChanges';
import type { OrderChange } from '../../../utils/documents/orderDocument';
import { buildInvoiceDocument } from '../../../utils/pdf/invoiceDocument';
import { openPDFWindowAsync } from '../../../utils/pdf/pdfTemplates';
import { displayInvoiceNumber } from '../../../utils/displayId';
import type { Order, Product, Category } from '../../../types';

interface InvoicePreviewModalProps {
  onClose: () => void;
  order: Order;
  products: Product[];
  categories: Category[];
}

export function InvoicePreviewModal({ onClose, order, products, categories }: InvoicePreviewModalProps): JSX.Element | null {
  const { data: settings } = useCachedSettings();
  const [changes, setChanges] = React.useState<OrderChange[]>([]);
  const [height, setHeight] = React.useState(900);
  const frameRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    let alive = true;
    fetchOrderChanges(order as any).then((h) => { if (alive) setChanges(h); });
    return () => { alive = false; };
  }, [order]);

  const html = React.useMemo(
    () => buildInvoiceDocument({ order, products, categories, settings: (settings ?? {}) as Record<string, any>, changes, printButton: false }),
    [order, products, categories, settings, changes]
  );

  // Fit the frame to the document so the modal scrolls, not the frame.
  const fit = React.useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.body) setHeight(Math.max(400, doc.documentElement.scrollHeight + 4));
  }, []);
  React.useEffect(() => {
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fit]);

  const openDocument = () =>
    openPDFWindowAsync(() =>
      buildInvoiceDocument({ order, products, categories, settings: (settings ?? {}) as Record<string, any>, changes })
    );

  return (
    <StyleModalShell
      width="4xl"
      skinType="info"
      onClose={onClose}
      title="Invoice Preview"
      subtitle={displayInvoiceNumber(order)}
      icon={<FileText className="w-5 h-5" />}
      headerRight={
        <div className="flex items-center gap-2">
          <button
            onClick={openDocument}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={openDocument}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-[#D4A574] hover:bg-[#C4956A] text-black rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download PDF</span>
          </button>
        </div>
      }
    >
      <div className="bg-[#f3f4f6] -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 px-2 sm:px-5 py-4">
        <div className="bg-white shadow-md rounded-lg overflow-hidden max-w-3xl mx-auto">
          <iframe
            ref={frameRef}
            title="Invoice"
            srcDoc={html}
            onLoad={fit}
            className="block w-full border-0"
            style={{ height }}
          />
        </div>
      </div>
    </StyleModalShell>
  );
}
