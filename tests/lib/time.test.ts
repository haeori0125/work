import { describe, expect, it } from 'vitest';
import {
  addDays, formatDateLabel, formatDuration, formatKstTime, kstDate, kstWeekday,
  nextKstMidnight, weekDates, weekStartOf,
} from '@/lib/time';

describe('kstDate', () => {
  it('rolls over at KST midnight (UTC 15:00)', () => {
    expect(kstDate(new Date('2026-11-23T14:59:00Z'))).toBe('2026-11-23');
    expect(kstDate(new Date('2026-11-23T15:00:00Z'))).toBe('2026-11-24');
  });
});

describe('week helpers', () => {
  it('weekStartOf returns the Monday', () => {
    expect(weekStartOf('2026-11-29')).toBe('2026-11-23');
    expect(weekStartOf('2026-11-23')).toBe('2026-11-23');
  });
  it('kstWeekday is 0 for Monday, 6 for Sunday', () => {
    expect(kstWeekday('2026-11-23')).toBe(0);
    expect(kstWeekday('2026-11-29')).toBe(6);
  });
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-01', -1)).toBe('2026-11-30');
  });
  it('weekDates lists 7 days', () => {
    expect(weekDates('2026-11-23')).toEqual([
      '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29',
    ]);
  });
});

describe('nextKstMidnight', () => {
  it('returns the coming KST midnight', () => {
    expect(nextKstMidnight(new Date('2026-11-23T03:00:00Z')).toISOString()).toBe('2026-11-23T15:00:00.000Z');
    expect(nextKstMidnight(new Date('2026-11-23T15:00:00Z')).toISOString()).toBe('2026-11-24T15:00:00.000Z');
  });
});

describe('formatting', () => {
  it('formats KST time', () => {
    expect(formatKstTime(new Date('2026-11-23T00:02:00Z'))).toBe('09:02');
  });
  it('formats durations', () => {
    expect(formatDuration(9 * 3600e3 + 8 * 60e3)).toBe('9시간 8분');
    expect(formatDuration(42 * 60e3)).toBe('42분');
  });
  it('formats date labels', () => {
    expect(formatDateLabel('2026-11-23')).toBe('11/23(월)');
  });
});

describe('kstDateTime', () => {
  it('builds an instant from a KST date and HH:MM', async () => {
    const { kstDateTime } = await import('@/lib/time');
    expect(kstDateTime('2026-11-23', '09:02')!.toISOString()).toBe('2026-11-23T00:02:00.000Z');
    expect(kstDateTime('2026-11-24', '00:30')!.toISOString()).toBe('2026-11-23T15:30:00.000Z');
  });
  it('returns null for malformed times', async () => {
    const { kstDateTime } = await import('@/lib/time');
    expect(kstDateTime('2026-11-23', '25:00')).toBeNull();
    expect(kstDateTime('2026-11-23', '')).toBeNull();
  });
});

describe('weekStartOf with sunday start', () => {
  it('returns the Sunday on or before the date', async () => {
    const { weekStartOf } = await import('@/lib/time');
    expect(weekStartOf('2026-11-25', 'sun')).toBe('2026-11-22');
    expect(weekStartOf('2026-11-22', 'sun')).toBe('2026-11-22');
    expect(weekStartOf('2026-11-21', 'sun')).toBe('2026-11-15');
  });
});
