import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { DEFAULT_PREFS, getPrefs, savePrefs } from '@/lib/prefs';
import { createTestDb } from '../helpers/db';
import { at, makeUser } from '../helpers/fixtures';

let db: Db;
let uid: number;
const NOW = at('2026-11-23T05:00:00Z');
const errOf = async (p: Promise<unknown>) => p.then(() => null, (e: { code?: string; message: string }) => [e.code, e.message]);
beforeEach(async () => { db = await createTestDb(); uid = await makeUser(db, '철수'); });

describe('prefs', () => {
  it('returns defaults when nothing is saved', async () => {
    expect(await getPrefs(db, uid)).toEqual(DEFAULT_PREFS);
  });
  it('saves partial changes and normalizes hex codes', async () => {
    await savePrefs(db, uid, { weekStart: 'sun' }, NOW);
    const p = await savePrefs(db, uid, { themeH: 348, themeS: 74, themeL: 84, themeHex: '#f4b6c2', doingHex: 'f3d98b' }, NOW);
    expect(p).toEqual({ ...DEFAULT_PREFS, weekStart: 'sun', themeH: 348, themeS: 74, themeL: 84, themeHex: 'F4B6C2', doingHex: 'F3D98B' });
    expect(await getPrefs(db, uid)).toEqual(p);
    await savePrefs(db, uid, { doingHex: null }, NOW);
    expect((await getPrefs(db, uid)).doingHex).toBeNull();
  });
  it('rejects out-of-range values and bad codes', async () => {
    expect((await errOf(savePrefs(db, uid, { themeL: 95 }, NOW)))?.[0]).toBe('invalid');
    expect((await errOf(savePrefs(db, uid, { themeH: 360 }, NOW)))?.[0]).toBe('invalid');
    expect(await errOf(savePrefs(db, uid, { doingHex: 'zz' }, NOW))).toEqual(['invalid', '색상 코드는 # 뒤에 6자리로 입력하세요']);
    expect((await errOf(savePrefs(db, uid, { weekStart: 'tue' as 'mon' }, NOW)))?.[0]).toBe('invalid');
  });

  it('stores a small profile photo and rejects anything that is not a png/jpeg/webp data URL', async () => {
    const ok = 'data:image/webp;base64,' + 'A'.repeat(2000);
    expect((await savePrefs(db, uid, { avatar: ok }, NOW)).avatar).toBe(ok);
    expect((await getPrefs(db, uid)).avatar).toBe(ok);
    expect((await savePrefs(db, uid, { avatar: null }, NOW)).avatar).toBeNull();
    expect((await errOf(savePrefs(db, uid, { avatar: 'data:image/svg+xml;base64,AAAA' }, NOW)))?.[0]).toBe('invalid');
    expect((await errOf(savePrefs(db, uid, { avatar: 'https://example.com/a.png' }, NOW)))?.[0]).toBe('invalid');
    expect((await errOf(savePrefs(db, uid, { avatar: 'data:image/png;base64,' + 'A'.repeat(200000) }, NOW)))?.[0]).toBe('invalid');
  });
});
