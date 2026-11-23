import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, count, eq, gt, gte } from 'drizzle-orm';
import { loginFailures, sessions, users } from '@/db/schema';
import type { Db } from '@/db/types';
import { recordLogin } from './attendance';
import { AppError } from './errors';
import { nextKstMidnight } from './time';

export type SessionUser = { id: number; name: string; role: 'member' | 'admin' };

const MIN_PASSWORD = 4;
const MAX_FAILURES = 5;
const LOCK_WINDOW_MS = 15 * 60e3;
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function checkPassword(password: string): void {
  if (password.length < MIN_PASSWORD) throw new AppError('password_short', `비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다`);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function signup(db: Db, input: { name: string; password: string }): Promise<void> {
  const name = normalizeName(input.name);
  if (!name) throw new AppError('name_required', '이름을 입력하세요');
  if (name.length > 30) throw new AppError('name_long', '이름은 30자 이하로 입력하세요');
  checkPassword(input.password);
  const inserted = await db.insert(users)
    .values({ name, passwordHash: await hashPassword(input.password) })
    .onConflictDoNothing({ target: users.name })
    .returning({ id: users.id });
  if (inserted.length === 0) throw new AppError('name_taken', '이미 사용 중인 이름입니다');
}

export async function ensureBootstrapAdmin(db: Db, name?: string, password?: string): Promise<void> {
  if (!name || !password) return;
  const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.role, 'admin'));
  if (n > 0) return;
  const clean = normalizeName(name);
  const passwordHash = await hashPassword(password);
  // 같은 이름이 이미 가입돼 있어도 환경변수 비밀번호로 덮어써서 관리자로 만든다.
  await db.insert(users)
    .values({ name: clean, passwordHash, role: 'admin', status: 'active' })
    .onConflictDoUpdate({ target: users.name, set: { passwordHash, role: 'admin', status: 'active' } });
}

export async function login(
  db: Db,
  input: { name: string; password: string; asAdmin: boolean; now: Date },
): Promise<{ token: string; expiresAt: Date; user: SessionUser }> {
  await ensureBootstrapAdmin(db, process.env.ADMIN_NAME, process.env.ADMIN_PASSWORD);
  const name = normalizeName(input.name);
  const since = new Date(input.now.getTime() - LOCK_WINDOW_MS);
  const [{ n }] = await db.select({ n: count() }).from(loginFailures)
    .where(and(eq(loginFailures.name, name), gte(loginFailures.at, since)));
  if (n >= MAX_FAILURES) throw new AppError('locked', '로그인 시도가 너무 많습니다. 15분 후 다시 시도하세요');

  const [user] = await db.select().from(users).where(eq(users.name, name));
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    await db.insert(loginFailures).values({ name, at: input.now });
    throw new AppError('invalid', '이름 또는 비밀번호가 맞지 않습니다');
  }
  if (user.status === 'pending') throw new AppError('pending', '관리자 승인 대기 중입니다');
  if (user.status === 'disabled') throw new AppError('disabled', '사용이 중지된 계정입니다');
  if (input.asAdmin && user.role !== 'admin') throw new AppError('not_admin', '관리자 계정이 아닙니다');

  const token = randomBytes(32).toString('hex');
  const expiresAt = nextKstMidnight(input.now);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId: user.id, expiresAt });
  await recordLogin(db, user.id, input.now);
  return { token, expiresAt, user: { id: user.id, name: user.name, role: user.role } };
}

export async function getSessionUser(db: Db, token: string, now: Date): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now), eq(users.status, 'active')));
  return row ?? null;
}

export async function logout(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function deleteUserSessions(db: Db, userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
