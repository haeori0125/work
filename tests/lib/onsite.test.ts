import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import {
  copyBaseWeek, createPeriod, deletePeriod, getBaseTitles, getBaseWeek, getOnsiteDays, listChanges, listPeriods,
  periodFor, setBaseCell, setBaseTitle, setChange, updatePeriod,
} from '@/lib/onsite';
import { createTestDb } from '../helpers/db';
import { at, makeUser } from '../helpers/fixtures';

let db: Db;
let admin: number;
let a: number;
let b: number;
let dec: number;
const NOW = at('2026-11-24T00:00:00Z');
const codeOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);
beforeEach(async () => {
  db = await createTestDb(); admin = await makeUser(db, '운영자', { role: 'admin' }); a = await makeUser(db, '영희'); b = await makeUser(db, '민수');
  dec = await createPeriod(db, { name: '12월', startDate: '2026-12-01', endDate: '2026-12-31' }, NOW);
});

describe('periods', () => {
  it('seeds the winter schedule from the migration', async () => {
    const winter = (await listPeriods(db)).find((p) => p.startDate === '2027-01-01')!;
    expect(winter).toMatchObject({ endDate: '2027-02-28' });
    const t = await getBaseTitles(db, winter.id);
    expect([t[6].pm, t[0].eve, t[1].eve, t[3].eve, t[4].eve, t[5].pm, t[5].eve]).toEqual(['MEXX', 'MEXX', '최상위권 러셀 기숙', '러셀 강남', '러셀 대치', '러셀 분당', '러셀 영통']);
  });

  it('validates, updates and picks the narrower period when they overlap', async () => {
    expect(await codeOf(createPeriod(db, { name: ' ', startDate: '2026-12-01', endDate: '2026-12-02' }, NOW))).toBe('invalid');
    expect(await codeOf(createPeriod(db, { name: 'x', startDate: '2026-12-05', endDate: '2026-12-01' }, NOW))).toBe('invalid');
    const xmas = await createPeriod(db, { name: '성탄 주간', startDate: '2026-12-21', endDate: '2026-12-27' }, NOW);
    const ps = await listPeriods(db);
    expect(periodFor(ps, '2026-12-10')?.id).toBe(dec);
    expect(periodFor(ps, '2026-12-22')?.id).toBe(xmas);
    expect(periodFor(ps, '2026-11-30')).toBeNull();
    await updatePeriod(db, xmas, { name: '성탄', startDate: '2026-12-24', endDate: '2026-12-25' });
    expect(periodFor(await listPeriods(db), '2026-12-22')?.id).toBe(dec);
    await deletePeriod(db, xmas);
    expect((await listPeriods(db)).some((p) => p.id === xmas)).toBe(false);
  });
});

describe('onsite schedule', () => {
  it('applies the period base week, minus people off, plus extras', async () => {
    // 2026-12-02는 수요일(2)
    await setBaseCell(db, dec, 2, 'pm', [a, b]);
    await setBaseTitle(db, dec, 2, 'pm', ' 러셀 강남 ');
    await setBaseCell(db, dec, 2, 'eve', [a]);
    await setChange(db, admin, { date: '2026-12-02', slot: 'pm', userId: b, kind: 'off', note: '병원' }, NOW);
    await setChange(db, admin, { date: '2026-12-02', slot: 'eve', userId: b, kind: 'on', note: '대타' }, NOW);
    const [wed] = await getOnsiteDays(db, '2026-12-02', '2026-12-02');
    expect(wed.slots[0]).toMatchObject({ slot: 'pm', title: '러셀 강남', staff: [{ name: '영희', added: false }], off: [{ name: '민수', note: '병원' }] });
    expect(wed.slots[1].staff.map((p) => [p.name, p.added])).toEqual([['민수', true], ['영희', false]]);
    expect((await getOnsiteDays(db, '2026-12-09', '2026-12-09'))[0].slots[0].staff.map((p) => p.name)).toEqual(['민수', '영희']);
    expect((await getOnsiteDays(db, '2026-11-25', '2026-11-25'))[0]).toMatchObject({ periodId: null, slots: [{ staff: [] }, { staff: [] }] });
    expect((await listChanges(db, '2026-12-01', '2026-12-31')).map((c) => [c.user.name, c.kind])).toEqual([['민수', 'off'], ['민수', 'on']]);
    await setChange(db, admin, { date: '2026-12-02', slot: 'pm', userId: b, kind: null }, NOW);
    expect((await getOnsiteDays(db, '2026-12-02', '2026-12-02'))[0].slots[0].staff).toHaveLength(2);
  });

  it('rejects changes and cells that do not make sense', async () => {
    await setBaseCell(db, dec, 2, 'pm', [a]);
    expect(await codeOf(setChange(db, admin, { date: '2026-12-02', slot: 'pm', userId: b, kind: 'off' }, NOW))).toBe('invalid');
    expect(await codeOf(setChange(db, admin, { date: '2026-12-02', slot: 'pm', userId: a, kind: 'on' }, NOW))).toBe('invalid');
    expect(await codeOf(setChange(db, admin, { date: '2026-12-02', slot: 'night', userId: a, kind: 'off' }, NOW))).toBe('invalid');
    expect(await codeOf(setBaseCell(db, 9999, 2, 'pm', [a]))).toBe('not_found');
    expect(await codeOf(setBaseCell(db, dec, 7, 'pm', [a]))).toBe('invalid');
    expect(await codeOf(setBaseCell(db, dec, 2, 'pm', [9999]))).toBe('invalid');
  });

  it('copies a base week (people and branch names) to another period', async () => {
    const nov = await createPeriod(db, { name: '11월', startDate: '2026-11-01', endDate: '2026-11-30' }, NOW);
    await setBaseCell(db, nov, 0, 'pm', [a]);
    await setBaseTitle(db, nov, 0, 'pm', 'MEXX');
    await setBaseCell(db, dec, 1, 'eve', [b]);
    await copyBaseWeek(db, nov, dec);
    expect((await getBaseWeek(db, dec))[0].pm.map((p) => p.name)).toEqual(['영희']);
    expect((await getBaseWeek(db, dec))[1].eve).toEqual([]);
    expect((await getBaseTitles(db, dec))[0].pm).toBe('MEXX');
  });
});
