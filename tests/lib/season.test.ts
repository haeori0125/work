import { describe, expect, it } from 'vitest';
import { isXmasSeason } from '@/lib/season';

describe('isXmasSeason', () => {
  it('11/20 ~ 12/26 only', () => {
    expect(isXmasSeason('2026-11-19')).toBe(false);
    expect(isXmasSeason('2026-11-20')).toBe(true);
    expect(isXmasSeason('2026-12-25')).toBe(true);
    expect(isXmasSeason('2026-12-26')).toBe(true);
    expect(isXmasSeason('2026-12-27')).toBe(false);
    expect(isXmasSeason('2027-01-05')).toBe(false);
  });
});
