import { and, desc, eq, ilike } from 'drizzle-orm';
import { notes } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppError } from './errors';

export { notePreview, noteTitle } from './note-text';

export type Note = { id: number; body: string; pinned: boolean; createdAt: Date; updatedAt: Date };

const MAX_NOTE = 20000;
const cols = { id: notes.id, body: notes.body, pinned: notes.pinned, createdAt: notes.createdAt, updatedAt: notes.updatedAt };

export function listNotes(db: Db, userId: number, query?: string): Promise<Note[]> {
  const conds = [eq(notes.userId, userId)];
  const q = query?.trim();
  if (q) conds.push(ilike(notes.body, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`));
  return db.select(cols).from(notes).where(and(...conds))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt), desc(notes.id));
}

export async function createNote(db: Db, userId: number, now: Date): Promise<Note> {
  const [row] = await db.insert(notes).values({ userId, body: '', createdAt: now, updatedAt: now }).returning(cols);
  return row;
}

async function touch(db: Db, userId: number, id: number, set: Partial<typeof notes.$inferInsert>): Promise<void> {
  const rows = await db.update(notes).set(set).where(and(eq(notes.id, id), eq(notes.userId, userId))).returning({ id: notes.id });
  if (!rows.length) throw new AppError('not_found', '메모를 찾을 수 없습니다');
}

export async function updateNote(db: Db, userId: number, id: number, body: string, now: Date): Promise<void> {
  if (body.length > MAX_NOTE) throw new AppError('too_long', `메모는 ${MAX_NOTE.toLocaleString()}자까지 쓸 수 있습니다`);
  await touch(db, userId, id, { body, updatedAt: now });
}

export function setNotePinned(db: Db, userId: number, id: number, pinned: boolean, now: Date): Promise<void> {
  return touch(db, userId, id, { pinned, updatedAt: now });
}

export async function deleteNote(db: Db, userId: number, id: number): Promise<void> {
  const rows = await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId))).returning({ id: notes.id });
  if (!rows.length) throw new AppError('not_found', '메모를 찾을 수 없습니다');
}
