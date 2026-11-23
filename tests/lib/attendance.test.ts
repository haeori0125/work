import { beforeEach, describe, expect, it } from 'vitest';
import { loginEvents, segmentEdits, workSegments } from '@/db/schema';
import type { Db } from '@/db/types';
import { clockOut, editSegment, getToday, listDays, recordLogin } from '@/lib/attendance';
import { createTestDb } from '../helpers/db';
import { at, makeUser } from '../helpers/fixtures';

let db: Db;
let uid: number;
const codeOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);
beforeEach(async () => {
  db = await createTestDb();
  uid = await makeUser(db, '철수');
});

describe('segments', () => {
  it('sums every login→clock-out segment of a day', async () => {
    await recordLogin(db, uid, at('2026-11-23T00:00:00Z')); // 09:00 KST
    await clockOut(db, uid, at('2026-11-23T03:00:00Z')); // 12:00
    await recordLogin(db, uid, at('2026-11-23T04:00:00Z')); // 13:00
    await clockOut(db, uid, at('2026-11-23T09:00:00Z')); // 18:00
    const [day] = await listDays(db, { userId: uid, from: '2026-11-23', to: '2026-11-23', now: at('2026-11-23T10:00:00Z') });
    expect(day.segments).toHaveLength(2);
    expect(day.totalMs).toBe(8 * 3600e3);
    expect(day.state).toBe('done');
    expect(day.firstIn.toISOString()).toBe('2026-11-23T00:00:00.000Z');
    expect(day.userName).toBe('철수');
  });

  it('does not open a second segment while one is open the same day', async () => {
    await recordLogin(db, uid, at('2026-11-23T00:00:00Z'));
    await recordLogin(db, uid, at('2026-11-23T01:00:00Z'));
    expect(await db.select().from(workSegments)).toHaveLength(1);
    expect(await db.select().from(loginEvents)).toHaveLength(2);
    const today = await getToday(db, uid, at('2026-11-23T02:00:00Z'));
    expect(today?.state).toBe('working');
    expect(today?.totalMs).toBe(0);
  });

  it('opens a new segment the next day and marks yesterday missing', async () => {
    await recordLogin(db, uid, at('2026-11-23T00:00:00Z'));
    await recordLogin(db, uid, at('2026-11-24T00:00:00Z'));
    const days = await listDays(db, { userId: uid, from: '2026-11-01', to: '2026-11-30', now: at('2026-11-24T01:00:00Z') });
    expect(days.map((d) => [d.date, d.state])).toEqual([['2026-11-24', 'working'], ['2026-11-23', 'missing']]);
    expect(days[1].totalMs).toBe(0);
  });

  it('splits days at KST midnight', async () => {
    await recordLogin(db, uid, at('2026-11-23T14:59:00Z'));
    await clockOut(db, uid, at('2026-11-23T14:59:30Z'));
    await recordLogin(db, uid, at('2026-11-23T15:00:00Z'));
    const dates = (await db.select().from(workSegments)).map((r) => r.date).sort();
    expect(dates).toEqual(['2026-11-23', '2026-11-24']);
  });

  it('refuses clock-out without an open segment today', async () => {
    expect(await codeOf(clockOut(db, uid, at('2026-11-23T09:00:00Z')))).toBe('no_open_segment');
    await recordLogin(db, uid, at('2026-11-22T00:00:00Z'));
    expect(await codeOf(clockOut(db, uid, at('2026-11-23T09:00:00Z')))).toBe('no_open_segment');
  });

  it('lists all users when no userId is given', async () => {
    const other = await makeUser(db, '영희');
    await recordLogin(db, uid, at('2026-11-23T00:00:00Z'));
    await recordLogin(db, other, at('2026-11-23T00:00:00Z'));
    const all = await listDays(db, { from: '2026-11-23', to: '2026-11-23', now: at('2026-11-23T01:00:00Z') });
    expect(all.map((d) => d.userName)).toEqual(['영희', '철수']);
  });
});

describe('editSegment', () => {
  it('fixes a missing clock-out and keeps history', async () => {
    const admin = await makeUser(db, '운영자', { role: 'admin' });
    await recordLogin(db, uid, at('2026-11-23T00:00:00Z'));
    const [seg] = await db.select().from(workSegments);
    await editSegment(db, admin, seg.id, { clockOut: at('2026-11-23T09:00:00Z') }, at('2026-11-24T01:00:00Z'));
    const [day] = await listDays(db, { userId: uid, from: '2026-11-23', to: '2026-11-23', now: at('2026-11-24T01:00:00Z') });
    expect(day.state).toBe('done');
    expect(day.edited).toBe(true);
    expect(day.segments[0].edited).toBe(true);
    expect(day.totalMs).toBe(9 * 3600e3);
    const edits = await db.select().from(segmentEdits);
    expect(edits[0].oldClockOut).toBeNull();
  });

  it('rejects clock-out before clock-in', async () => {
    const admin = await makeUser(db, '운영자', { role: 'admin' });
    await recordLogin(db, uid, at('2026-11-23T05:00:00Z'));
    const [seg] = await db.select().from(workSegments);
    expect(await codeOf(editSegment(db, admin, seg.id, { clockOut: at('2026-11-23T01:00:00Z') }, at('2026-11-24T01:00:00Z')))).toBe('invalid');
  });
});
