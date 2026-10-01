/**
 * Public business card → what the login page/headers display.
 */
import { describe, it, expect } from 'vitest';
import { toBusinessSettings } from '../../hooks/useBusinessSettings';

describe('toBusinessSettings', () => {
  it('reads the public card', () => {
    expect(
      toBusinessSettings({
        businessName: 'Maple Crumb',
        businessAddress: '42 Oven Lane',
        businessCity: 'North Vancouver',
        businessPhone: '604-555-0142',
        businessEmail: 'hello@maple.test',
        logoUrl: 'https://cdn.test/logo.png',
      })
    ).toEqual({
      businessName: 'Maple Crumb',
      businessAddress: '42 Oven Lane',
      businessCity: 'North Vancouver',
      businessPhone: '604-555-0142',
      businessEmail: 'hello@maple.test',
      logoUrl: 'https://cdn.test/logo.png',
    });
  });

  it('missing card or fields → empty strings, so the UI hides them (no placeholder text)', () => {
    const empty = toBusinessSettings(undefined);
    expect(Object.values(empty).every((v) => v === '')).toBe(true);
    expect(toBusinessSettings({ businessName: 'X' }).businessPhone).toBe('');
  });

  it('ignores non-https logo URLs', () => {
    expect(toBusinessSettings({ logoUrl: 'javascript:alert(1)' }).logoUrl).toBe('');
  });
});

import { logoFileProblem } from '../../services/firebase/storageService';

describe('logoFileProblem', () => {
  it('accepts PNG, JPG and WebP up to 2 MB', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(logoFileProblem({ type, size: 500_000 })).toBeNull();
    }
  });
  it('rejects SVG/GIF (email clients) and files over 2 MB', () => {
    expect(logoFileProblem({ type: 'image/svg+xml', size: 1000 })).toMatch(/PNG, JPG or WebP/);
    expect(logoFileProblem({ type: 'image/gif', size: 1000 })).toMatch(/PNG, JPG or WebP/);
    expect(logoFileProblem({ type: 'image/png', size: 3 * 1024 * 1024 })).toMatch(/2 MB/);
  });
});
