/**
 * "Install the app" card — slides up on phones and tablets, on every page
 * (including the login page), inviting visitors to add the app to their
 * home screen.
 *
 * Shown only when installing is possible and the app isn't installed yet.
 * "Not now" hides it for INSTALL_CARD_SNOOZE_DAYS; it never shows inside the
 * installed app. Desktop browsers keep the quieter header button instead.
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useInstallMode,
  promptInstall,
  isInstallCardSnoozed,
  snoozeInstallCard,
} from '../../pwa/installPrompt';
import { useBusinessSettings, DEFAULT_LOGO } from '../../hooks/useBusinessSettings';
import { InstallInstructions } from './InstallInstructions';

const SHOW_AFTER_MS = 3000;

function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

export function InstallAppCard() {
  const mode = useInstallMode();
  const { businessSettings } = useBusinessSettings();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(() => isInstallCardSnoozed());
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  const eligible =
    mode === 'ios' || mode === 'android' || (mode === 'prompt' && isTouchDevice());
  if (!ready || dismissed || !eligible) {
    return showHelp && (mode === 'ios' || mode === 'android') ? (
      <InstallInstructions platform={mode} onClose={() => setShowHelp(false)} />
    ) : null;
  }

  const notNow = () => {
    snoozeInstallCard();
    setDismissed(true);
  };

  const install = async () => {
    if (mode === 'ios' || mode === 'android') {
      setShowHelp(true);
      setDismissed(true); // the instructions take over; don't stack both
      return;
    }
    const accepted = await promptInstall();
    if (accepted) {
      toast.success('App installed', { description: 'Open it from your home screen.' });
    } else {
      snoozeInstallCard(); // they saw the browser's dialog and said no
    }
    setDismissed(true);
  };

  const name = businessSettings.businessName || 'our app';
  const oneTap = mode === 'prompt';

  return (
    <div
      role="dialog"
      aria-labelledby="install-card-title"
      className="fixed inset-x-0 bottom-0 z-[999] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] install-card-enter"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-[#D4A574]/50 bg-[#2c2416] p-3 text-[#e8dcc8] shadow-2xl">
        <img
          src={businessSettings.logoUrl || DEFAULT_LOGO}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl object-contain"
        />
        <div className="min-w-0 flex-1">
          <p id="install-card-title" className="text-sm font-semibold leading-tight">
            Install {name}
          </p>
          <p className="mt-0.5 text-xs text-[#e8dcc8]/75 leading-snug">
            Add it to your home screen for faster ordering — opens like an app.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1.5">
          <button
            type="button"
            onClick={install}
            className="rounded-lg bg-[#D4A574] px-3 py-1.5 text-sm font-semibold text-[#2c2416] hover:bg-[#e0b789]"
          >
            {oneTap ? 'Install' : 'How to install'}
          </button>
          <button
            type="button"
            onClick={notNow}
            className="rounded-lg px-3 py-1 text-xs text-[#e8dcc8]/70 hover:text-[#e8dcc8]"
          >
            Not now
          </button>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={notNow}
          className="self-start rounded-lg p-1 text-[#e8dcc8]/60 hover:text-[#e8dcc8]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
