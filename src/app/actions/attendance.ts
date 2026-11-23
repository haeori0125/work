'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { endShift } from '@/lib/auth';
import { requireActionUser, SESSION_COOKIE } from '@/server/session';
import { runAction, type ActionResult } from './result';

/** 퇴근하기: 열린 근무 구간을 닫고 로그아웃한다. */
export async function endShiftAction(): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    await endShift(await getDb(), user.id, new Date());
  });
  if (result?.error) return result;
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login?out=1');
}
