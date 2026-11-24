import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import {
  createNote, deleteNote, listNotes, listSharedNotes, notePreview, noteTitle, setNotePinned, setNotesShared, updateNote,
} from '@/lib/notes';
import { createTestDb } from '../helpers/db';
import { at, makeUser } from '../helpers/fixtures';

let db: Db;
let a: number;
let b: number;
const codeOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);
beforeEach(async () => { db = await createTestDb(); a = await makeUser(db, '철수'); b = await makeUser(db, '영희'); });

describe('notes', () => {
  it('lists pinned first, then most recently updated', async () => {
    const n1 = await createNote(db, a, at('2026-11-20T00:00:00Z'));
    const n2 = await createNote(db, a, at('2026-11-21T00:00:00Z'));
    const n3 = await createNote(db, a, at('2026-11-22T00:00:00Z'));
    await updateNote(db, a, n1.id, '오래된 메모', at('2026-11-23T00:00:00Z'));
    await setNotePinned(db, a, n2.id, true, at('2026-11-23T01:00:00Z'));
    expect((await listNotes(db, a)).map((n) => n.id)).toEqual([n2.id, n1.id, n3.id]);
    expect(await listNotes(db, b)).toEqual([]);
  });

  it('searches body text case-insensitively', async () => {
    const n = await createNote(db, a, at('2026-11-20T00:00:00Z'));
    await updateNote(db, a, n.id, 'Shopping 목록\n우유', at('2026-11-20T00:00:00Z'));
    await createNote(db, a, at('2026-11-20T00:00:00Z'));
    expect((await listNotes(db, a, 'shopping')).map((x) => x.id)).toEqual([n.id]);
    expect((await listNotes(db, a, '우유')).map((x) => x.id)).toEqual([n.id]);
  });

  it("refuses to touch someone else's note", async () => {
    const n = await createNote(db, a, at('2026-11-20T00:00:00Z'));
    expect(await codeOf(updateNote(db, b, n.id, 'x', at('2026-11-20T00:00:00Z')))).toBe('not_found');
    expect(await codeOf(setNotePinned(db, b, n.id, true, at('2026-11-20T00:00:00Z')))).toBe('not_found');
    expect(await codeOf(deleteNote(db, b, n.id))).toBe('not_found');
    await deleteNote(db, a, n.id);
    expect(await listNotes(db, a)).toEqual([]);
  });

  it('limits length', async () => {
    const n = await createNote(db, a, at('2026-11-20T00:00:00Z'));
    expect(await codeOf(updateNote(db, a, n.id, 'x'.repeat(20001), at('2026-11-20T00:00:00Z')))).toBe('too_long');
  });
});

describe('title and preview', () => {
  it('uses the first line as title and the rest as preview', () => {
    expect(noteTitle('  장보기 \n우유\n커피')).toBe('장보기');
    expect(notePreview('장보기\n우유\n커피')).toBe('우유 커피');
    expect(noteTitle('\n')).toBe('새로운 메모');
    expect(notePreview('제목만')).toBe('추가 텍스트 없음');
  });
});

describe('shared notes', () => {
  it('shares several of my notes read-only with others, and unshares them', async () => {
    const n1 = await createNote(db, a, at('2026-11-20T00:00:00Z'));
    const n2 = await createNote(db, a, at('2026-11-21T00:00:00Z'));
    const n3 = await createNote(db, a, at('2026-11-22T00:00:00Z'));
    await updateNote(db, a, n1.id, '회의록\n내용', at('2026-11-23T00:00:00Z'));
    await setNotesShared(db, a, [n1.id, n2.id], true, at('2026-11-24T00:00:00Z'));
    expect((await listSharedNotes(db, b)).map((n) => [n.id, n.authorName])).toEqual([[n1.id, '철수'], [n2.id, '철수']]);
    expect(await listSharedNotes(db, a)).toEqual([]); // 내 것은 내 목록에서 본다
    expect((await listNotes(db, a)).filter((n) => n.shared).map((n) => n.id).sort()).toEqual([n1.id, n2.id].sort());
    // 남이 내 메모를 고치거나 공유를 바꿀 수 없다
    expect(await codeOf(updateNote(db, b, n1.id, 'x', at('2026-11-24T00:00:00Z')))).toBe('not_found');
    expect(await codeOf(setNotesShared(db, b, [n1.id], false, at('2026-11-24T00:00:00Z')))).toBe('not_found');
    await setNotesShared(db, a, [n1.id], false, at('2026-11-24T01:00:00Z'));
    expect((await listSharedNotes(db, b)).map((n) => n.id)).toEqual([n2.id]);
    expect(await codeOf(setNotesShared(db, a, [], true, at('2026-11-24T00:00:00Z')))).toBe('invalid');
    expect(n3.shared).toBe(false);
  });
});
