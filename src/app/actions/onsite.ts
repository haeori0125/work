'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { copyBaseWeek, setBaseCell, setChange } from '@/lib/onsite';
import { requireActionAdmin } from '@/server/session';
import { runAction, type ActionResult } from './result';

export async function setBaseCellAction(term: string, weekday: number, slot: string, userIds: number[]): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionAdmin();
    await setBaseCell(await getDb(), term, weekday, slot, userIds);
    revalidatePath('/onsite');
  });
}

export async function copyBaseAction(fromTerm: string, toTerm: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionAdmin();
    await copyBaseWeek(await getDb(), fromTerm, toTerm);
    revalidatePath('/onsite');
  });
}

export async function setChangeAction(input: { date: string; slot: string; userId: number; kind: 'off' | 'on' | null; note?: string | null }): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireActionAdmin();
    await setChange(await getDb(), admin.id, input, new Date());
    revalidatePath('/onsite');
  });
}
