'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import {
  copyBaseWeek, createPeriod, deletePeriod, setBaseCell, setBaseTitle, setChange, updatePeriod, type PeriodInput,
} from '@/lib/onsite';
import { requireActionAdmin } from '@/server/session';
import { runAction, type ActionResult } from './result';

const done = () => revalidatePath('/', 'layout');

export async function createPeriodAction(input: PeriodInput): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionAdmin();
    const id = await createPeriod(await getDb(), input, new Date());
    done();
    return String(id);
  });
}

export async function updatePeriodAction(id: number, input: PeriodInput): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionAdmin();
    await updatePeriod(await getDb(), id, input);
    done();
  });
}

export async function deletePeriodAction(id: number): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionAdmin();
    await deletePeriod(await getDb(), id);
    done();
  });
}

export async function setBaseCellAction(periodId: number, weekday: number, slot: string, userIds: number[]): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionAdmin();
    await setBaseCell(await getDb(), periodId, weekday, slot, userIds);
    done();
  });
}

export async function setBaseTitleAction(periodId: number, weekday: number, slot: string, title: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionAdmin();
    await setBaseTitle(await getDb(), periodId, weekday, slot, title);
    done();
  });
}

export async function copyBaseAction(fromId: number, toId: number): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionAdmin();
    await copyBaseWeek(await getDb(), fromId, toId);
    done();
  });
}

export async function setChangeAction(input: { date: string; slot: string; userId: number; kind: 'off' | 'on' | null; note?: string | null }): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireActionAdmin();
    await setChange(await getDb(), admin.id, input, new Date());
    done();
  });
}
