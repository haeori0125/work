import { and, asc, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  taskAssignees, taskComments, taskStatus, taskStatusHistory, tasks, users,
} from '@/db/schema';
import type { Db } from '@/db/types';
import { AppError } from './errors';
import {
  occursInWeek, occursOn, validateRecurrence, type Kind, type RecurrenceSpec, type Repeat,
} from './recurrence';
import { weekDates, weekStartOf } from './time';

export type TaskStatus = 'todo' | 'doing' | 'done';

export type TaskInput = RecurrenceSpec & {
  title: string;
  description: string | null;
  assigneeIds: number[];
};

export type TaskDefinition = TaskInput & { id: number };

export type Occurrence = {
  taskId: number;
  occurrenceKey: string;
  title: string;
  description: string | null;
  kind: Kind;
  repeat: Repeat;
  assignees: { id: number; name: string }[];
  status: TaskStatus;
  lastChange: { userName: string; at: Date } | null;
  commentCount: number;
};

type TaskRow = typeof tasks.$inferSelect;

function clean(input: TaskInput): TaskInput {
  const title = input.title.trim();
  if (!title) throw new AppError('invalid', '제목을 입력하세요');
  if (title.length > 100) throw new AppError('invalid', '제목은 100자 이하로 입력하세요');
  const spec: TaskInput = {
    ...input,
    title,
    description: input.description?.trim() || null,
    weekdays: input.repeat === 'weekly_days' ? [...new Set(input.weekdays)].sort() : [],
    endDate: input.repeat === 'none' ? null : input.endDate || null,
    assigneeIds: [...new Set(input.assigneeIds)],
  };
  const err = validateRecurrence(spec);
  if (err) throw new AppError('invalid', err);
  return spec;
}

function columns(spec: TaskInput) {
  return {
    title: spec.title, description: spec.description, kind: spec.kind, repeat: spec.repeat,
    weekdays: spec.weekdays, startDate: spec.startDate, endDate: spec.endDate,
  };
}

async function setAssignees(db: Db, taskId: number, ids: number[]) {
  await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
  if (ids.length) await db.insert(taskAssignees).values(ids.map((userId) => ({ taskId, userId })));
}

export async function createTask(db: Db, actorId: number, input: TaskInput): Promise<number> {
  const spec = clean(input);
  const [row] = await db.insert(tasks).values({ ...columns(spec), createdBy: actorId }).returning({ id: tasks.id });
  await setAssignees(db, row.id, spec.assigneeIds);
  return row.id;
}

export async function updateTask(db: Db, id: number, input: TaskInput): Promise<void> {
  const spec = clean(input);
  const updated = await db.update(tasks).set(columns(spec))
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).returning({ id: tasks.id });
  if (!updated.length) throw new AppError('not_found', '업무를 찾을 수 없습니다');
  await setAssignees(db, id, spec.assigneeIds);
}

export async function deleteTask(db: Db, id: number, now: Date): Promise<void> {
  await db.update(tasks).set({ deletedAt: now }).where(eq(tasks.id, id));
}

function liveTasks(db: Db): Promise<TaskRow[]> {
  return db.select().from(tasks).where(isNull(tasks.deletedAt)).orderBy(asc(tasks.title));
}

export async function listTaskDefinitions(db: Db): Promise<TaskDefinition[]> {
  const rows = await liveTasks(db);
  if (!rows.length) return [];
  const assigned = await db.select().from(taskAssignees)
    .where(inArray(taskAssignees.taskId, rows.map((r) => r.id)));
  return rows.map((r) => ({
    id: r.id, title: r.title, description: r.description, kind: r.kind, repeat: r.repeat,
    weekdays: r.weekdays, startDate: r.startDate, endDate: r.endDate,
    assigneeIds: assigned.filter((x) => x.taskId === r.id).map((x) => x.userId).sort((p, q) => p - q),
  }));
}

async function buildOccurrences(db: Db, items: { task: TaskRow; key: string }[]): Promise<Occurrence[]> {
  if (!items.length) return [];
  const taskIds = [...new Set(items.map((i) => i.task.id))];
  const keys = [...new Set(items.map((i) => i.key))];
  const [assigned, statuses, comments] = await Promise.all([
    db.select({ taskId: taskAssignees.taskId, id: users.id, name: users.name })
      .from(taskAssignees).innerJoin(users, eq(users.id, taskAssignees.userId))
      .where(inArray(taskAssignees.taskId, taskIds)).orderBy(asc(users.name)),
    db.select({
      taskId: taskStatus.taskId, key: taskStatus.occurrenceKey, status: taskStatus.status,
      userName: users.name, at: taskStatus.updatedAt,
    }).from(taskStatus).innerJoin(users, eq(users.id, taskStatus.updatedBy))
      .where(and(inArray(taskStatus.taskId, taskIds), inArray(taskStatus.occurrenceKey, keys))),
    db.select({ taskId: taskComments.taskId, key: taskComments.occurrenceKey, n: count() })
      .from(taskComments)
      .where(and(inArray(taskComments.taskId, taskIds), inArray(taskComments.occurrenceKey, keys)))
      .groupBy(taskComments.taskId, taskComments.occurrenceKey),
  ]);
  return items.map(({ task, key }) => {
    const st = statuses.find((s) => s.taskId === task.id && s.key === key);
    return {
      taskId: task.id,
      occurrenceKey: key,
      title: task.title,
      description: task.description,
      kind: task.kind,
      repeat: task.repeat,
      assignees: assigned.filter((x) => x.taskId === task.id).map(({ id, name }) => ({ id, name })),
      status: st?.status ?? 'todo',
      lastChange: st ? { userName: st.userName, at: st.at } : null,
      commentCount: comments.find((c) => c.taskId === task.id && c.key === key)?.n ?? 0,
    };
  });
}

