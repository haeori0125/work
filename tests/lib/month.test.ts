import { describe, expect, it } from 'vitest';
import { monthRange, shiftMonth } from '@/lib/month';

describe('monthRange', () => {
  it('returns first and last day', () => {
    expect(monthRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
  it('rejects bad input', () => {
    expect(monthRange('2026-13')).toBeNull();
    expect(monthRange('abc')).toBeNull();
  });
});

describe('shiftMonth', () => {
  it('crosses year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});
