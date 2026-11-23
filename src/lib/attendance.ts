import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { loginEvents, segmentEdits, users, workSegments } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppError } from './errors';
import { kstDate } from './time';

export type Segment = { id: number; clockIn: Date; clockOut: Date | null; edited: boolean };

export type DayRecord = {
  userId: number;
  userName: string;
  date: string;
  segments: Segment[];
  /** working: 오늘 열린 구간 있음 · missing: 지난 날인데 열린 구간 있음 · done: 그 외 */
  state: 'working' | 'done' | 'missing';
  /** 닫힌 구간들의 합 (열린 구간은 제외) */
  totalMs: number;
  firstIn: Date;
  edited: boolean;
};

/** 로그인 기록. 오늘 열린 구간이 없으면 새 구간(출근)을 시작한다. */
export async function recordLogin(db: Db, userId: number, now: Date): Promise<void> {
  await db.insert(loginEvents).values({ userId, at: now });
  const date = kstDate(now);
  const open = await db.select({ id: workSegments.id }).from(workSegments)
    .where(and(eq(workSegments.userId, userId), eq(workSegments.date, date), isNull(workSegments.clockOut)));
  if (open.length === 0) await db.insert(workSegments).values({ userId, date, clockIn: now });
}

/** 오늘 열린 구간을 닫는다. */
export async function clockOut(db: Db, userId: number, now: Date): Promise<void> {
  const closed = await db.update(workSegments).set({ clockOut: now })
    .where(and(eq(workSegments.userId, userId), eq(workSegments.date, kstDate(now)), isNull(workSegments.clockOut)))
    .returning({ id: workSegments.id });
  if (closed.length === 0) throw new AppError('no_open_segment', '진행 중인 근무가 없습니다');
}

export async function listDays(
  db: Db,
  opts: { userId?: number; from: string; to: string; now: Date },
): Promise<DayRecord[]> {
  const conds = [gte(workSegments.date, opts.from), lte(workSegments.date, opts.to)];
  if (opts.userId !== undefined) conds.push(eq(workSegments.userId, opts.userId));
  const rows = await db.select({
    id: workSegments.id, userId: workSegments.userId, userName: users.name, date: workSegments.date,
    clockIn: workSegments.clockIn, clockOut: workSegments.clockOut,
  }).from(workSegments).innerJoin(users, eq(users.id, workSegments.userId))
    .where(and(...conds)).orderBy(asc(workSegments.clockIn));
  if (!rows.length) return [];
  const edited = new Set((await db.selectDistinct({ id: segmentEdits.segmentId }).from(segmentEdits)
    .where(inArray(segmentEdits.segmentId, rows.map((r) => r.id)))).map((r) => r.id));
  const today = kstDate(opts.now);
  const days = new Map<string, DayRecord>();
  for (const r of rows) {
    const key = `${r.date}|${r.userId}`;
    let day = days.get(key);
    if (!day) {
      day = { userId: r.userId, userName: r.userName, date: r.date, segments: [], state: 'done', totalMs: 0, firstIn: r.clockIn, edited: false };
      days.set(key, day);
    }
    const seg = { id: r.id, clockIn: r.clockIn, clockOut: r.clockOut, edited: edited.has(r.id) };
    day.segments.push(seg);
    day.edited ||= seg.edited;
    if (seg.clockOut) day.totalMs += seg.clockOut.getTime() - seg.clockIn.getTime();
    else day.state = r.date < today ? 'missing' : 'working';
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName, 'ko'));
}

export async function getToday(db: Db, userId: number, now: Date): Promise<DayRecord | null> {
  const today = kstDate(now);
  const [day] = await listDays(db, { userId, from: today, to: today, now });
  return day ?? null;
}

export async function editSegment(
  db: Db,
  adminId: number,
  segmentId: number,
  patch: { clockIn?: Date; clockOut?: Date | null },
  now: Date,
): Promise<void> {
  const [cur] = await db.select().from(workSegments).where(eq(workSegments.id, segmentId));
  if (!cur) throw new AppError('not_found', '기록을 찾을 수 없습니다');
  const clockIn = patch.clockIn ?? cur.clockIn;
  const out = patch.clockOut === undefined ? cur.clockOut : patch.clockOut;
  if (out && out.getTime() < clockIn.getTime()) throw new AppError('invalid', '퇴근 시간이 출근 시간보다 빠릅니다');
  await db.insert(segmentEdits).values({ segmentId, editedBy: adminId, at: now, oldClockIn: cur.clockIn, oldClockOut: cur.clockOut });
  await db.update(workSegments).set({ clockIn, clockOut: out }).where(eq(workSegments.id, segmentId));
}

/** 구간의 날짜 (관리자 수정 시 시각을 이 날짜 기준으로 해석) */
export async function getSegmentDate(db: Db, segmentId: number): Promise<string> {
  const [row] = await db.select({ date: workSegments.date }).from(workSegments).where(eq(workSegments.id, segmentId));
  if (!row) throw new AppError('not_found', '기록을 찾을 수 없습니다');
  return row.date;
}
