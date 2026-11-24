import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import {
  createTask, getDayOccurrences, getOneOffStatuses, reorderParts, getWeekView, getWeeklyOccurrences, listTaskDefinitions,
  setPartStatus, setStatus, updateTask, type TaskInput,
} from '@/lib/tasks';
import { createTestDb } from '../helpers/db';
import { at, makeUser } from '../helpers/fixtures';

let db: Db;
let admin: number;
let a: number;
let b: number;
const codeOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);
const input = (p: Partial<TaskInput>): TaskInput => ({
  title: '업무', description: null, kind: 'dated', repeat: 'none', weekdays: [],
  startDate: '2026-11-23', endDate: null, assigneeIds: [], ...p,
});

beforeEach(async () => {
  db = await createTestDb();
  admin = await makeUser(db, '운영자', { role: 'admin' });
  a = await makeUser(db, '영희');
  b = await makeUser(db, '민수');
});

describe('weekly deadline', () => {
  it('repeating weekly tasks have no deadline day', async () => {
    await createTask(db, admin, input({ title: '어법파트 통일', kind: 'weekly', repeat: 'weekly' }));
    const view = await getWeekView(db, '2026-11-22');
    expect(Object.values(view).flat()).toEqual([]);
    const [goal] = await getWeeklyOccurrences(db, '2026-11-23');
    expect(goal.dueDate).toBeNull();
  });
});

describe('parts', () => {
  it('derives the task status from its parts and keeps part status per occurrence', async () => {
    const id = await createTask(db, admin, input({
      title: '행사 준비', repeat: 'daily',
      parts: [{ title: '장소 예약', assigneeId: a }, { title: '현수막 주문', assigneeId: b }],
    }));
    let [occ] = await getDayOccurrences(db, '2026-11-23');
    expect(occ.status).toBe('todo');
    expect(occ.parts.map((p) => [p.title, p.assignee?.name, p.status])).toEqual([['장소 예약', '영희', 'todo'], ['현수막 주문', '민수', 'todo']]);
    expect(occ.assignees.map((x) => x.name).sort()).toEqual(['민수', '영희']);

    await setPartStatus(db, a, occ.parts[0].id, '2026-11-23', 'done', at('2026-11-23T01:00:00Z'));
    [occ] = await getDayOccurrences(db, '2026-11-23');
    expect(occ.status).toBe('doing');
    expect(occ.parts[0].lastChange?.userName).toBe('영희');

    await setPartStatus(db, a, occ.parts[1].id, '2026-11-23', 'done', at('2026-11-23T02:00:00Z')); // 대신 체크
    [occ] = await getDayOccurrences(db, '2026-11-23');
    expect(occ.status).toBe('done');
    expect(occ.parts[1].lastChange?.userId).toBe(a);
    expect(occ.lastChange?.userName).toBe('영희');

    const [next] = await getDayOccurrences(db, '2026-11-24');
    expect(next.status).toBe('todo');
    expect(next.parts.every((p) => p.status === 'todo')).toBe(true);
    expect(id).toBeGreaterThan(0);
  });

  it('refuses checking the whole task when it has parts, and parts outside an occurrence', async () => {
    const id = await createTask(db, admin, input({ parts: [{ title: '파트', assigneeId: null }] }));
    expect(await codeOf(setStatus(db, a, id, '2026-11-23', 'done', at('2026-11-23T01:00:00Z')))).toBe('has_parts');
    const [occ] = await getDayOccurrences(db, '2026-11-23');
    expect(await codeOf(setPartStatus(db, a, occ.parts[0].id, '2026-11-24', 'done', at('2026-11-23T01:00:00Z')))).toBe('no_occurrence');
  });

  it('keeps part ids (and their status) when the task is edited, drops removed parts', async () => {
    const id = await createTask(db, admin, input({ parts: [{ title: '하나', assigneeId: a }, { title: '둘', assigneeId: b }] }));
    const [occ] = await getDayOccurrences(db, '2026-11-23');
    await setPartStatus(db, a, occ.parts[0].id, '2026-11-23', 'done', at('2026-11-23T01:00:00Z'));
    const def = (await listTaskDefinitions(db)).find((d) => d.id === id)!;
    await updateTask(db, id, { ...def, parts: [{ id: def.parts![0].id, title: '하나(수정)', assigneeId: a }, { title: '셋', assigneeId: null }] });
    const [after] = await getDayOccurrences(db, '2026-11-23');
    expect(after.parts.map((p) => [p.title, p.status])).toEqual([['하나(수정)', 'done'], ['셋', 'todo']]);
  });

  it('rejects empty part titles', async () => {
    expect(await codeOf(createTask(db, admin, input({ parts: [{ title: '  ', assigneeId: null }] })))).toBe('invalid');
  });
});

