import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { onsiteChanges, onsitePeriods, onsitePeriodStaff, onsitePeriodTitles, users } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppError } from './errors';
import { SLOTS, periodFor, type BaseTitles, type BaseWeek, type Change, type OnsiteDay, type Period, type Slot } from './onsite-shared';
import { addDays, kstWeekday } from './time';

export { SLOTS, periodFor, slotName } from './onsite-shared';
export type { BaseTitles, BaseWeek, Change, DaySlot, OnsiteDay, Period, Person, Slot } from './onsite-shared';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (d: string) => DATE_RE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
const isSlot = (s: string): s is Slot => s === 'pm' || s === 'eve';
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ko');

// ── 기간 ───────────────────────────────────────────
export type PeriodInput = { name: string; startDate: string; endDate: string };

function cleanPeriod(input: PeriodInput): PeriodInput {
  const name = input.name.trim();
  if (!name) throw new AppError('invalid', '기간 이름을 입력하세요');
  if (name.length > 40) throw new AppError('invalid', '기간 이름은 40자 이하로 입력하세요');
  if (!isDate(input.startDate) || !isDate(input.endDate)) throw new AppError('invalid', '시작일과 종료일을 골라 주세요');
  if (input.endDate < input.startDate) throw new AppError('invalid', '종료일이 시작일보다 빠릅니다');
  return { name, startDate: input.startDate, endDate: input.endDate };
}

export async function listPeriods(db: Db): Promise<Period[]> {
  return db.select({ id: onsitePeriods.id, name: onsitePeriods.name, startDate: onsitePeriods.startDate, endDate: onsitePeriods.endDate })
    .from(onsitePeriods).orderBy(asc(onsitePeriods.startDate), asc(onsitePeriods.id));
}

export async function createPeriod(db: Db, input: PeriodInput, now: Date): Promise<number> {
  const [row] = await db.insert(onsitePeriods).values({ ...cleanPeriod(input), createdAt: now }).returning({ id: onsitePeriods.id });
  return row.id;
}

export async function updatePeriod(db: Db, id: number, input: PeriodInput): Promise<void> {
  const done = await db.update(onsitePeriods).set(cleanPeriod(input)).where(eq(onsitePeriods.id, id)).returning({ id: onsitePeriods.id });
  if (!done.length) throw new AppError('not_found', '기간을 찾을 수 없습니다');
}

export async function deletePeriod(db: Db, id: number): Promise<void> {
  await db.delete(onsitePeriods).where(eq(onsitePeriods.id, id));
}

async function mustPeriod(db: Db, id: number) {
  if (!Number.isInteger(id)) throw new AppError('invalid', '기간이 올바르지 않습니다');
  const [p] = await db.select({ id: onsitePeriods.id }).from(onsitePeriods).where(eq(onsitePeriods.id, id));
  if (!p) throw new AppError('not_found', '기간을 찾을 수 없습니다');
}

// ── 기본 스케줄 ─────────────────────────────────────
function emptyWeek<T>(v: () => T): Record<number, Record<Slot, T>> {
  const w: Record<number, Record<Slot, T>> = {};
  for (let d = 0; d < 7; d++) w[d] = { pm: v(), eve: v() };
  return w;
}

export async function getBaseWeek(db: Db, periodId: number): Promise<BaseWeek> {
  const rows = await db.select({ weekday: onsitePeriodStaff.weekday, slot: onsitePeriodStaff.slot, id: users.id, name: users.name })
    .from(onsitePeriodStaff).innerJoin(users, eq(users.id, onsitePeriodStaff.userId)).where(eq(onsitePeriodStaff.periodId, periodId));
  const week: BaseWeek = emptyWeek(() => []);
  for (const r of rows) week[r.weekday][r.slot].push({ id: r.id, name: r.name });
  for (let w = 0; w < 7; w++) for (const s of SLOTS) week[w][s.key].sort(byName);
  return week;
}

export async function getBaseTitles(db: Db, periodId: number): Promise<BaseTitles> {
  const rows = await db.select().from(onsitePeriodTitles).where(eq(onsitePeriodTitles.periodId, periodId));
  const t: BaseTitles = emptyWeek<string | null>(() => null);
  for (const r of rows) t[r.weekday][r.slot] = r.title;
  return t;
}

function checkCell(weekday: number, slot: string): asserts slot is Slot {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !isSlot(slot)) throw new AppError('invalid', '스케줄 칸이 올바르지 않습니다');
}

async function checkUsers(db: Db, ids: number[]) {
  if (ids.some((x) => !Number.isInteger(x))) throw new AppError('invalid', '사람을 다시 골라 주세요');
  if (!ids.length) return;
  const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids));
  if (found.length !== ids.length) throw new AppError('invalid', '없는 멤버가 들어 있습니다');
}

/** 기본 스케줄 한 칸(기간·요일·시간대)의 사람을 통째로 정한다 */
export async function setBaseCell(db: Db, periodId: number, weekday: number, slot: string, userIds: number[]): Promise<void> {
  checkCell(weekday, slot);
  await mustPeriod(db, periodId);
  const ids = [...new Set(userIds)];
  await checkUsers(db, ids);
  const cell = and(eq(onsitePeriodStaff.periodId, periodId), eq(onsitePeriodStaff.weekday, weekday), eq(onsitePeriodStaff.slot, slot));
  await db.delete(onsitePeriodStaff).where(cell);
  if (ids.length) await db.insert(onsitePeriodStaff).values(ids.map((userId) => ({ periodId, weekday, slot, userId })));
}

