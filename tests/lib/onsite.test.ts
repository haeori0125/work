import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createLecture, deleteLecture, getOnsiteDays, listChanges, listLectures, setChange, updateLecture } from '@/lib/onsite';
import { createTestDb } from '../helpers/db';
import { at, makeUser } from '../helpers/fixtures';

let db: Db;
let admin: number;
let a: number;
let b: number;
const NOW = at('2026-11-24T00:00:00Z');
const codeOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);
const lec = (over: Partial<Parameters<typeof createLecture>[1]> = {}) => createLecture(db, {
  title: '러셀 강남', weekday: 2, slot: 'eve', startDate: '2026-12-01', endDate: '2026-12-31', staffIds: [], ...over,
}, NOW);
beforeEach(async () => {
  db = await createTestDb(); admin = await makeUser(db, '운영자', { role: 'admin' }); a = await makeUser(db, '영희'); b = await makeUser(db, '민수');
});

describe('onsite lectures', () => {
  it('seeds the 1–2월 고3N수 lectures from the migration', async () => {
    const list = await listLectures(db, '2027-01-01', '2027-02-28');
    expect(list.map((l) => [l.weekday, l.slot, l.title])).toEqual([
      [0, 'eve', 'MEXX'], [1, 'eve', '최상위권 러셀 기숙'], [3, 'eve', '러셀 강남'], [4, 'eve', '러셀 대치'],
      [5, 'pm', '러셀 분당'], [5, 'eve', '러셀 영통'], [6, 'pm', 'MEXX'],
    ]);
    // 2027-01-03은 일요일: MEXX 오후 하나
    expect((await getOnsiteDays(db, '2027-01-03', '2027-01-03'))[0].lectures.map((l) => l.title)).toEqual(['MEXX']);
  });

  it('shows lectures only on their weekday inside their range, with staff, off and extras', async () => {
    const id = await lec({ staffIds: [a, b] });
    await lec({ title: '러셀 대치', weekday: 2, slot: 'pm', startDate: '2026-12-10', endDate: '2026-12-20', staffIds: [b] });
    // 12/2, 12/16은 수요일
    const [d2] = await getOnsiteDays(db, '2026-12-02', '2026-12-02');
    expect(d2.lectures.map((l) => l.title)).toEqual(['러셀 강남']);
    const [d16] = await getOnsiteDays(db, '2026-12-16', '2026-12-16');
    expect(d16.lectures.map((l) => [l.slot, l.title])).toEqual([['pm', '러셀 대치'], ['eve', '러셀 강남']]);
    expect((await getOnsiteDays(db, '2026-12-03', '2026-12-03'))[0].lectures).toEqual([]);

    const extra = await makeUser(db, '지수');
    await setChange(db, admin, { lectureId: id, date: '2026-12-02', userId: b, kind: 'off', note: '병원' }, NOW);
    await setChange(db, admin, { lectureId: id, date: '2026-12-02', userId: extra, kind: 'on', note: '대타' }, NOW);
    const [after] = await getOnsiteDays(db, '2026-12-02', '2026-12-02');
    expect(after.lectures[0].staff.map((p) => [p.name, p.added])).toEqual([['영희', false], ['지수', true]]);
    expect(after.lectures[0].off).toEqual([{ id: b, name: '민수', note: '병원' }]);
    expect((await listChanges(db, '2026-12-01', '2026-12-31')).map((c) => [c.title, c.user.name, c.kind])).toEqual([['러셀 강남', '민수', 'off'], ['러셀 강남', '지수', 'on']]);
    await setChange(db, admin, { lectureId: id, date: '2026-12-02', userId: b, kind: null }, NOW);
    expect((await getOnsiteDays(db, '2026-12-02', '2026-12-02'))[0].lectures[0].off).toEqual([]);
  });

  it('validates input and changes', async () => {
    expect(await codeOf(lec({ title: ' ' }))).toBe('invalid');
    expect(await codeOf(lec({ weekday: 7 }))).toBe('invalid');
    expect(await codeOf(lec({ slot: 'night' }))).toBe('invalid');
    expect(await codeOf(lec({ startDate: '2026-12-31', endDate: '2026-12-01' }))).toBe('invalid');
    expect(await codeOf(lec({ staffIds: [9999] }))).toBe('invalid');
    const id = await lec({ staffIds: [a] });
    expect(await codeOf(setChange(db, admin, { lectureId: id, date: '2026-12-03', userId: a, kind: 'off' }, NOW))).toBe('invalid'); // 목요일
    expect(await codeOf(setChange(db, admin, { lectureId: id, date: '2026-12-02', userId: b, kind: 'off' }, NOW))).toBe('invalid');
    expect(await codeOf(setChange(db, admin, { lectureId: id, date: '2026-12-02', userId: a, kind: 'on' }, NOW))).toBe('invalid');
    expect(await codeOf(setChange(db, admin, { lectureId: 9999, date: '2026-12-02', userId: a, kind: 'off' }, NOW))).toBe('not_found');
  });

  it('updates and deletes', async () => {
    const id = await lec({ staffIds: [a] });
    await updateLecture(db, id, { title: '러셀 분당', weekday: 5, slot: 'pm', startDate: '2026-12-01', endDate: '2026-12-15', staffIds: [b] });
    const [l] = (await listLectures(db, '2026-12-01', '2026-12-31')).filter((x) => x.id === id);
    expect(l).toMatchObject({ title: '러셀 분당', weekday: 5, slot: 'pm', endDate: '2026-12-15', staff: [{ name: '민수' }] });
    await deleteLecture(db, id);
    expect((await listLectures(db, '2026-12-01', '2026-12-31')).some((x) => x.id === id)).toBe(false);
  });
});
