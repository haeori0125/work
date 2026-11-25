import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import {
  approveRequest, cancelRequest, createRequest, listMyRequests, listPendingRequests, rejectRequest,
} from '@/lib/requests';
import { createTask, type TaskInput } from '@/lib/tasks';

const spec = (over: Partial<TaskInput>): TaskInput => ({
  title: '청소', description: null, kind: 'dated', repeat: 'none', weekdays: [], startDate: '2026-11-30', endDate: null, assigneeIds: [], ...over,
});
import { createTestDb } from '../helpers/db';
import { at, makeUser } from '../helpers/fixtures';

let db: Db;
let a: number;
let b: number;
let admin: number;
const codeOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);
beforeEach(async () => {
  db = await createTestDb(); a = await makeUser(db, '철수'); b = await makeUser(db, '영희');
  admin = await makeUser(db, '운영자', { role: 'admin' });
});

describe('task requests', () => {
  it('validates input', async () => {
    expect(await codeOf(createRequest(db, a, spec({ title: '  ' }), at('2026-11-24T00:00:00Z')))).toBe('invalid');
    expect(await codeOf(createRequest(db, a, spec({ title: 'x'.repeat(101) }), at('2026-11-24T00:00:00Z')))).toBe('invalid');
    expect(await codeOf(createRequest(db, a, spec({ kind: 'dated', dueDate: '2026-12-01' }), at('2026-11-24T00:00:00Z')))).toBe('invalid');
  });

  it('lists pending oldest first for admins, mine newest first', async () => {
    const r1 = await createRequest(db, a, spec({ title: '재고 점검', description: ' 창고 ', kind: 'weekly', repeat: 'weekly', assigneeIds: [a, b], parts: [{ id: 77, title: ' 1층 ', assigneeId: a }] }), at('2026-11-24T01:00:00Z'));
    const r2 = await createRequest(db, b, spec({}), at('2026-11-24T02:00:00Z'));
    const r3 = await createRequest(db, a, spec({ title: '보고서' }), at('2026-11-24T03:00:00Z'));
    const pending = await listPendingRequests(db);
    expect(pending.map((r) => r.id)).toEqual([r1, r2, r3]);
    expect(pending[0]).toMatchObject({ requesterName: '철수', description: '창고', wantedDate: '2026-11-30', status: 'pending' });
    expect(pending[0].spec).toMatchObject({ kind: 'weekly', repeat: 'weekly', assigneeIds: [a, b], parts: [{ title: '1층', assigneeId: a }] });
    expect(pending[0].spec!.parts![0]).not.toHaveProperty('id');
    expect((await listMyRequests(db, a)).map((r) => r.id)).toEqual([r3, r1]);
  });

  it('approve links the task, reject closes it, and neither can happen twice', async () => {
    const r1 = await createRequest(db, a, spec({ title: '재고 점검' }), at('2026-11-24T01:00:00Z'));
    const r2 = await createRequest(db, a, spec({}), at('2026-11-24T02:00:00Z'));
    const taskId = await createTask(db, admin, {
      title: '재고 점검', description: null, kind: 'dated', repeat: 'none', weekdays: [], startDate: '2026-11-30', endDate: null, assigneeIds: [a],
    });
    await approveRequest(db, r1, admin, taskId, at('2026-11-24T05:00:00Z'));
    await rejectRequest(db, r2, admin, at('2026-11-24T05:00:00Z'));
    expect(await listPendingRequests(db)).toEqual([]);
    expect((await listMyRequests(db, a)).map((r) => [r.id, r.status])).toEqual([[r2, 'rejected'], [r1, 'approved']]);
    expect(await codeOf(rejectRequest(db, r1, admin, at('2026-11-24T06:00:00Z')))).toBe('conflict');
    expect(await codeOf(approveRequest(db, 999, admin, taskId, at('2026-11-24T06:00:00Z')))).toBe('not_found');
  });

  it('only the requester can cancel a pending request', async () => {
    const r = await createRequest(db, a, spec({}), at('2026-11-24T01:00:00Z'));
    expect(await codeOf(cancelRequest(db, b, r))).toBe('forbidden');
    await cancelRequest(db, a, r);
    expect(await listMyRequests(db, a)).toEqual([]);
  });
});

describe('edit requests', () => {
  it('stores which task to change and keeps part ids so existing parts get updated', async () => {
    const taskId = await createTask(db, admin, spec({ title: '자료 정리', parts: [{ title: '1부', assigneeId: a }] }));
    const r = await createRequest(db, a, spec({ title: '자료 정리(수정)', parts: [{ id: 5, title: '1부', assigneeId: b }] }), at('2026-11-25T00:00:00Z'), taskId);
    const [p] = await listPendingRequests(db);
    expect(p.id).toBe(r);
    expect(p.editOf).toBe(taskId);
    expect(p.spec?.parts?.[0]).toEqual({ id: 5, title: '1부', assigneeId: b });
    // 새 업무 요청은 editOf 없음, 파트 id 버림
    await createRequest(db, a, spec({ title: '새 일', parts: [{ id: 9, title: 'x', assigneeId: null }] }), at('2026-11-25T01:00:00Z'));
    const fresh = (await listPendingRequests(db)).find((x) => x.title === '새 일')!;
    expect(fresh.editOf).toBeNull();
    expect(fresh.spec?.parts?.[0]).toEqual({ title: 'x', assigneeId: null });
    expect(await codeOf(createRequest(db, a, spec({}), at('2026-11-25T02:00:00Z'), 9999))).toBe('not_found');
  });
});
