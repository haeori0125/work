import { beforeEach, describe, expect, it } from 'vitest';
import { attendance, attendanceEdits, loginEvents } from '@/db/schema';
import type { Db } from '@/db/types';
import {
  cancelClockOut, clockOut, editAttendance, getTodayAttendance, listAttendance, recordLogin,
} from '@/lib/attendance';
import { createTestDb } from '../helpers/db';
import { at, makeUser } from '../helpers/fixtures';

let db: Db;
let uid: number;
beforeEach(async () => {
  db = await createTestDb();
  uid = await makeUser(db, '철수');
});

describe('recordLogin', () => {
  it('keeps the first login of the day as clock-in and logs every login', async () => {
    await recordLogin(db, uid, at('2026-11-23T00:02:00Z')); // 09:02 KST
    await recordLogin(db, uid, at('2026-11-23T04:00:00Z')); // 13:00 KST
    const rows = await db.select().from(attendance);
    expect(rows).toHaveLength(1);
    expect(rows[0].clockIn.toISOString()).toBe('2026-11-23T00:02:00.000Z');
    expect(await db.select().from(loginEvents)).toHaveLength(2);
  });

  it('splits days at KST midnight', async () => {
    await recordLogin(db, uid, at('2026-11-23T14:59:00Z'));
    await recordLogin(db, uid, at('2026-11-23T15:00:00Z'));
    const dates = (await db.select().from(attendance)).map((r) => r.date).sort();
    expect(dates).toEqual(['2026-11-23', '2026-11-24']);
  });
});

describe('clock out', () => {
  it('marks the day done with duration, and cancel returns to working', async () => {
    await recordLogin(db, uid, at('2026-11-23T00:02:00Z'));
    await clockOut(db, uid, at('2026-11-23T09:10:00Z'));
    let [row] = await listAttendance(db, { userId: uid, from: '2026-11-01', to: '2026-11-30', now: at('2026-11-23T09:11:00Z') });
    expect(row.state).toBe('done');
    expect(row.durationMs).toBe(9 * 3600e3 + 8 * 60e3);
    expect(row.userName).toBe('철수');

    await cancelClockOut(db, uid, at('2026-11-23T09:12:00Z'));
    [row] = await listAttendance(db, { userId: uid, from: '2026-11-01', to: '2026-11-30', now: at('2026-11-23T09:12:00Z') });
    expect(row.state).toBe('working');
    expect(row.durationMs).toBeNull();
  });

  it('pressing clock out again overwrites with the latest time', async () => {
    await recordLogin(db, uid, at('2026-11-23T00:00:00Z'));
    await clockOut(db, uid, at('2026-11-23T08:00:00Z'));
    await clockOut(db, uid, at('2026-11-23T09:00:00Z'));
    const today = await getTodayAttendance(db, uid, at('2026-11-23T09:30:00Z'));
    expect(today?.clockOut?.toISOString()).toBe('2026-11-23T09:00:00.000Z');
  });

  it('shows missing when the day ended without clock out', async () => {
    await recordLogin(db, uid, at('2026-11-23T00:00:00Z'));
    const [row] = await listAttendance(db, { userId: uid, from: '2026-11-01', to: '2026-11-30', now: at('2026-11-23T15:00:00Z') });
    expect(row.state).toBe('missing');
  });
});

describe('listAttendance', () => {
  it('lists newest first and filters by user and range', async () => {
    const other = await makeUser(db, '영희');
    await recordLogin(db, uid, at('2026-11-22T00:00:00Z'));
    await recordLogin(db, uid, at('2026-11-23T00:00:00Z'));
    await recordLogin(db, other, at('2026-11-23T00:00:00Z'));
    const mine = await listAttendance(db, { userId: uid, from: '2026-11-01', to: '2026-11-30', now: at('2026-11-23T01:00:00Z') });
    expect(mine.map((r) => r.date)).toEqual(['2026-11-23', '2026-11-22']);
    const all = await listAttendance(db, { from: '2026-11-23', to: '2026-11-23', now: at('2026-11-23T01:00:00Z') });
    expect(all).toHaveLength(2);
  });
});

describe('editAttendance', () => {
  it('saves previous values and flags the row as edited', async () => {
    const admin = await makeUser(db, '운영자', { role: 'admin' });
    await recordLogin(db, uid, at('2026-11-23T00:00:00Z'));
    const [row] = await listAttendance(db, { userId: uid, from: '2026-11-23', to: '2026-11-23', now: at('2026-11-24T01:00:00Z') });
    expect(row.edited).toBe(false);
    await editAttendance(db, admin, row.id, { clockOut: at('2026-11-23T09:00:00Z') }, at('2026-11-24T01:00:00Z'));
    const [after] = await listAttendance(db, { userId: uid, from: '2026-11-23', to: '2026-11-23', now: at('2026-11-24T01:00:00Z') });
    expect(after.edited).toBe(true);
    expect(after.state).toBe('done');
    const edits = await db.select().from(attendanceEdits);
    expect(edits[0].oldClockIn.toISOString()).toBe('2026-11-23T00:00:00.000Z');
    expect(edits[0].oldClockOut).toBeNull();
  });
});
