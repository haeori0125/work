import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import {
  addBoardPost, addTaskComment, deleteBoardPost, deleteTaskComment, editBoardPost, editTaskComment,
  getPersonalMemo, listBoardPosts, listTaskComments, savePersonalMemo, type Actor,
} from '@/lib/memos';
import { createTask, deleteTask } from '@/lib/tasks';
import { createTestDb } from '../helpers/db';
import { at, makeUser } from '../helpers/fixtures';

let db: Db;
let admin: Actor;
let a: Actor;
let b: Actor;
let taskId: number;
const NOW = at('2026-11-23T05:20:00Z');
const codeOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);

beforeEach(async () => {
  db = await createTestDb();
  admin = { id: await makeUser(db, '운영자', { role: 'admin' }), role: 'admin' };
  a = { id: await makeUser(db, '철수'), role: 'member' };
  b = { id: await makeUser(db, '영희'), role: 'member' };
  taskId = await createTask(db, admin.id, {
    title: '재고', description: null, kind: 'dated', repeat: 'daily', weekdays: [],
    startDate: '2026-11-01', endDate: null, assigneeIds: [],
  });
});

describe('task comments', () => {
  it('are scoped to an occurrence and show the author', async () => {
    await addTaskComment(db, a, taskId, '2026-11-23', '재고 3개 부족', NOW);
    await addTaskComment(db, b, taskId, '2026-11-24', '다른 날', NOW);
    const list = await listTaskComments(db, taskId, '2026-11-23');
    expect(list.map((c) => [c.authorName, c.body])).toEqual([['철수', '재고 3개 부족']]);
  });

  it('only the author edits; author or admin deletes', async () => {
    const id = await addTaskComment(db, a, taskId, '2026-11-23', '원문', NOW);
    expect(await codeOf(editTaskComment(db, b, id, '변경', NOW))).toBe('forbidden');
    expect(await codeOf(editTaskComment(db, admin, id, '변경', NOW))).toBe('forbidden');
    await editTaskComment(db, a, id, '수정본', NOW);
    expect((await listTaskComments(db, taskId, '2026-11-23'))[0].body).toBe('수정본');
    expect(await codeOf(deleteTaskComment(db, b, id))).toBe('forbidden');
    await deleteTaskComment(db, admin, id);
    expect(await listTaskComments(db, taskId, '2026-11-23')).toEqual([]);
  });

  it('refuses comments on missing, deleted or non-occurring tasks', async () => {
    expect(await codeOf(addTaskComment(db, a, 99999, '2026-11-23', '메모', NOW))).toBe('no_occurrence');
    expect(await codeOf(addTaskComment(db, a, taskId, '2026-10-01', '메모', NOW))).toBe('no_occurrence');
    expect(await codeOf(addTaskComment(db, a, taskId, 'abc', '메모', NOW))).toBe('no_occurrence');
    await deleteTask(db, taskId, NOW);
    expect(await codeOf(addTaskComment(db, a, taskId, '2026-11-23', '메모', NOW))).toBe('no_occurrence');
  });

  it('rejects empty and overly long bodies', async () => {
    expect(await codeOf(addTaskComment(db, a, taskId, '2026-11-23', '   ', NOW))).toBe('empty');
    expect(await codeOf(addTaskComment(db, a, taskId, '2026-11-23', 'x'.repeat(2001), NOW))).toBe('too_long');
  });
});

describe('board posts', () => {
  it('are per date with the same permission rules', async () => {
    const id = await addBoardPost(db, a, '2026-11-23', '오늘 공지', NOW);
    await addBoardPost(db, b, '2026-11-24', '내일 공지', NOW);
    expect((await listBoardPosts(db, '2026-11-23')).map((p) => p.body)).toEqual(['오늘 공지']);
    expect(await codeOf(editBoardPost(db, b, id, 'x', NOW))).toBe('forbidden');
    expect(await codeOf(deleteBoardPost(db, b, id))).toBe('forbidden');
    await deleteBoardPost(db, admin, id);
    expect(await listBoardPosts(db, '2026-11-23')).toEqual([]);
  });
});

describe('personal memo', () => {
  it('is separate per user and empty by default', async () => {
    expect(await getPersonalMemo(db, a.id)).toBe('');
    await savePersonalMemo(db, a.id, '내 메모', NOW);
    await savePersonalMemo(db, a.id, '내 메모 2', NOW);
    expect(await getPersonalMemo(db, a.id)).toBe('내 메모 2');
    expect(await getPersonalMemo(db, b.id)).toBe('');
  });
});
