'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { login, logout, signup } from '@/lib/auth';
import { SESSION_COOKIE } from '@/server/session';
import { runAction, type ActionResult } from './result';

const str = (f: FormData, k: string) => String(f.get(k) ?? '');

export async function loginAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const asAdmin = str(form, 'mode') === 'admin';
  const result = await runAction(async () => {
    const res = await login(await getDb(), {
      name: str(form, 'name'), password: str(form, 'password'), asAdmin, now: new Date(),
    });
    (await cookies()).set(SESSION_COOKIE, res.token, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', expires: res.expiresAt,
    });
  });
  if (result?.error) return result;
  redirect(asAdmin ? '/admin/tasks' : '/');
}

export async function signupAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (str(form, 'password') !== str(form, 'password2')) return { error: '비밀번호가 서로 다릅니다' };
  return runAction(async () => {
    await signup(await getDb(), { name: str(form, 'name'), password: str(form, 'password') });
    return '가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.';
  });
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await logout(await getDb(), token);
  store.delete(SESSION_COOKIE);
  redirect('/login');
}
