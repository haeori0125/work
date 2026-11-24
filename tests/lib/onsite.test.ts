import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { copyBaseWeek, getBaseWeek, getOnsiteDays, listChanges, setBaseCell, setChange, shiftTerm, termOf } from '@/lib/onsite';
import { createTestDb } from '../helpers/db';
import { at, makeUser } from '../helpers/fixtures';

let db: Db;
let admin: number;
let a: number;
let b: number;
const NOW = at('2026-11-24T00:00:00Z');
const codeOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);
beforeEach(async () => {
  db = await createTestDb(); admin = await makeUser(db, '운영자', { role: 'admin' }); a = await makeUser(db, '영희'); b = await makeUser(db, '민수');
});

describe('terms', () => {
  it('maps months to the 5 periods and steps between them', () => {
    expect(['2026-01-15', '2026-02-28', '2026-03-01', '2026-06-30', '2026-07-01', '2026-08-31', '2026-09-01', '2026-11-30', '2026-12-01'].map(termOf))
      .toEqual(['2026-1', '2026-1', '2026-2', '2026-2', '2026-3', '2026-3', '2026-4', '2026-4', '2026-5']);
    expect(shiftTerm('2026-5', 1)).toBe('2027-1');
    expect(shiftTerm('2026-1', -1)).toBe('2025-5');
  });
});

describe('onsite schedule', () => {
  it('applies the base week, minus people off, plus extras', async () => {
    // 2026-12-02는 수요일(2)
    await setBaseCell(db, '2026-5', 2, 'pm', [a, b]);
    await setBaseCell(db, '2026-5', 2, 'eve', [a]);
    await setChange(db, admin, { date: '2026-12-02', slot: 'pm', userId: b, kind: 'off', note: '병원' }, NOW);
    await setChange(db, admin, { date: '2026-12-02', slot: 'eve', userId: b, kind: 'on', note: '대타' }, NOW);
    const [wed] = await getOnsiteDays(db, '2026-12-02', '2026-12-02');
    expect(wed.slots[0]).toMatchObject({ slot: 'pm', staff: [{ name: '영희', added: false }], off: [{ name: '민수', note: '병원' }] });
    expect(wed.slots[1].staff.map((p) => [p.name, p.added])).toEqual([['민수', true], ['영희', false]]);
    const [thu] = await getOnsiteDays(db, '2026-12-09', '2026-12-09');
    expect(thu.slots[0].staff.map((p) => p.name)).toEqual(['민수', '영희']); // 다음 주는 기본대로
    expect((await listChanges(db, '2026-12-01', '2026-12-31')).map((c) => [c.user.name, c.kind])).toEqual([['민수', 'off'], ['민수', 'on']]);
    await setChange(db, admin, { date: '2026-12-02', slot: 'pm', userId: b, kind: null }, NOW);
    expect((await getOnsiteDays(db, '2026-12-02', '2026-12-02'))[0].slots[0].staff).toHaveLength(2);
  });

  it('rejects changes that do not make sense', async () => {
    await setBaseCell(db, '2026-5', 2, 'pm', [a]);
    expect(await codeOf(setChange(db, admin, { date: '2026-12-02', slot: 'pm', userId: b, kind: 'off' }, NOW))).toBe('invalid');
    expect(await codeOf(setChange(db, admin, { date: '2026-12-02', slot: 'pm', userId: a, kind: 'on' }, NOW))).toBe('invalid');
    expect(await codeOf(setChange(db, admin, { date: '2026-12-02', slot: 'night', userId: a, kind: 'off' }, NOW))).toBe('invalid');
    expect(await codeOf(setBaseCell(db, '2026-9', 2, 'pm', [a]))).toBe('invalid');
    expect(await codeOf(setBaseCell(db, '2026-5', 2, 'pm', [9999]))).toBe('invalid');
  });

  it('copies a base week to another period', async () => {
    await setBaseCell(db, '2026-4', 0, 'pm', [a]);
    await setBaseCell(db, '2026-5', 1, 'eve', [b]);
    await copyBaseWeek(db, '2026-4', '2026-5');
    const week = await getBaseWeek(db, '2026-5');
    expect(week[0].pm.map((p) => p.name)).toEqual(['영희']);
    expect(week[1].eve).toEqual([]);
  });
});
