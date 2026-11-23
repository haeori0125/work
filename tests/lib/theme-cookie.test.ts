import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '@/lib/prefs-shared';
import { decodeThemeCookie, encodeThemeCookie } from '@/lib/theme-cookie';

describe('theme cookie', () => {
  it('round-trips the theme colors', () => {
    const p = { ...DEFAULT_PREFS, themeH: 348, themeS: 74, themeL: 84, doingHex: 'F3D98B', doneHex: null };
    const c = encodeThemeCookie(p);
    expect(c).toBe('348.74.84.F3D98B.-');
    expect(decodeThemeCookie(c)).toEqual({ ...DEFAULT_PREFS, themeH: 348, themeS: 74, themeL: 84, doingHex: 'F3D98B' });
  });
  it('rejects anything malformed or out of range', () => {
    for (const bad of ['', 'x', '400.10.50.-.-', '10.10.99.-.-', '10.10.50.zz.-', '10.10.50.-.-;color:red', '1.2.30.-']) {
      expect(decodeThemeCookie(bad)).toBeNull();
    }
    expect(decodeThemeCookie(undefined)).toBeNull();
  });
});
