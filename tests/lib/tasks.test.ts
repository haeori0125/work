import { beforeEach, describe, expect, it } from 'vitest';
import { taskStatus } from '@/db/schema';
import type { Db } from '@/db/types';
import {
  createTask, deleteTask, getDayOccurrences, getPastOccurrences, getStatusHistory,
  getWeekView, getWeeklyOccurrences, listTaskDefinitions, setStatus, updateTask, type TaskInput,
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
  a = await makeUser(db, '철수');
  b = await makeUser(db, '영희');
});

describe('createTask validation', () => {
  it('rejects empty titles and bad recurrence', async () => {
    expect(await codeOf(createTask(db, admin, input({ title: '  ' })))).toBe('invalid');
    expect(await codeOf(createTask(db, admin, input({ repeat: 'weekly_days', weekdays: [] })))).toBe('invalid');
  });
});

describe('recurring status', () => {
  it('each occurrence of a daily task starts fresh', async () => {
    const id = await createTask(db, admin, input({ title: '청소', repeat: 'daily' }));
    await setStatus(db, a, id, '2026-11-23', 'done', at('2026-11-23T01:00:00Z'));
    expect((await getDayOccurrences(db, '2026-11-23'))[0].status).toBe('done');
    expect((await getDayOccurrences(db, '2026-11-24'))[0].status).toBe('todo');
  });
});

describe('assignees and shared status', () => {
  it('anyone can change status; last change shows the actual person', async () => {
    const id = await createTask(db, admin, input({ title: '오픈 준비', assigneeIds: [a, b] }));
    const third = await makeUser(db, '민수');
    await setStatus(db, third, id, '2026-11-23', 'doing', at('2026-11-23T00:14:00Z'));
    const [occ] = await getDayOccurrences(db, '2026-11-23');
    expect(occ.assignees.map((x) => x.name).sort()).toEqual(['영희', '철수']);
    expect(occ.status).toBe('doing');
    expect(occ.lastChange?.userName).toBe('민수');
    expect(occ.lastChange?.at.toISOString()).toBe('2026-11-23T00:14:00.000Z');
  });

  it('back-to-back changes keep the last value and both history entries', async () => {
    const id = await createTask(db, admin, input({}));
    await setStatus(db, a, id, '2026-11-23', 'doing', at('2026-11-23T01:00:00Z'));
    await setStatus(db, b, id, '2026-11-23', 'done', at('2026-11-23T01:00:01Z'));
    const [occ] = await getDayOccurrences(db, '2026-11-23');
    expect(occ.status).toBe('done');
    expect(occ.lastChange?.userName).toBe('영희');
    const hist = await getStatusHistory(db, id, '2026-11-23');
    expect(hist.map((h) => [h.from, h.to, h.userName])).toEqual([
      ['doing', 'done', '영희'], ['todo', 'doing', '철수'],
    ]);
  });

  it('refuses status on a date where the task does not occur', async () => {
    const id = await createTask(db, admin, input({ repeat: 'weekdays' }));
    expect(await codeOf(setStatus(db, a, id, '2026-11-28', 'done', at('2026-11-28T01:00:00Z')))).toBe('no_occurrence');
  });
});

describe('ordering', () => {
  it('puts done items last, others by title', async () => {
    const x = await createTask(db, admin, input({ title: '가' }));
    await createTask(db, admin, input({ title: '나' }));
    await createTask(db, admin, input({ title: '다' }));
    await setStatus(db, a, x, '2026-11-23', 'done', at('2026-11-23T01:00:00Z'));
    expect((await getDayOccurrences(db, '2026-11-23')).map((o) => o.title)).toEqual(['나', '다', '가']);
  });
});

describe('weekly tasks and week view', () => {
  it('weekly tasks use the Monday as occurrence key', async () => {
    const id = await createTask(db, admin, input({ title: '주간 점검', kind: 'weekly', repeat: 'weekly', startDate: '2026-11-25' }));
    await setStatus(db, a, id, '2026-11-23', 'doing', at('2026-11-24T01:00:00Z'));
    const [occ] = await getWeeklyOccurrences(db, '2026-11-23');
    expect(occ.occurrenceKey).toBe('2026-11-23');
    expect(occ.status).toBe('doing');
    expect((await getWeeklyOccurrences(db, '2026-11-30'))[0].status).toBe('todo');
    expect(await getDayOccurrences(db, '2026-11-25')).toEqual([]);
  });

  it('week view has 7 keys and respects weekday repeats', async () => {
    await createTask(db, admin, input({ title: '평일', repeat: 'weekdays' }));
    const view = await getWeekView(db, '2026-11-23');
    expect(Object.keys(view)).toHaveLength(7);
    expect(view['2026-11-27']).toHaveLength(1);
    expect(view['2026-11-28']).toEqual([]);
    expect(view['2026-11-29']).toEqual([]);
  });
});

