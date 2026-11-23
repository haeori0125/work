'use server';

import { getDb } from '@/db';
import { createNote, deleteNote, setNotePinned, updateNote } from '@/lib/notes';
import { requireActionUser } from '@/server/session';
import { runAction, type ActionResult } from './result';

export type NoteDto = { id: number; body: string; pinned: boolean; updatedAt: string };

export async function createNoteAction(): Promise<NoteDto | { error: string }> {
  const user = await requireActionUser().catch(() => null);
  if (!user) return { error: '로그인이 필요합니다. 다시 로그인해 주세요.' };
  const n = await createNote(await getDb(), user.id, new Date());
  return { id: n.id, body: n.body, pinned: n.pinned, updatedAt: n.updatedAt.toISOString() };
}

export async function updateNoteAction(id: number, body: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await updateNote(await getDb(), user.id, id, body, new Date());
  });
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
