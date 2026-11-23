import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { getSessionUser, login, signup } from '@/lib/auth';
import {
  approveMember, listActiveMembers, listMembers, rejectMember, resetPassword, setDisabled, setRole,
} from '@/lib/members';
import { createTestDb } from '../helpers/db';
import { at, makeUser } from '../helpers/fixtures';

let db: Db;
let admin: number;
const NOW = at('2026-11-23T03:00:00Z');
const codeOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);
const idOf = async (name: string) => (await listMembers(db)).find((m) => m.name === name)!.id;

beforeEach(async () => {
  db = await createTestDb();
  admin = await makeUser(db, '운영자', { role: 'admin' });
});

describe('approval', () => {
  it('approved applicants can log in', async () => {
    await signup(db, { name: '철수', password: 'pw1234' });
    await approveMember(db, await idOf('철수'));
    expect(await codeOf(login(db, { name: '철수', password: 'pw1234', asAdmin: false, now: NOW }))).toBe('ok');
  });
  it('rejected applicants are removed so the name can be reused', async () => {
    await signup(db, { name: '철수', password: 'pw1234' });
    await rejectMember(db, await idOf('철수'));
    expect(await codeOf(signup(db, { name: '철수', password: 'pw5678' }))).toBe('ok');
  });
  it('reject only applies to pending accounts', async () => {
    const active = await makeUser(db, '영희');
    expect(await codeOf(rejectMember(db, active))).toBe('not_pending');
  });
});

describe('listMembers', () => {
  it('puts pending first, then by name', async () => {
    await makeUser(db, '가람');
    await signup(db, { name: '하늘', password: 'pw1234' });
    expect((await listMembers(db)).map((m) => m.name)).toEqual(['하늘', '가람', '운영자']);
    expect((await listActiveMembers(db)).map((m) => m.name)).toEqual(['가람', '운영자']);
  });
});

describe('roles', () => {
  it('cannot demote the last admin', async () => {
    expect(await codeOf(setRole(db, admin, admin, 'member'))).toBe('last_admin');
  });
  it('can promote and demote when another admin exists', async () => {
    const u = await makeUser(db, '철수');
    await setRole(db, admin, u, 'admin');
    await setRole(db, u, admin, 'member');
    const roles = Object.fromEntries((await listMembers(db)).map((m) => [m.name, m.role]));
    expect(roles).toEqual({ 철수: 'admin', 운영자: 'member' });
  });
});

describe('resetPassword', () => {
  it('changes the password and ends existing sessions', async () => {
    await signup(db, { name: '철수', password: 'pw1234' });
    const id = await idOf('철수');
    await approveMember(db, id);
    const { token } = await login(db, { name: '철수', password: 'pw1234', asAdmin: false, now: NOW });
    await resetPassword(db, id, 'newpw');
    expect(await getSessionUser(db, token, NOW)).toBeNull();
    expect(await codeOf(login(db, { name: '철수', password: 'newpw', asAdmin: false, now: NOW }))).toBe('ok');
    expect(await codeOf(resetPassword(db, id, 'ab'))).toBe('password_short');
  });
});

describe('setDisabled', () => {
  it('blocks login and can be undone; self-disable is refused', async () => {
    await signup(db, { name: '철수', password: 'pw1234' });
    const id = await idOf('철수');
    await approveMember(db, id);
    await setDisabled(db, admin, id, true);
    expect(await codeOf(login(db, { name: '철수', password: 'pw1234', asAdmin: false, now: NOW }))).toBe('disabled');
    await setDisabled(db, admin, id, false);
    expect(await codeOf(login(db, { name: '철수', password: 'pw1234', asAdmin: false, now: NOW }))).toBe('ok');
    expect(await codeOf(setDisabled(db, admin, admin, true))).toBe('self');
  });
});