/** 기본 스케줄 칸의 지점명을 정한다(빈 값이면 지움) */
export async function setBaseTitle(db: Db, periodId: number, weekday: number, slot: string, title: string | null): Promise<void> {
  checkCell(weekday, slot);
  await mustPeriod(db, periodId);
  const t = title?.trim() || null;
  if (t && t.length > 30) throw new AppError('invalid', '지점명은 30자 이하로 입력하세요');
  await db.delete(onsitePeriodTitles).where(and(eq(onsitePeriodTitles.periodId, periodId), eq(onsitePeriodTitles.weekday, weekday), eq(onsitePeriodTitles.slot, slot)));
  if (t) await db.insert(onsitePeriodTitles).values({ periodId, weekday, slot, title: t });
}

/** 다른 기간의 기본 스케줄(사람·지점명)을 그대로 가져온다(이 기간 것은 지워짐) */
export async function copyBaseWeek(db: Db, fromId: number, toId: number): Promise<void> {
  if (fromId === toId) throw new AppError('invalid', '같은 기간입니다');
  await mustPeriod(db, fromId); await mustPeriod(db, toId);
  const staff = await db.select().from(onsitePeriodStaff).where(eq(onsitePeriodStaff.periodId, fromId));
  const titles = await db.select().from(onsitePeriodTitles).where(eq(onsitePeriodTitles.periodId, fromId));
  await db.delete(onsitePeriodStaff).where(eq(onsitePeriodStaff.periodId, toId));
  await db.delete(onsitePeriodTitles).where(eq(onsitePeriodTitles.periodId, toId));
  if (staff.length) await db.insert(onsitePeriodStaff).values(staff.map((r) => ({ ...r, periodId: toId })));
  if (titles.length) await db.insert(onsitePeriodTitles).values(titles.map((r) => ({ ...r, periodId: toId })));
}

// ── 변동(개인 스케줄) ────────────────────────────────
/**
 * 그날 그 시간대의 변동을 정한다. kind=null이면 변동을 지운다(기본대로).
 * 기본에 있는 사람은 'off'만, 없는 사람은 'on'만 의미가 있다.
 */
export async function setChange(db: Db, actorId: number, input: { date: string; slot: string; userId: number; kind: 'off' | 'on' | null; note?: string | null }, now: Date): Promise<void> {
  const { date, slot, userId, kind } = input;
  if (!isDate(date) || !isSlot(slot)) throw new AppError('invalid', '날짜나 시간대가 올바르지 않습니다');
  await checkUsers(db, [userId]);
  await db.delete(onsiteChanges).where(and(eq(onsiteChanges.date, date), eq(onsiteChanges.slot, slot), eq(onsiteChanges.userId, userId)));
  if (kind === null) return;
  if (kind !== 'off' && kind !== 'on') throw new AppError('invalid', '변동 종류가 올바르지 않습니다');
  const note = input.note?.trim() || null;
  if (note && note.length > 100) throw new AppError('invalid', '메모는 100자 이하로 입력하세요');
  const period = periodFor(await listPeriods(db), date);
  const inBase = period ? (await getBaseWeek(db, period.id))[kstWeekday(date)][slot].some((p) => p.id === userId) : false;
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
    .sort((a, b) => a.date.localeCompare(b.date) || (a.slot === b.slot ? 0 : a.slot === 'pm' ? -1 : 1) || byName(a.user, b.user));
}

/** 기간 안 날짜마다 실제 출근(그날 기간의 기본 − 빠짐 + 추가)과 지점명 */
export async function getOnsiteDays(db: Db, from: string, to: string): Promise<OnsiteDay[]> {
  const [periods, changes] = await Promise.all([listPeriods(db), listChanges(db, from, to)]);
  const cache = new Map<number, { week: BaseWeek; titles: BaseTitles }>();
  const days: OnsiteDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const period = periodFor(periods, d);
    if (period && !cache.has(period.id)) cache.set(period.id, { week: await getBaseWeek(db, period.id), titles: await getBaseTitles(db, period.id) });
    const base = period ? cache.get(period.id)!.week[kstWeekday(d)] : { pm: [], eve: [] };
    const titles = period ? cache.get(period.id)!.titles[kstWeekday(d)] : { pm: null, eve: null };
    days.push({
      date: d, periodId: period?.id ?? null,
      slots: SLOTS.map(({ key }) => {
        const here = changes.filter((c) => c.date === d && c.slot === key);
        const offIds = new Set(here.filter((c) => c.kind === 'off').map((c) => c.user.id));
        const staff = [
          ...base[key].filter((p) => !offIds.has(p.id)).map((p) => ({ ...p, added: false })),
          ...here.filter((c) => c.kind === 'on').map((c) => ({ ...c.user, added: true })),
        ].sort(byName);
        const off = here.filter((c) => c.kind === 'off').map((c) => ({ ...c.user, note: c.note }));
        return { slot: key, title: titles[key], staff, off };
      }),
    });
  }
  return days;
}
