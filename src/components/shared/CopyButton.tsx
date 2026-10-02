/**
 * CopyButton — the one copy-to-clipboard button (order / invoice numbers).
 * 32 px tap target, shows a check for 1.5 s and a toast on success.
 */
import { useState, type MouseEvent } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '../../utils/clipboardUtils';

interface CopyButtonProps {
  text: string;
  /** What is being copied, for the toast and screen readers (e.g. "Order number"). */
  label?: string;
  /** Icon colour classes; defaults to the bakery brown. */
  className?: string;
}

export function CopyButton({ text, label = 'Order number', className = 'text-[#8B6F47] hover:bg-[#D4A574]/15' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const onClick = async (e: MouseEvent) => {
    e.stopPropagation();
    if (await copyToClipboard(text)) {
      setCopied(true);
      toast.success(`${label} copied`, { description: text, duration: 2000 });
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error(`Couldn't copy — ${text}`);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Copy ${label.toLowerCase()} ${text}`}
      title={`Copy ${label.toLowerCase()}`}
      className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${className}`}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}
