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

/** 그 주의 첫날. start='mon'이면 월요일, 'sun'이면 일요일 */
export function weekStartOf(date: string, start: 'mon' | 'sun' = 'mon'): string {
  const offset = start === 'mon' ? kstWeekday(date) : (kstWeekday(date) + 1) % 7;
  return addDays(date, -offset);
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

/** KST 날짜 + "HH:MM" → 시각. 형식이 틀리면 null */
export function kstDateTime(date: string, hhmm: string): Date | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const ms = Date.parse(`${date}T${hhmm}:00Z`);
  return Number.isNaN(ms) ? null : new Date(ms - KST_OFFSET_MS);
}
