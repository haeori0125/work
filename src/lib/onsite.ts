import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { onsiteLectureChanges, onsiteLectures, onsiteLectureStaff, users } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppError } from './errors';
import type { Change, Lecture, OnsiteDay, Slot } from './onsite-shared';
import { addDays, kstWeekday } from './time';

export { SLOTS, SLOT_INFO, WEEKDAYS } from './onsite-shared';
export type { Change, DayLecture, Lecture, OnsiteDay, Person, Slot } from './onsite-shared';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (d: string) => DATE_RE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
const isSlot = (s: string): s is Slot => s === 'pm' || s === 'eve';
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ko');
/** 요일 → 오후/저녁 → 지점명 순 */
const lectureOrder = (a: Lecture, b: Lecture) =>
  a.weekday - b.weekday || (a.slot === b.slot ? 0 : a.slot === 'pm' ? -1 : 1) || a.title.localeCompare(b.title, 'ko') || a.id - b.id;

export type LectureInput = { title: string; weekday: number; slot: string; startDate: string; endDate: string; staffIds: number[] };

async function checkUsers(db: Db, ids: number[]) {
  if (ids.some((x) => !Number.isInteger(x))) throw new AppError('invalid', '사람을 다시 골라 주세요');
  if (!ids.length) return;
  const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids));
  if (found.length !== ids.length) throw new AppError('invalid', '없는 멤버가 들어 있습니다');
}

async function clean(db: Db, input: LectureInput) {
  const title = input.title.trim();
  if (!title) throw new AppError('invalid', '지점명을 입력하세요');
  if (title.length > 30) throw new AppError('invalid', '지점명은 30자 이하로 입력하세요');
  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) throw new AppError('invalid', '요일을 골라 주세요');
  if (!isSlot(input.slot)) throw new AppError('invalid', '시간대를 골라 주세요');
  if (!isDate(input.startDate) || !isDate(input.endDate)) throw new AppError('invalid', '시작일과 종료일을 골라 주세요');
  if (input.endDate < input.startDate) throw new AppError('invalid', '종료일이 시작일보다 빠릅니다');
  const staffIds = [...new Set(input.staffIds)];
  await checkUsers(db, staffIds);
  return { title, weekday: input.weekday, slot: input.slot, startDate: input.startDate, endDate: input.endDate, staffIds };
}

async function setStaff(db: Db, lectureId: number, ids: number[]) {
  await db.delete(onsiteLectureStaff).where(eq(onsiteLectureStaff.lectureId, lectureId));
  if (ids.length) await db.insert(onsiteLectureStaff).values(ids.map((userId) => ({ lectureId, userId })));
}

export async function createLecture(db: Db, input: LectureInput, now: Date): Promise<number> {
  const { staffIds, ...v } = await clean(db, input);
  const [row] = await db.insert(onsiteLectures).values({ ...v, createdAt: now }).returning({ id: onsiteLectures.id });
  await setStaff(db, row.id, staffIds);
  return row.id;
}

export async function updateLecture(db: Db, id: number, input: LectureInput): Promise<void> {
  const { staffIds, ...v } = await clean(db, input);
  const done = await db.update(onsiteLectures).set(v).where(eq(onsiteLectures.id, id)).returning({ id: onsiteLectures.id });
  if (!done.length) throw new AppError('not_found', '강의를 찾을 수 없습니다');
  await setStaff(db, id, staffIds);
}

export async function deleteLecture(db: Db, id: number): Promise<void> {
  await db.delete(onsiteLectures).where(eq(onsiteLectures.id, id));
}

/** 기간이 [from, to]와 겹치는 강의(요일·시간대·지점명 순) */
export async function listLectures(db: Db, from: string, to: string): Promise<Lecture[]> {
  const rows = await db.select().from(onsiteLectures)
    .where(and(lte(onsiteLectures.startDate, to), gte(onsiteLectures.endDate, from))).orderBy(asc(onsiteLectures.id));
  if (!rows.length) return [];
  const staff = await db.select({ lectureId: onsiteLectureStaff.lectureId, id: users.id, name: users.name })
    .from(onsiteLectureStaff).innerJoin(users, eq(users.id, onsiteLectureStaff.userId))
    .where(inArray(onsiteLectureStaff.lectureId, rows.map((r) => r.id)));
  return rows.map((r) => ({
    id: r.id, title: r.title, weekday: r.weekday, slot: r.slot, startDate: r.startDate, endDate: r.endDate,
    staff: staff.filter((s) => s.lectureId === r.id).map(({ id, name }) => ({ id, name })).sort(byName),
  })).sort(lectureOrder);
}

