const KST_OFFSET_MS = 9 * 3600e3;
const DAY_MS = 86400e3;
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function dateToUtcMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function utcMsToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function kstDate(now: Date): string {
  return utcMsToDate(now.getTime() + KST_OFFSET_MS);
}

export function addDays(date: string, n: number): string {
  return utcMsToDate(dateToUtcMs(date) + n * DAY_MS);
}

/** 0 = Monday … 6 = Sunday */
export function kstWeekday(date: string): number {
  return (new Date(dateToUtcMs(date)).getUTCDay() + 6) % 7;
}

export function weekStartOf(date: string): string {
  return addDays(date, -kstWeekday(date));
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function nextKstMidnight(now: Date): Date {
  return new Date(dateToUtcMs(addDays(kstDate(now), 1)) - KST_OFFSET_MS);
}

export function formatKstTime(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(11, 16);
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60e3));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export function formatDateLabel(date: string): string {
  const [, mm, dd] = date.split('-');
  return `${Number(mm)}/${Number(dd)}(${WEEKDAY_LABELS[kstWeekday(date)]})`;
}

export function weekdayLabel(i: number): string {
  return WEEKDAY_LABELS[i];
}
