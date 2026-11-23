import { describe, expect, it } from 'vitest';
import { pctOfDay } from '@/lib/view';

describe('pctOfDay', () => {
  it('maps 06:00–24:00 KST onto 0–100', () => {
    expect(pctOfDay(new Date('2026-11-22T21:00:00Z'), '2026-11-23')).toBe(0); // 06:00 KST
    expect(pctOfDay(new Date('2026-11-23T06:00:00Z'), '2026-11-23')).toBe(50); // 15:00 KST
    expect(pctOfDay(new Date('2026-11-23T15:00:00Z'), '2026-11-23')).toBe(100); // 24:00 KST
  });
  it('clamps times outside the scale', () => {
    expect(pctOfDay(new Date('2026-11-22T18:00:00Z'), '2026-11-23')).toBe(0); // 03:00 KST
  });
});