function sortOpenFirst(list: Occurrence[]): Occurrence[] {
  const rank = (o: Occurrence) => (o.status === 'done' ? 1 : 0);
  return [...list].sort((x, y) => rank(x) - rank(y) || x.title.localeCompare(y.title, 'ko'));
}

export async function getDayOccurrences(db: Db, date: string): Promise<Occurrence[]> {
  const rows = (await liveTasks(db)).filter((t) => occursOn(t, date));
  return sortOpenFirst(await buildOccurrences(db, rows.map((task) => ({ task, key: date }))));
}

export async function getWeeklyOccurrences(db: Db, weekStart: string): Promise<Occurrence[]> {
  const rows = (await liveTasks(db)).filter((t) => occursInWeek(t, weekStart));
  return sortOpenFirst(await buildOccurrences(db, rows.map((task) => ({ task, key: weekStart }))));
}

export async function getWeekView(db: Db, weekStart: string): Promise<Record<string, Occurrence[]>> {
  const all = await liveTasks(db);
  const days = weekDates(weekStart);
  const items = days.flatMap((date) => all.filter((t) => occursOn(t, date)).map((task) => ({ task, key: date })));
  const built = await buildOccurrences(db, items);
  return Object.fromEntries(days.map((d) => [d, sortOpenFirst(built.filter((o) => o.occurrenceKey === d))]));
}

export async function getPastOccurrences(db: Db, today: string): Promise<Occurrence[]> {
  const thisWeek = weekStartOf(today);
  const rows = await db.select().from(tasks).where(and(
    isNull(tasks.deletedAt),
    eq(tasks.repeat, 'none'),
    or(eq(tasks.kind, 'dated'), eq(tasks.kind, 'weekly')),
  ));
  const items = rows.flatMap((task) => {
    const key = task.kind === 'dated' ? task.startDate : weekStartOf(task.startDate);
    const isPast = task.kind === 'dated' ? key < today : key < thisWeek;
    return isPast ? [{ task, key }] : [];
  });
  const built = await buildOccurrences(db, items);
  return built
    .filter((o) => o.status !== 'done')
    .sort((x, y) => x.occurrenceKey.localeCompare(y.occurrenceKey) || x.title.localeCompare(y.title, 'ko'));
}

function occursAt(task: TaskRow, key: string): boolean {
  return task.kind === 'dated' ? occursOn(task, key) : weekStartOf(key) === key && occursInWeek(task, key);
}

/** 삭제되지 않은 업무가 그 날짜(주간 업무는 그 주 월요일)에 실제로 있는지 확인한다. */
export async function assertOccurrence(db: Db, taskId: number, occurrenceKey: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)));
  if (!task || !/^\d{4}-\d{2}-\d{2}$/.test(occurrenceKey) || !occursAt(task, occurrenceKey)) {
    throw new AppError('no_occurrence', '해당 날짜의 업무가 없습니다');
  }
}

export async function setStatus(
  db: Db, actorId: number, taskId: number, occurrenceKey: string, status: TaskStatus, now: Date,
): Promise<void> {
  await assertOccurrence(db, taskId, occurrenceKey);
  await db.transaction(async (tx) => {
    const [cur] = await tx.select({ status: taskStatus.status }).from(taskStatus)
      .where(and(eq(taskStatus.taskId, taskId), eq(taskStatus.occurrenceKey, occurrenceKey)))
      .for('update');
    const from: TaskStatus = cur?.status ?? 'todo';
    if (from === status) return;
    await tx.insert(taskStatus)
      .values({ taskId, occurrenceKey, status, updatedBy: actorId, updatedAt: now })
      .onConflictDoUpdate({
        target: [taskStatus.taskId, taskStatus.occurrenceKey],
        set: { status, updatedBy: actorId, updatedAt: now },
      });
    await tx.insert(taskStatusHistory).values({
      taskId, occurrenceKey, fromStatus: from, toStatus: status, changedBy: actorId, at: now,
    });
  });
}

export async function getStatusHistory(
  db: Db, taskId: number, occurrenceKey: string,
): Promise<{ userName: string; from: TaskStatus; to: TaskStatus; at: Date }[]> {
  return db.select({
    userName: users.name, from: taskStatusHistory.fromStatus, to: taskStatusHistory.toStatus, at: taskStatusHistory.at,
  }).from(taskStatusHistory).innerJoin(users, eq(users.id, taskStatusHistory.changedBy))
    .where(and(eq(taskStatusHistory.taskId, taskId), eq(taskStatusHistory.occurrenceKey, occurrenceKey)))
    .orderBy(desc(taskStatusHistory.at), desc(taskStatusHistory.id));
}
