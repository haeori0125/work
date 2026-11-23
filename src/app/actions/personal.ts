'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { savePersonalMemo } from '@/lib/memos';
import { formatKstTime } from '@/lib/time';
import { requireActionUser } from '@/server/session';
import { runAction, type ActionResult } from './result';

export async function savePersonalMemoAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const now = new Date();
    await savePersonalMemo(await getDb(), user.id, String(form.get('body') ?? ''), now);
    revalidatePath('/memo');
    return `저장했습니다 (${formatKstTime(now)})`;
  });
}