describe('one-off weekly task with exact dates', () => {
  it('runs from its start date to its due date, across weeks, as one task', async () => {
    const id = await createTask(db, admin, input({ title: '보고서', kind: 'weekly', startDate: '2026-11-25', dueDate: '2026-12-02' }));
    const [w1] = await getWeeklyOccurrences(db, '2026-11-23');
    const [w2] = await getWeeklyOccurrences(db, '2026-11-30');
    expect(w1.occurrenceKey).toBe('2026-11-23');
    expect(w2.occurrenceKey).toBe('2026-11-23'); // 같은 업무 하나
    expect(w1.dueDate).toBe('2026-12-02');
    expect(w1.startDate).toBe('2026-11-25');
    expect(await getWeeklyOccurrences(db, '2026-12-07')).toEqual([]);
    const view = await getWeekView(db, '2026-11-30');
    expect(view['2026-12-02'].map((o) => [o.title, o.dueHere])).toEqual([['보고서', true]]);
    await setStatus(db, a, id, '2026-11-23', 'done', at('2026-12-01T01:00:00Z'));
    expect((await getWeeklyOccurrences(db, '2026-11-30'))[0].status).toBe('done');
  });

  it('validates the exact due date', async () => {
    expect(await codeOf(createTask(db, admin, input({ kind: 'weekly', startDate: '2026-11-25', dueDate: '2026-11-24' })))).toBe('invalid');
    expect(await codeOf(createTask(db, admin, input({ kind: 'weekly', repeat: 'weekly', dueDate: '2026-11-27' })))).toBe('invalid');
  });
});

describe('one-off statuses', () => {
  it('reports the status of one-off tasks only', async () => {
    const once = await createTask(db, admin, input({ title: '한 번' }));
    await createTask(db, admin, input({ title: '매일', repeat: 'daily' }));
    const parted = await createTask(db, admin, input({ title: '파트', parts: [{ title: 'A', assigneeId: a }, { title: 'B', assigneeId: b }] }));
    await setStatus(db, a, once, '2026-11-23', 'done', at('2026-11-23T01:00:00Z'));
    const [p1] = (await listTaskDefinitions(db)).find((d) => d.id === parted)!.parts;
    await setPartStatus(db, a, p1.id, '2026-11-23', 'done', at('2026-11-23T01:00:00Z'));
    const map = await getOneOffStatuses(db);
    expect([...map.entries()].sort()).toEqual([[once, 'done'], [parted, 'doing']].sort());
  });
});

describe('reorder parts', () => {
  it('saves the new order and rejects a stale list', async () => {
    const id = await createTask(db, admin, input({ title: '교육청', parts: [{ title: 'A', assigneeId: a }, { title: 'B', assigneeId: b }, { title: 'C', assigneeId: null }] }));
    const ids = (await listTaskDefinitions(db)).find((d) => d.id === id)!.parts.map((p) => p.id!);
    await reorderParts(db, id, [ids[2], ids[0], ids[1]]);
    expect((await listTaskDefinitions(db)).find((d) => d.id === id)!.parts.map((p) => p.title)).toEqual(['C', 'A', 'B']);
    const [occ] = await getDayOccurrences(db, '2026-11-23');
    expect(occ.parts.map((p) => p.title)).toEqual(['C', 'A', 'B']);
    expect(await codeOf(reorderParts(db, id, [ids[0], ids[1]]))).toBe('invalid');
    expect(await codeOf(reorderParts(db, id, [ids[0], ids[0], ids[1]]))).toBe('invalid');
  });
});
