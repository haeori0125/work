'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { createLecture, deleteLecture, setChange, updateLecture, type LectureInput } from '@/lib/onsite';
import { requireActionAdmin } from '@/server/session';
import { runAction, type ActionResult } from './result';

const done = () => revalidatePath('/', 'layout');

export async function saveLectureAction(id: number | null, input: LectureInput): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionAdmin();
    const db = await getDb();
    if (id) await updateLecture(db, id, input);
    else await createLecture(db, input, new Date());
    done();
  });
}

export async function deleteLectureAction(id: number): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionAdmin();
    await deleteLecture(await getDb(), id);
    done();
  });
}

export async function setChangeAction(input: { lectureId: number; date: string; userId: number; kind: 'off' | 'on' | null; note?: string | null }): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireActionAdmin();
    await setChange(await getDb(), admin.id, input, new Date());
    done();
  });
}
