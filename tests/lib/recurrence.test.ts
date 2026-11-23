import { describe, expect, it } from 'vitest';
import { occursInWeek, occursOn, validateRecurrence, type RecurrenceSpec } from '@/lib/recurrence';

const dated = (p: Partial<RecurrenceSpec>): RecurrenceSpec => ({
  kind: 'dated', repeat: 'none', weekdays: [], startDate: '2026-11-25', endDate: null, ...p,
});
const weekly = (p: Partial<RecurrenceSpec>): RecurrenceSpec => ({
  kind: 'weekly', repeat: 'none', weekdays: [], startDate: '2026-11-25', endDate: null, ...p,
});

describe('occursOn (dated tasks)', () => {
  it('one-off occurs only on its date', () => {
    expect(occursOn(dated({}), '2026-11-25')).toBe(true);
    expect(occursOn(dated({}), '2026-11-26')).toBe(false);
  });
  it('daily respects start and end dates', () => {
    const s = dated({ repeat: 'daily', endDate: '2026-11-27' });
    expect(occursOn(s, '2026-11-24')).toBe(false);
    expect(occursOn(s, '2026-11-25')).toBe(true);
    expect(occursOn(s, '2026-11-27')).toBe(true);
    expect(occursOn(s, '2026-11-28')).toBe(false);
  });
  it('weekdays skips Saturday and Sunday', () => {
    const s = dated({ repeat: 'weekdays', startDate: '2026-11-23' });
    expect(occursOn(s, '2026-11-27')).toBe(true);
    expect(occursOn(s, '2026-11-28')).toBe(false);
    expect(occursOn(s, '2026-11-29')).toBe(false);
  });
  it('weekly_days occurs only on chosen weekdays', () => {
    const s = dated({ repeat: 'weekly_days', weekdays: [0, 2], startDate: '2026-11-23' });
    expect(occursOn(s, '2026-11-25')).toBe(true);
    expect(occursOn(s, '2026-11-24')).toBe(false);
    expect(occursOn(s, '2026-11-30')).toBe(true);
  });
  it('weekly-kind specs never occur on a day', () => {
    expect(occursOn(weekly({}), '2026-11-25')).toBe(false);
  });
});

describe('occursInWeek (weekly tasks)', () => {
  it('one-off weekly task occurs only in the week of its start date', () => {
    expect(occursInWeek(weekly({}), '2026-11-23')).toBe(true);
    expect(occursInWeek(weekly({}), '2026-11-30')).toBe(false);
  });
  it('repeating weekly task respects start and end weeks', () => {
    const s = weekly({ repeat: 'weekly', endDate: '2026-12-02' });
    expect(occursInWeek(s, '2026-11-16')).toBe(false);
    expect(occursInWeek(s, '2026-11-23')).toBe(true);
    expect(occursInWeek(s, '2026-11-30')).toBe(true);
    expect(occursInWeek(s, '2026-12-07')).toBe(false);
  });
  it('dated specs never occur as weekly', () => {
    expect(occursInWeek(dated({ repeat: 'daily' }), '2026-11-23')).toBe(false);
  });
});

describe('validateRecurrence', () => {
  it('accepts valid specs', () => {
    expect(validateRecurrence(dated({ repeat: 'daily' }))).toBeNull();
    expect(validateRecurrence(weekly({ repeat: 'weekly' }))).toBeNull();
  });
  it('rejects weekly_days with no days', () => {
    expect(validateRecurrence(dated({ repeat: 'weekly_days', weekdays: [] }))).toBe('반복 요일을 하나 이상 선택하세요');
  });
  it('rejects end before start', () => {
    expect(validateRecurrence(dated({ repeat: 'daily', endDate: '2026-11-24' }))).toBe('종료일이 시작일보다 빠릅니다');
  });
  it('rejects repeat options that do not fit the kind', () => {
    expect(validateRecurrence(weekly({ repeat: 'daily' }))).not.toBeNull();
    expect(validateRecurrence(dated({ repeat: 'weekly' }))).not.toBeNull();
  });
  it('rejects malformed dates and weekday numbers', () => {
    expect(validateRecurrence(dated({ startDate: '2026-13-01' }))).not.toBeNull();
    expect(validateRecurrence(dated({ repeat: 'weekly_days', weekdays: [7] }))).not.toBeNull();
  });
});
