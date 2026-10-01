/**
 * PWA install logic: device detection and which install UI to show.
 */
import { describe, it, expect } from 'vitest';
import {
  isIOSDevice,
  isAndroidDevice,
  isStandaloneDisplay,
  resolveInstallMode,
  isInstallCardSnoozed,
  snoozeInstallCard,
  INSTALL_CARD_SNOOZE_DAYS,
} from '../../pwa/installPrompt';

describe('isIOSDevice', () => {
  it('detects iPhone and iPad', () => {
    expect(isIOSDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
    expect(isIOSDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 5)).toBe(true);
  });

  it('detects iPadOS, which reports itself as a Mac but has touch', () => {
    expect(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
  });

  it('a real Mac or Android is not iOS', () => {
    expect(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIOSDevice('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 5)).toBe(false);
  });
});

describe('isStandaloneDisplay', () => {
  const win = (standaloneMedia: boolean, iosStandalone?: boolean) =>
    ({
      matchMedia: () => ({ matches: standaloneMedia }) as MediaQueryList,
      navigator: { standalone: iosStandalone } as unknown as Navigator,
    }) as Pick<Window, 'matchMedia' | 'navigator'>;

  it('true when launched from the home screen (Chrome/Android or iOS)', () => {
    expect(isStandaloneDisplay(win(true))).toBe(true);
    expect(isStandaloneDisplay(win(false, true))).toBe(true);
  });

  it('false in a normal browser tab', () => {
    expect(isStandaloneDisplay(win(false, false))).toBe(false);
  });
});

describe('resolveInstallMode', () => {
  it('hides the button once installed, even if a prompt is pending', () => {
    expect(resolveInstallMode({ standalone: true, hasPrompt: true, ios: false })).toBe('installed');
  });

  it("uses the browser's install dialog when available", () => {
    expect(resolveInstallMode({ standalone: false, hasPrompt: true, ios: false })).toBe('prompt');
  });

  it('shows Add-to-Home-Screen help on iPhone/iPad', () => {
    expect(resolveInstallMode({ standalone: false, hasPrompt: false, ios: true })).toBe('ios');
  });

  it('Android before Chrome allows the dialog: menu instructions', () => {
    expect(resolveInstallMode({ standalone: false, hasPrompt: false, ios: false, android: true })).toBe('android');
    // once Chrome fires the event, the one-tap dialog wins
    expect(resolveInstallMode({ standalone: false, hasPrompt: true, ios: false, android: true })).toBe('prompt');
  });

  it('shows nothing where installing is not possible', () => {
    expect(resolveInstallMode({ standalone: false, hasPrompt: false, ios: false })).toBe('unavailable');
  });
});

describe('isAndroidDevice', () => {
  it('detects Android phones and tablets only', () => {
    expect(isAndroidDevice('Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile')).toBe(true);
    expect(isAndroidDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(false);
    expect(isAndroidDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
  });
});

describe('install card snooze ("Not now")', () => {
  it(`hides the card for ${INSTALL_CARD_SNOOZE_DAYS} days`, () => {
    localStorage.clear();
    const now = Date.UTC(2026, 9, 1);
    expect(isInstallCardSnoozed(now)).toBe(false);
    snoozeInstallCard(now);
    expect(isInstallCardSnoozed(now + 1)).toBe(true);
    expect(isInstallCardSnoozed(now + (INSTALL_CARD_SNOOZE_DAYS - 1) * 86_400_000)).toBe(true);
    expect(isInstallCardSnoozed(now + (INSTALL_CARD_SNOOZE_DAYS + 1) * 86_400_000)).toBe(false);
  });
});
