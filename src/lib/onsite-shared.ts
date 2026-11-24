// 현장 수업: 화면(클라이언트)에서도 쓰는 상수·타입. DB 코드를 가져오지 않는다.

/** 현장 수업 시간대(고정) */
export const SLOTS = [
  { key: 'pm', label: '오후', time: '13:30–17:00' },
  { key: 'eve', label: '저녁', time: '18:30–22:00' },
] as const;
export type Slot = (typeof SLOTS)[number]['key'];

/** 기본 스케줄이 바뀌는 기간: 1–2월, 3–6월, 7–8월, 9–11월, 12월 */
export const TERMS = [
  { n: 1, label: '1–2월', from: 1, to: 2 },
  { n: 2, label: '3–6월', from: 3, to: 6 },
  { n: 3, label: '7–8월', from: 7, to: 8 },
  { n: 4, label: '9–11월', from: 9, to: 11 },
  { n: 5, label: '12월', from: 12, to: 12 },
] as const;

/** "2026-12-05" → "2026-5" */
export function termOf(date: string): string {
  const m = Number(date.slice(5, 7));
  return `${date.slice(0, 4)}-${TERMS.find((t) => m >= t.from && m <= t.to)!.n}`;
}
export function termLabel(term: string): string {
  const [y, n] = term.split('-').map(Number);
  return `${y}년 ${TERMS.find((t) => t.n === n)?.label ?? ''}`;
}
/** 앞/뒤 기간 */
export function shiftTerm(term: string, d: number): string {
  const [y, n] = term.split('-').map(Number);
  const i = (y * 5 + (n - 1)) + d;
  return `${Math.floor(i / 5)}-${(i % 5) + 1}`;
}

export type Person = { id: number; name: string };
/** 기본 스케줄: weekday(0=월) → slot → 사람들 */
export type BaseWeek = Record<number, Record<Slot, Person[]>>;
export type Change = { id: number; date: string; slot: Slot; user: Person; kind: 'off' | 'on'; note: string | null };
export type DaySlot = { slot: Slot; staff: (Person & { added: boolean })[]; off: (Person & { note: string | null })[] };
export type OnsiteDay = { date: string; term: string; slots: DaySlot[] };
