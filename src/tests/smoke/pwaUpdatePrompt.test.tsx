/**
 * App updates: installed apps are resumed, not reloaded, so the update bar
 * must check for a new version whenever the app comes back to the foreground
 * — not only on a fresh page load (which used to mean "after logging out").
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { useState } from 'react';

let registration: { update: ReturnType<typeof vi.fn>; waiting: object | null };

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW(opts: { onRegisteredSW?: (url: string, r: unknown) => void }) {
    const needRefresh = useState(false);
    const [registered, setRegistered] = useState(false);
    if (!registered) {
      setRegistered(true);
      opts.onRegisteredSW?.('/sw.js', registration);
    }
    return { needRefresh, offlineReady: useState(false), updateServiceWorker: async () => {} };
  },
}));

import { PwaUpdatePrompt } from '../../components/pwa/PwaUpdatePrompt';

const showApp = () => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  vi.useFakeTimers();
  registration = { update: vi.fn().mockResolvedValue(undefined), waiting: null };
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  Object.defineProperty(navigator, 'serviceWorker', { value: { controller: {} }, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PwaUpdatePrompt', () => {
  it('checks for a new version when the app returns to the foreground', () => {
    render(<PwaUpdatePrompt />);
    act(() => showApp());
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('does not spam the server when focus and visibility fire together', () => {
    render(<PwaUpdatePrompt />);
    act(() => {
      showApp();
      window.dispatchEvent(new Event('focus'));
    });
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('keeps checking every few minutes while open', () => {
    render(<PwaUpdatePrompt />);
    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('shows the bar again for an already-downloaded version (after a dismiss)', () => {
    registration.waiting = {};
    render(<PwaUpdatePrompt />);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => showApp());
    expect(screen.getByRole('status').textContent).toMatch(/new version/i);
  });
});
