/**
 * "Get notifications on your phone" — a small banner shown to signed-in
 * customers and admins until they turn phone notifications on (or dismiss
 * it). Also keeps the app-icon badge equal to the unread count.
 */
import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { toast } from 'sonner';
import { enablePush, getPushState, refreshPushToken, setAppIconBadge, type PushState } from '../../services/pushNotifications';
import { useAdminNotificationsSafe } from '../../notifications/contexts/AdminNotificationProvider';
import { useCustomerNotificationsSafe } from '../../notifications/contexts/CustomerNotificationProvider';

const DISMISS_KEY = 'push-optin-dismissed';
const readDismissed = (): boolean => {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};

export function PushOptIn({ uid }: { uid: string }): JSX.Element | null {
  const admin = useAdminNotificationsSafe() as { unreadCount?: number } | null;
  const customer = useCustomerNotificationsSafe();
  const unread = admin?.unreadCount ?? customer?.unreadCount ?? 0;

  const [state, setState] = useState<PushState | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getPushState().then((s) => {
      if (!alive) return;
      setState(s);
      if (s === 'on') refreshPushToken(uid);
    });
    return () => { alive = false; };
  }, [uid]);

  // App-icon badge = unread notifications (cleared when all are read).
  useEffect(() => setAppIconBadge(unread), [unread]);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ }
  };

  const turnOn = async () => {
    setBusy(true);
    try {
      const next = await enablePush(uid);
      setState(next);
      if (next === 'on') toast.success('Phone notifications are on');
      else if (next === 'blocked') toast.error('Notifications are blocked — allow them in your phone settings for this app.');
      else toast.error("Couldn't turn on notifications. Please try again.");
    } catch {
      toast.error("Couldn't turn on notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (dismissed || (state !== 'off' && state !== 'needs-home-screen')) return null;

  return (
    <div className="mx-3 sm:mx-4 lg:mx-6 my-2 rounded-xl border-2 border-[#D4A574]/50 bg-[#FFF8EE] px-3 py-2.5 shadow-sm flex items-start gap-3">
      <Bell className="w-5 h-5 text-[#8B6F47] flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-sm text-[#5a4535]">
        {state === 'off' ? (
          <>
            <p className="font-semibold text-[#2d2416]">Get order updates on your phone</p>
            <p className="text-xs mt-0.5">New orders, approvals and payments — even when the app is closed.</p>
            <button
              type="button"
              onClick={turnOn}
              disabled={busy}
              className="mt-2 min-h-[36px] px-4 rounded-lg bg-[#8B6F47] text-white text-xs font-semibold disabled:opacity-50"
            >
              {busy ? 'Turning on…' : 'Turn on notifications'}
            </button>
          </>
        ) : (
          <>
            <p className="font-semibold text-[#2d2416]">Want notifications on your iPhone?</p>
            <p className="text-xs mt-0.5">Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open the app from your home screen and turn them on there.</p>
          </>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="p-1 text-[#8B6F47]/70 hover:text-[#8B6F47]">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
