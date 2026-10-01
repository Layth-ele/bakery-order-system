/**
 * "Install app" button for the admin and customer headers.
 *
 * - Browser can install directly (Chrome/Edge): opens its install dialog.
 * - iPhone/iPad, or Android before Chrome allows the dialog: shows the
 *   add-to-home-screen steps.
 * - Already installed, or browser can't install: renders nothing.
 */
import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useInstallMode, promptInstall } from '../../pwa/installPrompt';
import { InstallInstructions } from './InstallInstructions';

interface InstallAppButtonProps {
  /** Hide the text label below the md breakpoint (icon-only on phones). */
  compact?: boolean;
}

export function InstallAppButton({ compact = false }: InstallAppButtonProps) {
  const mode = useInstallMode();
  const [showHelp, setShowHelp] = useState(false);

  if (mode === 'installed' || mode === 'unavailable') return null;

  const onClick = async () => {
    if (mode === 'ios' || mode === 'android') {
      setShowHelp(true);
      return;
    }
    if (await promptInstall()) {
      toast.success('App installed', { description: 'Open it from your home screen or app list.' });
    }
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
      {showHelp && (mode === 'ios' || mode === 'android') && (
        <InstallInstructions platform={mode} onClose={() => setShowHelp(false)} />
      )}
    </>
  );
}
