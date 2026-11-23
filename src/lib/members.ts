import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { users } from '@/db/schema';
import type { Db } from '@/db/types';
import { checkPassword, deleteUserSessions, hashPassword } from './auth';
import { AppError } from './errors';

export type Member = {
  id: number;
  name: string;
  role: 'member' | 'admin';
  status: 'pending' | 'active' | 'disabled';
  createdAt: Date;
};

export function listMembers(db: Db): Promise<Member[]> {
  return db
    .select({ id: users.id, name: users.name, role: users.role, status: users.status, createdAt: users.createdAt })
    .from(users)
    .orderBy(sql`case when ${users.status} = 'pending' then 0 else 1 end`, asc(users.name));
}

export function listActiveMembers(db: Db): Promise<{ id: number; name: string }[]> {
  return db.select({ id: users.id, name: users.name }).from(users)
    .where(eq(users.status, 'active')).orderBy(asc(users.name));
}

async function getMember(db: Db, id: number) {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) throw new AppError('not_found', '멤버를 찾을 수 없습니다');
  return u;
}

export async function approveMember(db: Db, id: number): Promise<void> {
  const u = await getMember(db, id);
  if (u.status !== 'pending') throw new AppError('not_pending', '승인 대기 중인 신청이 아닙니다');
  await db.update(users).set({ status: 'active' }).where(eq(users.id, id));
}

export async function rejectMember(db: Db, id: number): Promise<void> {
  const u = await getMember(db, id);
  if (u.status !== 'pending') throw new AppError('not_pending', '승인 대기 중인 신청이 아닙니다');
  await db.delete(users).where(eq(users.id, id));
}

export async function setRole(db: Db, _actorId: number, id: number, role: 'member' | 'admin'): Promise<void> {
  const u = await getMember(db, id);
  if (u.role === 'admin' && role === 'member') {
    const [{ n }] = await db.select({ n: count() }).from(users)
      .where(and(eq(users.role, 'admin'), eq(users.status, 'active'), ne(users.id, id)));
    if (n === 0) throw new AppError('last_admin', '마지막 관리자는 해제할 수 없습니다');
  }
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function resetPassword(db: Db, id: number, newPassword: string): Promise<void> {
  checkPassword(newPassword);
  await getMember(db, id);
  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, id));
  await deleteUserSessions(db, id);
}

export async function setDisabled(db: Db, actorId: number, id: number, disabled: boolean): Promise<void> {
  if (actorId === id) throw new AppError('self', '본인 계정은 중지할 수 없습니다');
  const u = await getMember(db, id);
  if (u.status === 'pending') throw new AppError('not_active', '승인 대기 중인 신청은 승인 또는 거절하세요');
  await db.update(users).set({ status: disabled ? 'disabled' : 'active' }).where(eq(users.id, id));
  if (disabled) await deleteUserSessions(db, id);
}
