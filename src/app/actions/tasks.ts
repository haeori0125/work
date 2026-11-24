'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { AppError } from '@/lib/errors';
import { addTaskComment, deleteTaskComment, editTaskComment, listTaskComments } from '@/lib/memos';
import { getStatusHistory, getTaskOrigin, reorderParts, setPartStatus, setStatus, type TaskStatus } from '@/lib/tasks';
import { formatDateLabel, kstDate } from '@/lib/time';
import { STATUS_LABEL, STATUSES, formatWhen, toNoteView, type NoteView } from '@/lib/view';
import { requireActionUser } from '@/server/session';
import { runAction, type ActionResult } from './result';

export async function setStatusAction(taskId: number, occurrenceKey: string, status: TaskStatus): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    if (!STATUSES.includes(status)) throw new AppError('invalid', '잘못된 상태입니다');
    await setStatus(await getDb(), user.id, taskId, occurrenceKey, status, new Date());
    revalidatePath('/');
  });
}

export async function setPartStatusAction(partId: number, occurrenceKey: string, status: TaskStatus): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    if (!STATUSES.includes(status)) throw new AppError('invalid', '잘못된 상태입니다');
    await setPartStatus(await getDb(), user.id, partId, occurrenceKey, status, new Date());
    revalidatePath('/');
  });
}

export async function reorderPartsAction(taskId: number, ids: number[]): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionUser();
    if (!Array.isArray(ids) || ids.some((x) => !Number.isInteger(x))) throw new AppError('invalid', '잘못된 순서입니다');
    await reorderParts(await getDb(), taskId, ids);
    revalidatePath('/', 'layout');
  });
}

export type TaskDetails = {
  origin: { by: string; date: string } | null;
  comments: NoteView[];
  history: { text: string; when: string }[];
};

export async function loadTaskDetails(taskId: number, occurrenceKey: string): Promise<TaskDetails> {
  await requireActionUser();
  const db = await getDb();
  const today = kstDate(new Date());
  const [comments, history, origin] = await Promise.all([
    listTaskComments(db, taskId, occurrenceKey),
    getStatusHistory(db, taskId, occurrenceKey),
    getTaskOrigin(db, taskId),
  ]);
  return {
    origin: origin ? { by: origin.creatorName, date: formatDateLabel(kstDate(origin.createdAt)) } : null,
    comments: comments.map((c) => toNoteView(c, today)),
    history: history.map((h) => ({
      text: `${h.userName}: ${STATUS_LABEL[h.from]} → ${STATUS_LABEL[h.to]}`,
      when: formatWhen(h.at, today),
    })),
  };
}

export async function addCommentAction(taskId: number, occurrenceKey: string, body: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await addTaskComment(await getDb(), user, taskId, occurrenceKey, body, new Date());
    revalidatePath('/');
  });
}

export async function editCommentAction(id: number, body: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await editTaskComment(await getDb(), user, id, body, new Date());
    revalidatePath('/');
  });
}

export async function deleteCommentAction(id: number): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await deleteTaskComment(await getDb(), user, id);
    revalidatePath('/');
  });
}
