import { and, asc, eq } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { boardPosts, personalMemos, taskComments, users } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppError } from './errors';

export type Actor = { id: number; role: 'member' | 'admin' };

export type Note = {
  id: number;
  authorId: number;
  authorName: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

const MAX_NOTE = 2000;
const MAX_PERSONAL = 20000;

function cleanBody(body: string, max = MAX_NOTE): string {
  const t = body.trim();
  if (!t) throw new AppError('empty', '내용을 입력하세요');
  if (t.length > max) throw new AppError('too_long', `${max}자 이하로 입력하세요`);
  return t;
}

type NoteTable = PgTable & {
  id: AnyPgColumn; authorId: AnyPgColumn; body: AnyPgColumn; updatedAt: AnyPgColumn;
};

async function authorOf(db: Db, table: NoteTable, id: number): Promise<number> {
  const [row] = await db.select({ authorId: table.authorId }).from(table).where(eq(table.id, id));
  if (!row) throw new AppError('not_found', '메모를 찾을 수 없습니다');
  return row.authorId as number;
}

async function editNote(db: Db, table: NoteTable, actor: Actor, id: number, body: string, now: Date) {
  const text = cleanBody(body);
  if ((await authorOf(db, table, id)) !== actor.id) throw new AppError('forbidden', '작성자만 수정할 수 있습니다');
  await db.update(table).set({ body: text, updatedAt: now }).where(eq(table.id, id));
}

async function deleteNote(db: Db, table: NoteTable, actor: Actor, id: number) {
  const author = await authorOf(db, table, id);
  if (author !== actor.id && actor.role !== 'admin') throw new AppError('forbidden', '작성자나 관리자만 삭제할 수 있습니다');
  await db.delete(table).where(eq(table.id, id));
}

// 업무 메모
export function listTaskComments(db: Db, taskId: number, occurrenceKey: string): Promise<Note[]> {
  return db.select({
    id: taskComments.id, authorId: taskComments.authorId, authorName: users.name, body: taskComments.body,
    createdAt: taskComments.createdAt, updatedAt: taskComments.updatedAt,
  }).from(taskComments).innerJoin(users, eq(users.id, taskComments.authorId))
    .where(and(eq(taskComments.taskId, taskId), eq(taskComments.occurrenceKey, occurrenceKey)))
    .orderBy(asc(taskComments.createdAt), asc(taskComments.id));
}

export async function addTaskComment(
  db: Db, actor: Actor, taskId: number, occurrenceKey: string, body: string, now: Date,
): Promise<number> {
  const [row] = await db.insert(taskComments).values({
    taskId, occurrenceKey, authorId: actor.id, body: cleanBody(body), createdAt: now, updatedAt: now,
  }).returning({ id: taskComments.id });
  return row.id;
}

export const editTaskComment = (db: Db, actor: Actor, id: number, body: string, now: Date) =>
  editNote(db, taskComments, actor, id, body, now);
export const deleteTaskComment = (db: Db, actor: Actor, id: number) => deleteNote(db, taskComments, actor, id);

// 공용 메모판
export function listBoardPosts(db: Db, date: string): Promise<Note[]> {
  return db.select({
    id: boardPosts.id, authorId: boardPosts.authorId, authorName: users.name, body: boardPosts.body,
    createdAt: boardPosts.createdAt, updatedAt: boardPosts.updatedAt,
  }).from(boardPosts).innerJoin(users, eq(users.id, boardPosts.authorId))
    .where(eq(boardPosts.date, date))
    .orderBy(asc(boardPosts.createdAt), asc(boardPosts.id));
}

export async function addBoardPost(db: Db, actor: Actor, date: string, body: string, now: Date): Promise<number> {
  const [row] = await db.insert(boardPosts).values({
    date, authorId: actor.id, body: cleanBody(body), createdAt: now, updatedAt: now,
  }).returning({ id: boardPosts.id });
  return row.id;
}

export const editBoardPost = (db: Db, actor: Actor, id: number, body: string, now: Date) =>
  editNote(db, boardPosts, actor, id, body, now);
export const deleteBoardPost = (db: Db, actor: Actor, id: number) => deleteNote(db, boardPosts, actor, id);

// 개인 메모
export async function getPersonalMemoRecord(db: Db, userId: number): Promise<{ body: string; updatedAt: Date | null }> {
  const [row] = await db.select().from(personalMemos).where(eq(personalMemos.userId, userId));
  return { body: row?.body ?? '', updatedAt: row?.updatedAt ?? null };
}

export async function getPersonalMemo(db: Db, userId: number): Promise<string> {
  return (await getPersonalMemoRecord(db, userId)).body;
}

export async function savePersonalMemo(db: Db, userId: number, body: string, now: Date): Promise<void> {
  if (body.length > MAX_PERSONAL) throw new AppError('too_long', `${MAX_PERSONAL}자 이하로 입력하세요`);
  await db.insert(personalMemos).values({ userId, body, updatedAt: now })
    .onConflictDoUpdate({ target: personalMemos.userId, set: { body, updatedAt: now } });
}
