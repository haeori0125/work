import { and, desc, eq, exists, gt, ilike, inArray, ne, notExists, or, sql } from 'drizzle-orm';
import { notePresence, noteShares, notes, users } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppError } from './errors';
import { merge3 } from './merge';

export { notePreview, noteTitle } from './note-text';

export type Note = { id: number; body: string; pinned: boolean; shared: boolean; sharedEdit: boolean; version: number; createdAt: Date; updatedAt: Date };
/** 내 메모 + 받는 사람(공유했는데 비어 있으면 모두) */
export type MyNote = Note & { sharedTo: number[] };
export type SharedNote = Note & { authorName: string; sharedAt: Date };

const MAX_NOTE = 20000;
const cols = {
  id: notes.id, body: notes.body, pinned: notes.pinned, shared: notes.shared, sharedEdit: notes.sharedEdit, version: notes.version,
  createdAt: notes.createdAt, updatedAt: notes.updatedAt,
};

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

/** viewer가 받을 수 있는 공유 메모 조건: 받는 사람을 정하지 않았으면 모두, 정했으면 그 사람만 */
const sharedWith = (db: Db, viewerId: number) => and(eq(notes.shared, true), ne(notes.userId, viewerId), or(
  notExists(db.select({ x: noteShares.noteId }).from(noteShares).where(eq(noteShares.noteId, notes.id))),
  exists(db.select({ x: noteShares.noteId }).from(noteShares).where(and(eq(noteShares.noteId, notes.id), eq(noteShares.userId, viewerId)))),
));

/** 다른 사람이 공유한 메모, 최근 수정순(sharedEdit면 같이 고칠 수 있음) */
export async function listSharedNotes(db: Db, viewerId: number): Promise<SharedNote[]> {
  const rows = await db.select({ ...cols, sharedAt: notes.sharedAt, authorName: users.name })
    .from(notes).innerJoin(users, eq(users.id, notes.userId))
    .where(sharedWith(db, viewerId))
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

/** 이 사람이 메모를 볼 수 있는지, 고칠 수 있는지 */
async function access(db: Db, userId: number, id: number): Promise<{ edit: boolean } | null> {
  const [own] = await db.select({ id: notes.id }).from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
  if (own) return { edit: true };
  const [got] = await db.select({ edit: notes.sharedEdit }).from(notes).where(and(eq(notes.id, id), sharedWith(db, userId)));
  return got ? { edit: got.edit } : null;
}

/**
 * 메모 저장. base(마지막으로 받아 둔 판과 글)를 주면, 그사이 다른 사람이 저장한 내용과 줄 단위로 합친다.
 * 결과로 저장된 글과 판 번호를 돌려준다(합쳐졌으면 보낸 글과 다를 수 있음).
 */
export async function updateNote(
  db: Db, userId: number, id: number, body: string, now: Date, base?: { version: number; body: string },
): Promise<{ body: string; version: number }> {
  if (body.length > MAX_NOTE) throw new AppError('too_long', `메모는 ${MAX_NOTE.toLocaleString()}자까지 쓸 수 있습니다`);
  const can = await access(db, userId, id);
  if (!can?.edit) throw new AppError('not_found', '메모를 찾을 수 없습니다');
  return db.transaction(async (tx) => {
    const [cur] = await tx.select({ body: notes.body, version: notes.version }).from(notes).where(eq(notes.id, id)).for('update');
    if (!cur) throw new AppError('not_found', '메모를 찾을 수 없습니다');
    let next = body;
    if (base && base.version !== cur.version) next = merge3(base.body, body, cur.body);
    if (next.length > MAX_NOTE) next = next.slice(0, MAX_NOTE);
    const [row] = await tx.update(notes).set({ body: next, version: sql`${notes.version} + 1`, updatedAt: now })
      .where(eq(notes.id, id)).returning({ body: notes.body, version: notes.version });
    return row;
  });
}

export type Presence = { userId: number; name: string; line: number | null };
const ALIVE_MS = 12_000;

/**
 * 메모를 보고 있다고 알리고(line: 커서가 있는 줄, 없으면 null), 최신 판과 같이 보고 있는 사람을 받는다.
 * 판이 바뀌지 않았으면 글은 보내지 않는다.
 */
export async function syncNote(db: Db, userId: number, id: number, line: number | null, knownVersion: number, now: Date):
  Promise<{ version: number; body: string | null; edit: boolean; others: Presence[] }> {
  const can = await access(db, userId, id);
  if (!can) throw new AppError('not_found', '메모를 찾을 수 없습니다');
  const ln = line === null || !Number.isInteger(line) || line < 0 ? null : Math.min(line, 100_000);
  await db.insert(notePresence).values({ noteId: id, userId, line: ln, at: now })
    .onConflictDoUpdate({ target: [notePresence.noteId, notePresence.userId], set: { line: ln, at: now } });
  const [[cur], others] = await Promise.all([
    db.select({ body: notes.body, version: notes.version }).from(notes).where(eq(notes.id, id)),
    db.select({ userId: notePresence.userId, name: users.name, line: notePresence.line }).from(notePresence)
      .innerJoin(users, eq(users.id, notePresence.userId))
      .where(and(eq(notePresence.noteId, id), ne(notePresence.userId, userId), gt(notePresence.at, new Date(now.getTime() - ALIVE_MS))))
      .orderBy(users.name),
  ]);
  return { version: cur.version, body: cur.version === knownVersion ? null : cur.body, edit: can.edit, others };
}

/** 메모 창을 떠나면 바로 목록에서 빠지게 */
export async function leaveNote(db: Db, userId: number, id: number): Promise<void> {
  await db.delete(notePresence).where(and(eq(notePresence.noteId, id), eq(notePresence.userId, userId)));
}

export function setNotePinned(db: Db, userId: number, id: number, pinned: boolean, now: Date): Promise<void> {
  return touch(db, userId, id, { pinned, updatedAt: now });
}

/**
 * 내 메모 여러 개를 한 번에 공유하거나 공유를 푼다(남의 메모는 바꿀 수 없음).
 * to: 받는 사람. 비우면 모두에게. edit: 받는 사람도 같이 고칠 수 있게.
 */
export async function setNotesShared(
  db: Db, userId: number, ids: number[], shared: boolean, now: Date, to: number[] = [], edit = false,
): Promise<void> {
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
    await tx.update(notes).set({ shared, sharedAt: shared ? now : null, sharedEdit: shared && edit })
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
