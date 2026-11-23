import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { attendance, attendanceEdits, loginEvents, users } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppError } from './errors';
import { kstDate } from './time';

export type AttendanceRow = {
  id: number;
  userId: number;
  userName: string;
  date: string;
  clockIn: Date;
  clockOut: Date | null;
  state: 'working' | 'done' | 'missing';
  durationMs: number | null;
  edited: boolean;
};

export async function recordLogin(db: Db, userId: number, now: Date): Promise<void> {
  await db.insert(loginEvents).values({ userId, at: now });
  await db.insert(attendance)
    .values({ userId, date: kstDate(now), clockIn: now })
    .onConflictDoNothing({ target: [attendance.userId, attendance.date] });
}

async function setTodayClockOut(db: Db, userId: number, now: Date, value: Date | null) {
  const updated = await db.update(attendance)
    .set({ clockOut: value })
    .where(and(eq(attendance.userId, userId), eq(attendance.date, kstDate(now))))
    .returning({ id: attendance.id });
  if (updated.length === 0) throw new AppError('no_attendance', '오늘 출근 기록이 없습니다');
}

export function clockOut(db: Db, userId: number, now: Date): Promise<void> {
  return setTodayClockOut(db, userId, now, now);
}

export function cancelClockOut(db: Db, userId: number, now: Date): Promise<void> {
  return setTodayClockOut(db, userId, now, null);
}

export async function listAttendance(
  db: Db,
  opts: { userId?: number; from: string; to: string; now: Date },
): Promise<AttendanceRow[]> {
  const conds = [gte(attendance.date, opts.from), lte(attendance.date, opts.to)];
  if (opts.userId !== undefined) conds.push(eq(attendance.userId, opts.userId));
  const rows = await db
    .select({
      id: attendance.id, userId: attendance.userId, userName: users.name, date: attendance.date,
      clockIn: attendance.clockIn, clockOut: attendance.clockOut,
    })
    .from(attendance)
    .innerJoin(users, eq(users.id, attendance.userId))
    .where(and(...conds))
    .orderBy(desc(attendance.date), users.name);
  if (rows.length === 0) return [];
  const editedIds = new Set(
    (await db.selectDistinct({ id: attendanceEdits.attendanceId }).from(attendanceEdits)
      .where(inArray(attendanceEdits.attendanceId, rows.map((r) => r.id)))).map((r) => r.id),
  );
  const today = kstDate(opts.now);
  return rows.map((r) => ({
    ...r,
    state: r.clockOut ? 'done' : r.date < today ? 'missing' : 'working',
    durationMs: r.clockOut ? r.clockOut.getTime() - r.clockIn.getTime() : null,
    edited: editedIds.has(r.id),
  }));
}

export async function getTodayAttendance(db: Db, userId: number, now: Date): Promise<AttendanceRow | null> {
  const today = kstDate(now);
  const [row] = await listAttendance(db, { userId, from: today, to: today, now });
  return row ?? null;
}

export async function editAttendance(
  db: Db,
  adminId: number,
  attendanceId: number,
  patch: { clockIn?: Date; clockOut?: Date | null },
  now: Date,
): Promise<void> {
  const [cur] = await db.select().from(attendance).where(eq(attendance.id, attendanceId));
  if (!cur) throw new AppError('not_found', '기록을 찾을 수 없습니다');
  const clockIn = patch.clockIn ?? cur.clockIn;
  const clockOutValue = patch.clockOut === undefined ? cur.clockOut : patch.clockOut;
  if (clockOutValue && clockOutValue.getTime() < clockIn.getTime()) {
    throw new AppError('invalid', '퇴근 시간이 출근 시간보다 빠릅니다');
  }
  await db.insert(attendanceEdits).values({
    attendanceId, editedBy: adminId, at: now, oldClockIn: cur.clockIn, oldClockOut: cur.clockOut,
  });
  await db.update(attendance).set({ clockIn, clockOut: clockOutValue }).where(eq(attendance.id, attendanceId));
}
