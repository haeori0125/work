'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { cancelClockOut, clockOut } from '@/lib/attendance';
import { requireActionUser } from '@/server/session';
import { runAction, type ActionResult } from './result';

export async function clockOutAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await clockOut(await getDb(), user.id, new Date());
    revalidatePath('/', 'layout');
  });
}

export async function cancelClockOutAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await cancelClockOut(await getDb(), user.id, new Date());
    revalidatePath('/', 'layout');
  });
}
