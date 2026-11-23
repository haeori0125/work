'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { addBoardPost, deleteBoardPost, editBoardPost } from '@/lib/memos';
import { kstDate } from '@/lib/time';
import { requireActionUser } from '@/server/session';
import { runAction, type ActionResult } from './result';

export async function addBoardPostAction(body: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const now = new Date();
    await addBoardPost(await getDb(), user, kstDate(now), body, now);
    revalidatePath('/');
  });
}

export async function editBoardPostAction(id: number, body: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await editBoardPost(await getDb(), user, id, body, new Date());
    revalidatePath('/');
  });
}

export async function deleteBoardPostAction(id: number): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await deleteBoardPost(await getDb(), user, id);
    revalidatePath('/');
  });
}
