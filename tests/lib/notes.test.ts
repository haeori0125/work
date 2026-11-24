import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import {
  createNote, deleteNote, leaveNote, listNotes, listSharedNotes, syncNote, notePreview, noteTitle, setNotePinned, setNotesShared, updateNote,
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

  it('shares only with the people I pick', async () => {
    const c = await makeUser(db, '민수');
    const n1 = await createNote(db, a, at('2026-11-20T00:00:00Z'));
    await setNotesShared(db, a, [n1.id], true, at('2026-11-24T00:00:00Z'), [b]);
    expect((await listSharedNotes(db, b)).map((n) => n.id)).toEqual([n1.id]);
    expect(await listSharedNotes(db, c)).toEqual([]);
    expect((await listNotes(db, a))[0].sharedTo).toEqual([b]);
    // 다시 모두에게
    await setNotesShared(db, a, [n1.id], true, at('2026-11-24T01:00:00Z'));
    expect((await listSharedNotes(db, c)).map((n) => n.id)).toEqual([n1.id]);
    expect((await listNotes(db, a))[0].sharedTo).toEqual([]);
    // 공유를 풀면 받는 사람도 지워진다
    await setNotesShared(db, a, [n1.id], true, at('2026-11-24T02:00:00Z'), [c]);
    await setNotesShared(db, a, [n1.id], false, at('2026-11-24T03:00:00Z'));
    expect(await listSharedNotes(db, c)).toEqual([]);
    expect(await codeOf(setNotesShared(db, a, [n1.id], true, at('2026-11-24T00:00:00Z'), [9999]))).toBe('invalid');
  });

  it('lets people edit together when shared for editing, merging their lines', async () => {
    const n = await createNote(db, a, at('2026-11-20T00:00:00Z'));
    const v1 = await updateNote(db, a, n.id, '장보기\n우유\n빵', at('2026-11-20T00:01:00Z'));
    // 읽기만 공유면 못 고친다
    await setNotesShared(db, a, [n.id], true, at('2026-11-20T00:02:00Z'), [b]);
    expect(await codeOf(updateNote(db, b, n.id, 'x', at('2026-11-20T00:03:00Z')))).toBe('not_found');
    expect((await syncNote(db, b, n.id, null, v1.version, at('2026-11-20T00:03:00Z'))).edit).toBe(false);
    // 함께 편집으로 공유
    await setNotesShared(db, a, [n.id], true, at('2026-11-20T00:04:00Z'), [b], true);
    expect((await listSharedNotes(db, b))[0].sharedEdit).toBe(true);
    const base = { version: v1.version, body: v1.body };
    const fromB = await updateNote(db, b, n.id, '장보기\n우유\n빵\n계란', at('2026-11-20T00:05:00Z'), base);
    expect(fromB.version).toBe(v1.version + 1);
    // a는 옛 판에서 고쳤다 → 둘 다 남는다
    const fromA = await updateNote(db, a, n.id, '장보기\n두유\n빵', at('2026-11-20T00:06:00Z'), base);
    expect(fromA.body).toBe('장보기\n두유\n빵\n계란');
  });

  it('shows who else has the note open and on which line', async () => {
    const n = await createNote(db, a, at('2026-11-20T00:00:00Z'));
    await setNotesShared(db, a, [n.id], true, at('2026-11-20T00:00:00Z'), [], true);
    await syncNote(db, b, n.id, 2, 0, at('2026-11-20T00:00:00Z'));
    const s1 = await syncNote(db, a, n.id, 0, 0, at('2026-11-20T00:00:05Z'));
    expect(s1.others).toEqual([{ userId: b, name: '영희', line: 2 }]);
    expect(s1.body).toBeNull(); // 판이 같으면 글은 안 보낸다
    // 오래되면 빠진다
    expect((await syncNote(db, a, n.id, 0, 0, at('2026-11-20T00:01:00Z'))).others).toEqual([]);
    await syncNote(db, b, n.id, 1, 0, at('2026-11-20T00:01:00Z'));
    await leaveNote(db, b, n.id);
    expect((await syncNote(db, a, n.id, 0, 0, at('2026-11-20T00:01:01Z'))).others).toEqual([]);
    // 받지 못한 사람은 못 본다
    await setNotesShared(db, a, [n.id], false, at('2026-11-20T00:02:00Z'));
    expect(await codeOf(syncNote(db, b, n.id, 0, 0, at('2026-11-20T00:02:00Z')))).toBe('not_found');
  });
});
