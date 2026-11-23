import { kstWeekday, weekStartOf } from './time';

export type Kind = 'dated' | 'weekly';
export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly_days' | 'weekly';

export type RecurrenceSpec = {
  kind: Kind;
  repeat: Repeat;
  weekdays: number[];
  startDate: string;
  endDate: string | null;
};

const DATED_REPEATS: Repeat[] = ['none', 'daily', 'weekdays', 'weekly_days'];
const WEEKLY_REPEATS: Repeat[] = ['none', 'weekly'];

function inRange(spec: RecurrenceSpec, date: string): boolean {
  return date >= spec.startDate && (spec.endDate === null || date <= spec.endDate);
}

export function occursOn(spec: RecurrenceSpec, date: string): boolean {
  if (spec.kind !== 'dated') return false;
  switch (spec.repeat) {
    case 'none': return date === spec.startDate;
    case 'daily': return inRange(spec, date);
    case 'weekdays': return inRange(spec, date) && kstWeekday(date) < 5;
    case 'weekly_days': return inRange(spec, date) && spec.weekdays.includes(kstWeekday(date));
    default: return false;
  }
}

export function occursInWeek(spec: RecurrenceSpec, weekStart: string): boolean {
  if (spec.kind !== 'weekly') return false;
  const first = weekStartOf(spec.startDate);
  if (spec.repeat === 'none') return weekStart === first;
  if (spec.repeat === 'weekly') {
    return weekStart >= first && (spec.endDate === null || weekStart <= weekStartOf(spec.endDate));
  }
  return false;
}

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function validateRecurrence(spec: RecurrenceSpec): string | null {
  const allowed = spec.kind === 'dated' ? DATED_REPEATS : spec.kind === 'weekly' ? WEEKLY_REPEATS : null;
  if (!allowed) return '업무 종류가 올바르지 않습니다';
  if (!allowed.includes(spec.repeat)) return '업무 종류에 맞지 않는 반복 설정입니다';
  if (!isValidDate(spec.startDate)) return '시작일을 입력하세요';
  if (spec.endDate !== null && !isValidDate(spec.endDate)) return '종료일이 올바르지 않습니다';
  if (spec.endDate !== null && spec.endDate < spec.startDate) return '종료일이 시작일보다 빠릅니다';
  if (spec.repeat === 'weekly_days') {
    if (spec.weekdays.length === 0) return '반복 요일을 하나 이상 선택하세요';
    if (spec.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return '반복 요일이 올바르지 않습니다';
  }
  return null;
}
