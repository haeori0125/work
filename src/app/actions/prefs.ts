'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { savePrefs, type Prefs } from '@/lib/prefs';
import { requireActionUser } from '@/server/session';
import { runAction, type ActionResult } from './result';

export async function savePrefsAction(patch: Partial<Prefs>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await savePrefs(await getDb(), user.id, patch, new Date());
    revalidatePath('/', 'layout');
  });
}
