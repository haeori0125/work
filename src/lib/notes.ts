import { and, desc, eq, exists, ilike, inArray, ne, notExists, or } from 'drizzle-orm';
import { noteShares, notes, users } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppError } from './errors';

export { notePreview, noteTitle } from './note-text';

export type Note = { id: number; body: string; pinned: boolean; shared: boolean; createdAt: Date; updatedAt: Date };
/** 내 메모 + 받는 사람(공유했는데 비어 있으면 모두) */
export type MyNote = Note & { sharedTo: number[] };
export type SharedNote = Note & { authorName: string; sharedAt: Date };

const MAX_NOTE = 20000;
const cols = { id: notes.id, body: notes.body, pinned: notes.pinned, shared: notes.shared, createdAt: notes.createdAt, updatedAt: notes.updatedAt };

export async function listNotes(db: Db, userId: number, query?: string): Promise<MyNote[]> {
  const conds = [eq(notes.userId, userId)];
  const q = query?.trim();
  if (q) conds.push(ilike(notes.body, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`));
  const rows = await db.select(cols).from(notes).where(and(...conds))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt), desc(notes.id));
  const shares = rows.some((r) => r.shared)
    ? await db.select({ noteId: noteShares.noteId, userId: noteShares.userId }).from(noteShares)
      .innerJoin(notes, eq(notes.id, noteShares.noteId)).where(eq(notes.userId, userId))
    : [];
  return rows.map((r) => ({ ...r, sharedTo: shares.filter((x) => x.noteId === r.id).map((x) => x.userId) }));
}

/** 다른 사람이 공유한 메모(읽기 전용), 최근 수정순 */
export async function listSharedNotes(db: Db, viewerId: number): Promise<SharedNote[]> {
  const rows = await db.select({ ...cols, sharedAt: notes.sharedAt, authorName: users.name })
    .from(notes).innerJoin(users, eq(users.id, notes.userId))
    .where(and(eq(notes.shared, true), ne(notes.userId, viewerId), or(
      // 받는 사람을 정하지 않았으면 모두, 정했으면 그 사람만
      notExists(db.select({ x: noteShares.noteId }).from(noteShares).where(eq(noteShares.noteId, notes.id))),
      exists(db.select({ x: noteShares.noteId }).from(noteShares).where(and(eq(noteShares.noteId, notes.id), eq(noteShares.userId, viewerId)))),
    )))
    .orderBy(desc(notes.updatedAt), desc(notes.id));
  return rows.map((r) => ({ ...r, sharedAt: r.sharedAt ?? r.updatedAt }));
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

/**
 * 내 메모 여러 개를 한 번에 공유하거나 공유를 푼다(남의 메모는 바꿀 수 없음).
 * to: 받는 사람. 비우면 모두에게.
 */
export async function setNotesShared(db: Db, userId: number, ids: number[], shared: boolean, now: Date, to: number[] = []): Promise<void> {
  const list = [...new Set(ids)];
  if (!list.length || list.some((x) => !Number.isInteger(x))) throw new AppError('invalid', '공유할 메모를 골라 주세요');
  const mine = await db.select({ id: notes.id }).from(notes).where(and(eq(notes.userId, userId), inArray(notes.id, list)));
  if (mine.length !== list.length) throw new AppError('not_found', '메모를 찾을 수 없습니다');
  const people = [...new Set(to)].filter((x) => x !== userId);
  if (people.some((x) => !Number.isInteger(x))) throw new AppError('invalid', '받는 사람을 다시 골라 주세요');
  if (shared && people.length) {
    const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, people));
    if (found.length !== people.length) throw new AppError('invalid', '받는 사람을 찾을 수 없습니다');
  }
  await db.transaction(async (tx) => {
    await tx.update(notes).set({ shared, sharedAt: shared ? now : null })
      .where(and(eq(notes.userId, userId), inArray(notes.id, list)));
    await tx.delete(noteShares).where(inArray(noteShares.noteId, list));
    if (shared && people.length) {
      await tx.insert(noteShares).values(list.flatMap((noteId) => people.map((u) => ({ noteId, userId: u }))));
    }
  });
}

export async function deleteNote(db: Db, userId: number, id: number): Promise<void> {
  const rows = await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId))).returning({ id: notes.id });
  if (!rows.length) throw new AppError('not_found', '메모를 찾을 수 없습니다');
}
