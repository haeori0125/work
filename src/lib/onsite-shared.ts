// 현장 수업: 화면(클라이언트)에서도 쓰는 상수·타입. DB 코드를 가져오지 않는다.

/** 현장 강의 시간대(고정) */
export const SLOTS = [
  { key: 'pm', label: '오후', time: '13:30–17:00' },
  { key: 'eve', label: '저녁', time: '18:30–22:00' },
] as const;
export type Slot = (typeof SLOTS)[number]['key'];
export const SLOT_INFO = Object.fromEntries(SLOTS.map((s) => [s.key, s])) as Record<Slot, (typeof SLOTS)[number]>;
export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

export type Person = { id: number; name: string };
/** 강의: 지점명 · 요일(0=월) · 시간대 · 기간 · 기본 출근 */
export type Lecture = { id: number; title: string; weekday: number; slot: Slot; startDate: string; endDate: string; staff: Person[] };
export type Change = { id: number; lectureId: number; title: string; slot: Slot; date: string; user: Person; kind: 'off' | 'on'; note: string | null };
export type DayLecture = { lectureId: number; title: string; slot: Slot; staff: (Person & { added: boolean })[]; off: (Person & { note: string | null })[] };
export type OnsiteDay = { date: string; lectures: DayLecture[] };
