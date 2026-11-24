// 현장 수업: 화면(클라이언트)에서도 쓰는 상수·타입. DB 코드를 가져오지 않는다.

/** 현장 수업 시간대(고정) */
export const SLOTS = [
  { key: 'pm', label: '오후', time: '13:30–17:00' },
  { key: 'eve', label: '저녁', time: '18:30–22:00' },
] as const;
export type Slot = (typeof SLOTS)[number]['key'];

/** 관리자가 정하는 기간(예: 1–2월 고3N수 현장강의 2027-01-01 ~ 2027-02-28) */
export type Period = { id: number; name: string; startDate: string; endDate: string };

export type Person = { id: number; name: string };
/** 기본 스케줄: weekday(0=월) → slot → 사람들 */
export type BaseWeek = Record<number, Record<Slot, Person[]>>;
/** 기본 스케줄 칸의 지점명: weekday → slot → 이름(없으면 null) */
export type BaseTitles = Record<number, Record<Slot, string | null>>;
export type Change = { id: number; date: string; slot: Slot; user: Person; kind: 'off' | 'on'; note: string | null };
export type DaySlot = { slot: Slot; title: string | null; staff: (Person & { added: boolean })[]; off: (Person & { note: string | null })[] };
export type OnsiteDay = { date: string; periodId: number | null; slots: DaySlot[] };

/** 막대·제목에 보일 이름: 지점명, 없으면 오후/저녁 */
export const slotName = (slot: Slot, title: string | null) => title || (slot === 'pm' ? '오후' : '저녁');

/** 그 날짜에 적용되는 기간: 겹치면 늦게 시작한(더 좁은) 기간 */
export function periodFor(periods: Period[], date: string): Period | null {
  return periods.filter((p) => p.startDate <= date && date <= p.endDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id - a.id)[0] ?? null;
}