async function getLecture(db: Db, id: number): Promise<Lecture> {
  const [row] = await db.select().from(onsiteLectures).where(eq(onsiteLectures.id, id));
  if (!row) throw new AppError('not_found', '강의를 찾을 수 없습니다');
  return (await listLectures(db, row.startDate, row.endDate)).find((l) => l.id === id)!;
}

/**
 * 그날 그 강의의 변동을 정한다. kind=null이면 지운다(기본대로).
 * 기본 출근인 사람은 'off'만, 아닌 사람은 'on'만 의미가 있다.
 */
export async function setChange(db: Db, actorId: number, input: { lectureId: number; date: string; userId: number; kind: 'off' | 'on' | null; note?: string | null }, now: Date): Promise<void> {
  const { lectureId, date, userId, kind } = input;
  if (!isDate(date)) throw new AppError('invalid', '날짜가 올바르지 않습니다');
  const lec = await getLecture(db, lectureId);
  if (date < lec.startDate || date > lec.endDate || kstWeekday(date) !== lec.weekday) throw new AppError('invalid', '그날은 이 강의가 없습니다');
  await checkUsers(db, [userId]);
  await db.delete(onsiteLectureChanges).where(and(eq(onsiteLectureChanges.lectureId, lectureId), eq(onsiteLectureChanges.date, date), eq(onsiteLectureChanges.userId, userId)));
  if (kind === null) return;
  if (kind !== 'off' && kind !== 'on') throw new AppError('invalid', '변동 종류가 올바르지 않습니다');
  const note = input.note?.trim() || null;
  if (note && note.length > 100) throw new AppError('invalid', '메모는 100자 이하로 입력하세요');
  const inBase = lec.staff.some((p) => p.id === userId);
  if (kind === 'off' && !inBase) throw new AppError('invalid', '원래 출근이 아닌 사람은 빠짐으로 바꿀 수 없습니다');
  if (kind === 'on' && inBase) throw new AppError('invalid', '이미 이 강의 담당입니다');
  await db.insert(onsiteLectureChanges).values({ lectureId, date, userId, kind, note, createdBy: actorId, createdAt: now });
}

export async function listChanges(db: Db, from: string, to: string): Promise<Change[]> {
  const rows = await db.select({
    id: onsiteLectureChanges.id, lectureId: onsiteLectureChanges.lectureId, date: onsiteLectureChanges.date,
    kind: onsiteLectureChanges.kind, note: onsiteLectureChanges.note, title: onsiteLectures.title, slot: onsiteLectures.slot,
    uid: users.id, name: users.name,
  }).from(onsiteLectureChanges)
    .innerJoin(onsiteLectures, eq(onsiteLectures.id, onsiteLectureChanges.lectureId))
    .innerJoin(users, eq(users.id, onsiteLectureChanges.userId))
    .where(and(gte(onsiteLectureChanges.date, from), lte(onsiteLectureChanges.date, to)));
  return rows.map((r) => ({ id: r.id, lectureId: r.lectureId, title: r.title, slot: r.slot, date: r.date, kind: r.kind, note: r.note, user: { id: r.uid, name: r.name } }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.slot === b.slot ? 0 : a.slot === 'pm' ? -1 : 1) || a.title.localeCompare(b.title, 'ko') || byName(a.user, b.user));
}

/** 날짜마다 열리는 강의와 실제 출근(담당 − 빠짐 + 추가) */
export async function getOnsiteDays(db: Db, from: string, to: string): Promise<OnsiteDay[]> {
  const [lectures, changes] = await Promise.all([listLectures(db, from, to), listChanges(db, from, to)]);
  const days: OnsiteDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = kstWeekday(d);
    days.push({
      date: d,
      lectures: lectures.filter((l) => l.weekday === wd && l.startDate <= d && d <= l.endDate).map((l) => {
        const here = changes.filter((c) => c.lectureId === l.id && c.date === d);
        const offIds = new Set(here.filter((c) => c.kind === 'off').map((c) => c.user.id));
        return {
          lectureId: l.id, title: l.title, slot: l.slot,
          staff: [
            ...l.staff.filter((p) => !offIds.has(p.id)).map((p) => ({ ...p, added: false })),
            ...here.filter((c) => c.kind === 'on').map((c) => ({ ...c.user, added: true })),
          ].sort(byName),
          off: here.filter((c) => c.kind === 'off').map((c) => ({ ...c.user, note: c.note })),
        };
      }),
    });
  }
  return days;
}
