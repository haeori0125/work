'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { createLecture, deleteLecture, setChange, updateLecture, type LectureInput } from '@/lib/onsite';
import { AppError } from '@/lib/errors';
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

/** 변동 한 번에: 빠지는 사람 · 대신 나오는 사람(둘 중 하나만 있어도 됨) · 사유 */
export async function saveChangeAction(input: { lectureId: number; date: string; offUserId: number | null; onUserIds: number[]; note: string }): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireActionAdmin();
    if (!input.offUserId && !input.onUserIds.length) throw new AppError('invalid', '빠지는 사람이나 대신 나오는 사람을 골라 주세요');
    const db = await getDb();
    const now = new Date();
    if (input.offUserId) await setChange(db, admin.id, { lectureId: input.lectureId, date: input.date, userId: input.offUserId, kind: 'off', note: input.note }, now);
    for (const id of new Set(input.onUserIds)) await setChange(db, admin.id, { lectureId: input.lectureId, date: input.date, userId: id, kind: 'on', note: input.note }, now);
    done();
  });
}
