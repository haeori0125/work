import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { onsiteBase, onsiteChanges, users } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppError } from './errors';
import { addDays, kstWeekday } from './time';

export { SLOTS, TERMS, shiftTerm, termLabel, termOf } from './onsite-shared';
export type { Slot } from './onsite-shared';
import { SLOTS, termOf, type BaseWeek, type Change, type OnsiteDay, type Slot } from './onsite-shared';
export type { BaseWeek, Change, DaySlot, OnsiteDay, Person } from './onsite-shared';

const TERM_RE = /^\d{4}-[1-5]$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isSlot = (s: string): s is Slot => s === 'pm' || s === 'eve';
const person = (r: { id: number; name: string }) => ({ id: r.id, name: r.name });
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ko');


export async function getBaseWeek(db: Db, term: string): Promise<BaseWeek> {
  const rows = await db.select({ weekday: onsiteBase.weekday, slot: onsiteBase.slot, id: users.id, name: users.name })
    .from(onsiteBase).innerJoin(users, eq(users.id, onsiteBase.userId)).where(eq(onsiteBase.term, term));
  const week: BaseWeek = {};
  for (let w = 0; w < 7; w++) week[w] = { pm: [], eve: [] };
  for (const r of rows) week[r.weekday][r.slot].push(person(r));
  for (let w = 0; w < 7; w++) for (const s of SLOTS) week[w][s.key].sort(byName);
  return week;
}

/** 기본 스케줄 한 칸(기간·요일·시간대)의 사람을 통째로 정한다 */
export async function setBaseCell(db: Db, term: string, weekday: number, slot: string, userIds: number[]): Promise<void> {
  if (!TERM_RE.test(term) || !Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !isSlot(slot)) {
    throw new AppError('invalid', '스케줄 칸이 올바르지 않습니다');
  }
  const ids = [...new Set(userIds)];
  await checkUsers(db, ids);
  await db.delete(onsiteBase).where(and(eq(onsiteBase.term, term), eq(onsiteBase.weekday, weekday), eq(onsiteBase.slot, slot)));
  if (ids.length) await db.insert(onsiteBase).values(ids.map((userId) => ({ term, weekday, slot, userId })));
}

/** 다른 기간의 기본 스케줄을 그대로 가져온다(이 기간 것은 지워짐) */
export async function copyBaseWeek(db: Db, fromTerm: string, toTerm: string): Promise<void> {
  if (!TERM_RE.test(fromTerm) || !TERM_RE.test(toTerm) || fromTerm === toTerm) throw new AppError('invalid', '기간이 올바르지 않습니다');
  const rows = await db.select().from(onsiteBase).where(eq(onsiteBase.term, fromTerm));
  await db.delete(onsiteBase).where(eq(onsiteBase.term, toTerm));
  if (rows.length) await db.insert(onsiteBase).values(rows.map((r) => ({ ...r, term: toTerm })));
}

async function checkUsers(db: Db, ids: number[]) {
  if (ids.some((x) => !Number.isInteger(x))) throw new AppError('invalid', '사람을 다시 골라 주세요');
  if (!ids.length) return;
  const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids));
  if (found.length !== ids.length) throw new AppError('invalid', '없는 멤버가 들어 있습니다');
}


/**
 * 그날 그 시간대의 변동을 정한다. kind=null이면 변동을 지운다(기본대로).
 * 기본에 있는 사람은 'off'만, 없는 사람은 'on'만 의미가 있다.
 */
export async function setChange(db: Db, actorId: number, input: { date: string; slot: string; userId: number; kind: 'off' | 'on' | null; note?: string | null }, now: Date): Promise<void> {
  const { date, slot, userId, kind } = input;
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || !isSlot(slot)) throw new AppError('invalid', '날짜나 시간대가 올바르지 않습니다');
  await checkUsers(db, [userId]);
  const where = and(eq(onsiteChanges.date, date), eq(onsiteChanges.slot, slot), eq(onsiteChanges.userId, userId));
  await db.delete(onsiteChanges).where(where);
  if (kind === null) return;
  if (kind !== 'off' && kind !== 'on') throw new AppError('invalid', '변동 종류가 올바르지 않습니다');
  const note = input.note?.trim() || null;
  if (note && note.length > 100) throw new AppError('invalid', '메모는 100자 이하로 입력하세요');
  const base = await getBaseWeek(db, termOf(date));
  const inBase = base[kstWeekday(date)][slot].some((p) => p.id === userId);
  if (kind === 'off' && !inBase) throw new AppError('invalid', '원래 출근이 아닌 사람은 빠짐으로 바꿀 수 없습니다');
  if (kind === 'on' && inBase) throw new AppError('invalid', '이미 기본 스케줄에 있는 사람입니다');
  await db.insert(onsiteChanges).values({ date, slot, userId, kind, note, createdBy: actorId, createdAt: now });
}

export async function listChanges(db: Db, from: string, to: string): Promise<Change[]> {
  const rows = await db.select({
    id: onsiteChanges.id, date: onsiteChanges.date, slot: onsiteChanges.slot, kind: onsiteChanges.kind, note: onsiteChanges.note,
    uid: users.id, name: users.name,
  }).from(onsiteChanges).innerJoin(users, eq(users.id, onsiteChanges.userId))
    .where(and(gte(onsiteChanges.date, from), lte(onsiteChanges.date, to)));
  return rows.map((r) => ({ id: r.id, date: r.date, slot: r.slot, kind: r.kind, note: r.note, user: { id: r.uid, name: r.name } }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot) * -1 || byName(a.user, b.user));
}


/** 기간 안 날짜마다 실제 출근(기본 − 빠짐 + 추가) */
export async function getOnsiteDays(db: Db, from: string, to: string): Promise<OnsiteDay[]> {
  const changes = await listChanges(db, from, to);
  const terms = new Map<string, BaseWeek>();
  const days: OnsiteDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const term = termOf(d);
    if (!terms.has(term)) terms.set(term, await getBaseWeek(db, term));
    const base = terms.get(term)![kstWeekday(d)];
    days.push({
      date: d, term,
      slots: SLOTS.map(({ key }) => {
        const here = changes.filter((c) => c.date === d && c.slot === key);
        const offIds = new Set(here.filter((c) => c.kind === 'off').map((c) => c.user.id));
        const staff = [
          ...base[key].filter((p) => !offIds.has(p.id)).map((p) => ({ ...p, added: false })),
          ...here.filter((c) => c.kind === 'on').map((c) => ({ ...c.user, added: true })),
        ].sort(byName);
        const off = here.filter((c) => c.kind === 'off').map((c) => ({ ...c.user, note: c.note }));
        return { slot: key, staff, off };
      }),
    });
  }
  return days;
}
