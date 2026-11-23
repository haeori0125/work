'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { cancelRequest, createRequest, rejectRequest } from '@/lib/requests';
import { requireActionAdmin, requireActionUser } from '@/server/session';
import { runAction, type ActionResult } from './result';
import { parseTask } from './task-form';

export async function createRequestAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await createRequest(await getDb(), user.id, parseTask(form), new Date());
    revalidatePath('/', 'layout');
    return '요청을 보냈어요. 관리자가 승인하면 업무에 추가돼요.';
  });
}

export async function cancelRequestAction(id: number): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await cancelRequest(await getDb(), user.id, id);
    revalidatePath('/', 'layout');
  });
}

export async function rejectRequestAction(id: number): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireActionAdmin();
    await rejectRequest(await getDb(), id, admin.id, new Date());
    revalidatePath('/', 'layout');
  });
}
