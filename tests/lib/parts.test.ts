import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import {
  createTask, getDayOccurrences, getWeekView, getWeeklyOccurrences, listTaskDefinitions,
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
  it('only weekly tasks take a deadline weekday (0=월…6=일)', async () => {
    expect(await codeOf(createTask(db, admin, input({ dueWeekday: 3 })))).toBe('invalid');
    expect(await codeOf(createTask(db, admin, input({ kind: 'weekly', dueWeekday: 7 })))).toBe('invalid');
    const id = await createTask(db, admin, input({ kind: 'weekly', repeat: 'weekly', dueWeekday: 3 }));
    expect((await listTaskDefinitions(db)).find((d) => d.id === id)?.dueWeekday).toBe(3);
  });

  it('appears on its deadline day in the week view, keyed by the week', async () => {
    await createTask(db, admin, input({ title: '어법파트 통일', kind: 'weekly', repeat: 'weekly', dueWeekday: 3 }));
    const view = await getWeekView(db, '2026-11-22'); // 일요일 시작 주
    expect(view['2026-11-26'].map((o) => [o.title, o.occurrenceKey, o.dueHere])).toEqual([['어법파트 통일', '2026-11-23', true]]);
    expect(view['2026-11-25']).toEqual([]);
    const [goal] = await getWeeklyOccurrences(db, '2026-11-23');
    expect(goal.dueDate).toBe('2026-11-26');
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
    expect(await codeOf(createTask(db, admin, input({ kind: 'weekly', dueWeekday: 3 })))).toBe('invalid'); // 한 번짜리는 날짜로
  });
});
