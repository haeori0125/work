import { describe, expect, it } from 'vitest';
import { hexToHsl, hslToHex, inkOn, parseHex, themeVars } from '@/lib/color';
import { DEFAULT_PREFS } from '@/lib/prefs';

describe('parseHex', () => {
  it('normalizes valid codes', () => {
    expect(parseHex('#a3b1f0')).toBe('A3B1F0');
    expect(parseHex(' A3B1F0 ')).toBe('A3B1F0');
  });
  it('rejects malformed codes', () => {
    expect(parseHex('A3B1F')).toBeNull();
    expect(parseHex('GGGGGG')).toBeNull();
    expect(parseHex('')).toBeNull();
  });
});

describe('hex <-> hsl', () => {
  it('round-trips within 3 per channel', () => {
    const { h, s, l } = hexToHsl('F4B6C2');
    const back = hslToHex(h, s, l);
    for (let i = 0; i < 6; i += 2) {
      expect(Math.abs(parseInt(back.slice(i, i + 2), 16) - parseInt('F4B6C2'.slice(i, i + 2), 16))).toBeLessThanOrEqual(3);
    }
  });
});

describe('inkOn', () => {
  it('uses dark ink on light colors and white on dark', () => {
    expect(inkOn(232, 76)).toMatch(/^hsl\(/);
    expect(inkOn(232, 40)).toBe('#ffffff');
  });
});

describe('themeVars', () => {
  it('leaves status colors automatic by default', () => {
    const v = themeVars(DEFAULT_PREFS);
    expect(v['--h']).toBe('232');
    expect(v['--dh']).toBeUndefined();
    expect(v['--oh']).toBeUndefined();
  });
  it('sets status color variables when chosen', () => {
    const v = themeVars({ ...DEFAULT_PREFS, doingHex: 'F3D98B', doneHex: '4F9D69' });
    expect(v['--dh']).toBeDefined();
    expect(v['--oh']).toBeDefined();
    expect(v['--on-done']).toBe('#ffffff');
  });
});
