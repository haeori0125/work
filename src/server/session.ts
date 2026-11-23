import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { getSessionUser, type SessionUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';

export const SESSION_COOKIE = 'todo_session';

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionUser(await getDb(), token, new Date());
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/');
  return user;
}

/** 서버 액션용: 로그인하지 않았으면 화면에 보여줄 오류를 던진다. */
export async function requireActionUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError('unauthorized', '로그인이 필요합니다. 다시 로그인해 주세요.');
  return user;
}

export async function requireActionAdmin(): Promise<SessionUser> {
  const user = await requireActionUser();
  if (user.role !== 'admin') throw new AppError('forbidden', '관리자만 할 수 있습니다');
  return user;
}
