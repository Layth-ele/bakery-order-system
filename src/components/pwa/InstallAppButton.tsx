/**
 * "Install app" button for the admin and customer headers.
 *
 * - Chrome / Edge / Android: opens the browser's install dialog.
 * - iPhone / iPad (Safari): shows how to use Share → Add to Home Screen.
 * - Already installed, or browser can't install: renders nothing.
 */
import { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { toast } from 'sonner';
import { useInstallMode, promptInstall } from '../../pwa/installPrompt';

interface InstallAppButtonProps {
  /** Hide the text label below the md breakpoint (icon-only on phones). */
  compact?: boolean;
}

export function InstallAppButton({ compact = false }: InstallAppButtonProps) {
  const mode = useInstallMode();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (mode === 'installed' || mode === 'unavailable') return null;

  const onClick = async () => {
    if (mode === 'ios') {
      setShowIosHelp(true);
      return;
    }
    const installed = await promptInstall();
    if (installed) toast.success('App installed', { description: 'Open Delight Bakehouse from your home screen or app list.' });
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label="Install app"
        title="Install app"
        className="inline-flex items-center justify-center gap-1.5 md:gap-2 h-10 min-w-10 px-2 md:px-4 rounded-lg bg-[#3d3832] text-[#e8dcc8] hover:bg-[#4a4238] transition-all border border-[#D4A574]/50 text-xs md:text-base"
      >
        <Download className="w-4 h-4 md:w-5 md:h-5" />
        <span className={compact ? 'hidden md:inline' : 'inline'}>Install app</span>
      </button>

      {showIosHelp && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 id="ios-install-title" className="text-lg font-bold text-[#2c2416]">
                Install on your iPhone or iPad
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowIosHelp(false)}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fbf6ee] text-[#8B6F47]">
                  <Share className="w-4 h-4" />
                </span>
                <span>
                  Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fbf6ee] text-[#8B6F47]">
                  <PlusSquare className="w-4 h-4" />
                </span>
                <span>
                  Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                </span>
              </li>
            </ol>
            <p className="mt-4 text-xs text-gray-500">
              Use Safari — other iPhone browsers may not offer this option.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