describe('past tasks', () => {
  it('lists unfinished one-off dated tasks until done, never recurring ones', async () => {
    const once = await createTask(db, admin, input({ title: '비품 주문', startDate: '2026-11-21' }));
    await createTask(db, admin, input({ title: '청소', repeat: 'daily', startDate: '2026-11-20' }));
    await createTask(db, admin, input({ title: '오늘 것', startDate: '2026-11-23' }));
    let past = await getPastOccurrences(db, '2026-11-23');
    expect(past.map((o) => [o.title, o.occurrenceKey])).toEqual([['비품 주문', '2026-11-21']]);
    await setStatus(db, a, once, '2026-11-21', 'done', at('2026-11-23T01:00:00Z'));
    past = await getPastOccurrences(db, '2026-11-23');
    expect(past).toEqual([]);
  });

  it('includes one-off weekly tasks from earlier weeks, oldest first', async () => {
    await createTask(db, admin, input({ title: '지난주 점검', kind: 'weekly', startDate: '2026-11-18' }));
    await createTask(db, admin, input({ title: '더 지난 업무', startDate: '2026-11-10' }));
    await createTask(db, admin, input({ title: '이번주 점검', kind: 'weekly', startDate: '2026-11-24' }));
    const past = await getPastOccurrences(db, '2026-11-23');
    expect(past.map((o) => [o.title, o.occurrenceKey])).toEqual([
      ['더 지난 업무', '2026-11-10'], ['지난주 점검', '2026-11-16'],
    ]);
  });

  it('counts a period task as past the day after its due date, even mid-week', async () => {
    await createTask(db, admin, input({ title: '어법파트 통일', kind: 'weekly', startDate: '2026-11-23', dueDate: '2026-11-24' }));
    await createTask(db, admin, input({ title: '오늘 마감', kind: 'weekly', startDate: '2026-11-23', dueDate: '2026-11-25' }));
    expect((await getPastOccurrences(db, '2026-11-24')).map((o) => o.title)).toEqual([]);
    expect((await getPastOccurrences(db, '2026-11-25')).map((o) => o.title)).toEqual(['어법파트 통일']);
  });
});

describe('update and delete', () => {
  it('updates definitions and assignees', async () => {
    const id = await createTask(db, admin, input({ title: '옛 제목', assigneeIds: [a] }));
    await updateTask(db, id, input({ title: '새 제목', assigneeIds: [b], repeat: 'daily' }));
    const [def] = await listTaskDefinitions(db);
    expect(def.title).toBe('새 제목');
    expect(def.repeat).toBe('daily');
    expect(def.assigneeIds).toEqual([b]);
  });

  it('deleted tasks disappear from every view but status rows remain', async () => {
    const id = await createTask(db, admin, input({ startDate: '2026-11-21' }));
    await setStatus(db, a, id, '2026-11-21', 'doing', at('2026-11-21T01:00:00Z'));
    await deleteTask(db, id, at('2026-11-23T01:00:00Z'));
    expect(await getDayOccurrences(db, '2026-11-21')).toEqual([]);
    expect(await getPastOccurrences(db, '2026-11-23')).toEqual([]);
    expect(await listTaskDefinitions(db)).toEqual([]);
    expect(await db.select().from(taskStatus)).toHaveLength(1);
  });
});

describe('getTaskOrigin', () => {
  it('returns who registered the task and when, even after another admin edits it', async () => {
    const { getTaskOrigin } = await import('@/lib/tasks');
    const other = await makeUser(db, '부관리자', { role: 'admin' });
    const id = await createTask(db, admin, input({ title: '요청 업무' }));
    await updateTask(db, id, input({ title: '수정된 업무' }));
    const origin = await getTaskOrigin(db, id);
    expect(origin?.creatorName).toBe('운영자');
    expect(origin?.createdAt).toBeInstanceOf(Date);
    expect(other).toBeGreaterThan(0);
    expect(await getTaskOrigin(db, 99999)).toBeNull();
  });
});
