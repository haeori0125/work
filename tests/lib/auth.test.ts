import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { attendance, users } from '@/db/schema';
import type { Db } from '@/db/types';
import {
  ensureBootstrapAdmin, getSessionUser, login, logout, normalizeName, signup,
} from '@/lib/auth';
import { createTestDb } from '../helpers/db';
import { at } from '../helpers/fixtures';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

const activate = (name: string) => db.update(users).set({ status: 'active' }).where(eq(users.name, name));
const codeOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);
const NOW = at('2026-11-23T03:00:00Z');

describe('normalizeName', () => {
  it('trims and collapses spaces', () => {
    expect(normalizeName('  김  철수 ')).toBe('김 철수');
  });
});

describe('signup', () => {
  it('stores a trimmed name as pending', async () => {
    await signup(db, { name: ' 철수 ', password: 'pw1234' });
    const [u] = await db.select().from(users);
    expect(u.name).toBe('철수');
    expect(u.status).toBe('pending');
    expect(u.passwordHash).not.toBe('pw1234');
  });
  it('rejects duplicate, empty names and short passwords', async () => {
    await signup(db, { name: '철수', password: 'pw1234' });
    expect(await codeOf(signup(db, { name: ' 철수', password: 'pw1234' }))).toBe('name_taken');
    expect(await codeOf(signup(db, { name: '   ', password: 'pw1234' }))).toBe('name_required');
    expect(await codeOf(signup(db, { name: '영희', password: 'abc' }))).toBe('password_short');
  });
});

describe('login', () => {
  beforeEach(async () => { await signup(db, { name: '철수', password: 'pw1234' }); });

  it('refuses pending accounts', async () => {
    expect(await codeOf(login(db, { name: '철수', password: 'pw1234', asAdmin: false, now: NOW }))).toBe('pending');
  });

  it('logs in active members and records clock-in', async () => {
    await activate('철수');
    const res = await login(db, { name: ' 철수 ', password: 'pw1234', asAdmin: false, now: NOW });
    expect(res.user.name).toBe('철수');
    expect(res.user.role).toBe('member');
    expect(res.expiresAt.toISOString()).toBe('2026-11-23T15:00:00.000Z');
    expect(await db.select().from(attendance)).toHaveLength(1);
  });

  it('rejects wrong password and unknown names with the same code', async () => {
    await activate('철수');
    expect(await codeOf(login(db, { name: '철수', password: 'nope', asAdmin: false, now: NOW }))).toBe('invalid');
    expect(await codeOf(login(db, { name: '없음', password: 'pw1234', asAdmin: false, now: NOW }))).toBe('invalid');
  });

  it('rejects members on the admin tab', async () => {
    await activate('철수');
    expect(await codeOf(login(db, { name: '철수', password: 'pw1234', asAdmin: true, now: NOW }))).toBe('not_admin');
  });

  it('refuses disabled accounts', async () => {
    await db.update(users).set({ status: 'disabled' }).where(eq(users.name, '철수'));
    expect(await codeOf(login(db, { name: '철수', password: 'pw1234', asAdmin: false, now: NOW }))).toBe('disabled');
  });

  it('locks after 5 failures within 15 minutes', async () => {
    await activate('철수');
    for (let i = 0; i < 5; i++) {
      await codeOf(login(db, { name: '철수', password: 'bad', asAdmin: false, now: NOW }));
    }
    expect(await codeOf(login(db, { name: '철수', password: 'pw1234', asAdmin: false, now: NOW }))).toBe('locked');
    const later = new Date(NOW.getTime() + 16 * 60e3);
    expect(await codeOf(login(db, { name: '철수', password: 'pw1234', asAdmin: false, now: later }))).toBe('ok');
  });
});

describe('sessions', () => {
  it('expire at KST midnight and end on logout', async () => {
    await signup(db, { name: '철수', password: 'pw1234' });
    await activate('철수');
    const { token } = await login(db, { name: '철수', password: 'pw1234', asAdmin: false, now: NOW });
    expect((await getSessionUser(db, token, at('2026-11-23T14:00:00Z')))?.name).toBe('철수');
    expect(await getSessionUser(db, token, at('2026-11-23T15:00:00Z'))).toBeNull();
    await logout(db, token);
    expect(await getSessionUser(db, token, at('2026-11-23T04:00:00Z'))).toBeNull();
  });

  it('end when the account is disabled', async () => {
    await signup(db, { name: '철수', password: 'pw1234' });
    await activate('철수');
    const { token } = await login(db, { name: '철수', password: 'pw1234', asAdmin: false, now: NOW });
    await db.update(users).set({ status: 'disabled' }).where(eq(users.name, '철수'));
    expect(await getSessionUser(db, token, NOW)).toBeNull();
  });
});

describe('ensureBootstrapAdmin', () => {
  it('creates one active admin only when none exists', async () => {
    await ensureBootstrapAdmin(db, '운영자', 'pw1234');
    await ensureBootstrapAdmin(db, '운영자', 'pw1234');
    const admins = await db.select().from(users).where(eq(users.role, 'admin'));
    expect(admins).toHaveLength(1);
    expect(admins[0].status).toBe('active');
    const res = await login(db, { name: '운영자', password: 'pw1234', asAdmin: true, now: NOW });
    expect(res.user.role).toBe('admin');
  });
  it('takes over a name someone registered first, with the env password', async () => {
    await signup(db, { name: '운영자', password: 'attacker' });
    await ensureBootstrapAdmin(db, '운영자', 'pw1234');
    expect(await codeOf(login(db, { name: '운영자', password: 'attacker', asAdmin: true, now: NOW }))).toBe('invalid');
    expect(await codeOf(login(db, { name: '운영자', password: 'pw1234', asAdmin: true, now: NOW }))).toBe('ok');
  });
  it('does nothing without credentials', async () => {
    await ensureBootstrapAdmin(db, undefined, undefined);
    expect(await db.select().from(users)).toHaveLength(0);
  });
});
