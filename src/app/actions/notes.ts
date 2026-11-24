'use server';

import { getDb } from '@/db';
import { createNote, deleteNote, leaveNote, setNotePinned, setNotesShared, syncNote, updateNote, type Presence } from '@/lib/notes';
import { AppError } from '@/lib/errors';
import { requireActionUser } from '@/server/session';
import { runAction, type ActionResult } from './result';

export type NoteDto = { id: number; body: string; pinned: boolean; shared: boolean; sharedEdit: boolean; sharedTo: number[]; version: number; updatedAt: string };
/** 다른 사람이 공유한 메모(sharedEdit면 같이 고칠 수 있음) */
export type SharedNoteDto = { id: number; body: string; updatedAt: string; authorName: string; sharedEdit: boolean; version: number };

export async function createNoteAction(): Promise<NoteDto | { error: string }> {
  const user = await requireActionUser().catch(() => null);
  if (!user) return { error: '로그인이 필요합니다. 다시 로그인해 주세요.' };
  const n = await createNote(await getDb(), user.id, new Date());
  return { id: n.id, body: n.body, pinned: n.pinned, shared: n.shared, sharedEdit: false, sharedTo: [], version: n.version, updatedAt: n.updatedAt.toISOString() };
}

type Fail = { error: string; code: string };
async function guard<T>(fn: () => Promise<T>): Promise<T | Fail> {
  try { return await fn(); } catch (e) { if (e instanceof AppError) return { error: e.message, code: e.code }; throw e; }
}

/** 저장. base를 주면 그사이 다른 사람이 고친 내용과 합쳐서 저장하고, 저장된 글과 판을 돌려준다 */
export async function updateNoteAction(id: number, body: string, base?: { version: number; body: string }): Promise<{ body: string; version: number } | Fail> {
  return guard(async () => {
    const user = await requireActionUser();
    return updateNote(await getDb(), user.id, id, body, new Date(), base);
  });
}

/** 같이 보고 있는 사람·커서 줄과 최신 판(바뀌었을 때만 글) */
export async function syncNoteAction(id: number, line: number | null, knownVersion: number):
  Promise<{ version: number; body: string | null; edit: boolean; others: Presence[] } | Fail> {
  return guard(async () => {
    const user = await requireActionUser();
    return syncNote(await getDb(), user.id, id, line, knownVersion, new Date());
  });
}

export async function leaveNoteAction(id: number): Promise<void> {
  const user = await requireActionUser().catch(() => null);
  if (user) await leaveNote(await getDb(), user.id, id).catch(() => {});
}

export async function setNotePinnedAction(id: number, pinned: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await setNotePinned(await getDb(), user.id, id, pinned, new Date());
  });
}

export async function deleteNoteAction(id: number): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await deleteNote(await getDb(), user.id, id);
  });
}

export async function setNotesSharedAction(ids: number[], shared: boolean, to: number[] = [], edit = false): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await setNotesShared(await getDb(), user.id, ids, shared, new Date(), to, edit);
    if (!shared) return `${ids.length}개 공유를 풀었습니다`;
    return `${ids.length}개를 ${to.length ? `${to.length}명에게` : '모두에게'} 공유했습니다`;
  });
}
