/**
 * Step-by-step "add to home screen" help, for browsers without a one-tap
 * install dialog: Safari on iPhone/iPad, and Chrome on Android before it
 * allows the install prompt.
 */
import { Share, PlusSquare, MoreVertical, Download, X } from 'lucide-react';

interface InstallInstructionsProps {
  platform: 'ios' | 'android';
  onClose: () => void;
}

const STEPS = {
  ios: {
    title: 'Install on your iPhone or iPad',
    steps: [
      { icon: Share, text: <>Tap the <strong>Share</strong> button in Safari&apos;s toolbar.</> },
      { icon: PlusSquare, text: <>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</> },
    ],
    note: 'Use Safari — some other iPhone browsers don’t offer this option.',
  },
  android: {
    title: 'Install on your Android phone',
    steps: [
      { icon: MoreVertical, text: <>Tap the browser menu <strong>⋮</strong> (top-right corner).</> },
      { icon: Download, text: <>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>, then confirm.</> },
    ],
    note: 'In Samsung Internet: menu ≡ → Add page to → Home screen.',
  },
} as const;

export function InstallInstructions({ platform, onClose }: InstallInstructionsProps) {
  const { title, steps, note } = STEPS[platform];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-help-title"
      className="fixed inset-0 z-[1001] flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="install-help-title" className="text-lg font-bold text-[#2c2416]">
            {title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ol className="space-y-3 text-sm text-gray-700">
          {steps.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fbf6ee] text-[#8B6F47]">
                <Icon className="h-4 w-4" />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-gray-500">{note}</p>
      </div>
    </div>
  );
}
