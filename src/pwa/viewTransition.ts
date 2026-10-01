/**
 * Smooth screen changes with the browser's View Transitions API.
 *
 * Wraps a React state update so the old and new screens cross-fade like a
 * native app. Falls back to an instant update where unsupported (older
 * Safari/Firefox) and when the user has "Reduce motion" turned on.
 * (Route changes use React Router's `viewTransition` option instead.)
 */
import { flushSync } from 'react-dom';

type DocumentWithVT = Document & { startViewTransition?: (cb: () => void) => unknown };

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function withViewTransition(update: () => void): void {
  const doc = typeof document !== 'undefined' ? (document as DocumentWithVT) : null;
  if (!doc?.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  // flushSync so the new screen is in the DOM when the browser snapshots it.
  doc.startViewTransition(() => flushSync(update));
}
