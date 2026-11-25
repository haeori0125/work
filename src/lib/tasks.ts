import { and, asc, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  partStatus, taskAssignees, taskComments, taskParts, taskStatus, taskStatusHistory, tasks, users,
} from '@/db/schema';
import type { Db } from '@/db/types';
import { AppError } from './errors';
import {
  occursInWeek, occursOn, validateRecurrence, type Kind, type RecurrenceSpec, type Repeat,
} from './recurrence';
import { addDays, weekDates, weekStartOf } from './time';

export type TaskStatus = 'todo' | 'doing' | 'done';

export type PartInput = { id?: number; title: string; assigneeId: number | null };

export type TaskInput = RecurrenceSpec & {
  title: string;
  description: string | null;
  assigneeIds: number[];
  /** 한 번만 하는 주간 업무의 정확한 마감일. 시작일~마감일 동안 위클리에 보인다 */
  dueDate?: string | null;
  /** 나눠 맡기는 파트. 있으면 업무 상태는 파트에서 자동으로 정해진다 */
  parts?: PartInput[];
};

export type TaskDefinition = TaskInput & { id: number; dueDate: string | null; parts: (PartInput & { id: number })[] };

export type LastChange = { userId: number; userName: string; at: Date };

export type PartOccurrence = {
  id: number;
  title: string;
  assignee: { id: number; name: string } | null;
  status: TaskStatus;
  lastChange: LastChange | null;
};

export type Occurrence = {
  taskId: number;
  occurrenceKey: string;
  title: string;
  description: string | null;
  kind: Kind;
  repeat: Repeat;
  assignees: { id: number; name: string }[];
  status: TaskStatus;
  lastChange: LastChange | null;
  commentCount: number;
  parts: PartOccurrence[];
  /** 주간 업무 마감일 (YYYY-MM-DD), 없으면 null */
  dueDate: string | null;
  /** 업무 시작일 */
  startDate: string;
  /** 위클리에서 마감 요일 칸에 나온 항목 */
  dueHere?: boolean;
};

const MAX_PARTS = 20;

type TaskRow = typeof tasks.$inferSelect;

/** 업무 입력값을 다듬고 검사한다(업무 추가 요청도 같은 규칙) */
export function cleanTaskInput(input: TaskInput): TaskInput {
  const title = input.title.trim();
  if (!title) throw new AppError('invalid', '제목을 입력하세요');
  if (title.length > 100) throw new AppError('invalid', '제목은 100자 이하로 입력하세요');
  // 예전 요청에 남아 있을 수 있는, 없앤 항목(마감 요일)은 버린다
  const rest: TaskInput & { dueWeekday?: unknown } = { ...input };
  delete rest.dueWeekday;
  const spec: TaskInput = {
    ...rest,
    title,
    description: input.description?.trim() || null,
    weekdays: input.repeat === 'weekly_days' ? [...new Set(input.weekdays)].sort() : [],
    endDate: input.repeat === 'none' ? null : input.endDate || null,
    assigneeIds: [...new Set(input.assigneeIds)],
    dueDate: input.dueDate || null,
    parts: (input.parts ?? []).map((p) => ({ ...p, title: p.title.trim() })),
  };
  const err = validateRecurrence(spec);
  if (err) throw new AppError('invalid', err);
  if (spec.dueDate !== null) {
    if (spec.kind !== 'weekly' || spec.repeat !== 'none') throw new AppError('invalid', '마감일은 한 번만 하는 기간 업무에만 정할 수 있습니다');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spec.dueDate!)) throw new AppError('invalid', '마감일이 올바르지 않습니다');
    if (spec.dueDate! < spec.startDate) throw new AppError('invalid', '마감일이 시작일보다 빠릅니다');
  }
  if (spec.parts!.length > MAX_PARTS) throw new AppError('invalid', `파트는 ${MAX_PARTS}개까지 만들 수 있습니다`);
  if (spec.parts!.some((p) => !p.title)) throw new AppError('invalid', '파트 이름을 입력하세요');
  if (spec.parts!.some((p) => p.title.length > 100)) throw new AppError('invalid', '파트 이름은 100자 이하로 입력하세요');
  return spec;
}

/** 파트를 저장한다. id가 있는 파트는 그대로 두고(체크 기록 유지) 이름·담당만 바꾸고, 빠진 파트는 지운다. */
async function setParts(db: Db, taskId: number, parts: PartInput[]) {
  const existing = await db.select({ id: taskParts.id }).from(taskParts).where(eq(taskParts.taskId, taskId));
  const keep = new Set(parts.filter((p) => p.id).map((p) => p.id!));
  const gone = existing.map((e) => e.id).filter((id) => !keep.has(id));
  if (gone.length) await db.delete(taskParts).where(inArray(taskParts.id, gone));
  for (const [i, p] of parts.entries()) {
    if (p.id && existing.some((e) => e.id === p.id)) {
      await db.update(taskParts).set({ title: p.title, assigneeId: p.assigneeId, sort: i }).where(eq(taskParts.id, p.id));
    } else {
      await db.insert(taskParts).values({ taskId, title: p.title, assigneeId: p.assigneeId, sort: i });
    }
  }
}

function columns(spec: TaskInput) {
  return {
    title: spec.title, description: spec.description, kind: spec.kind, repeat: spec.repeat,
    weekdays: spec.weekdays, startDate: spec.startDate, endDate: spec.endDate, dueDate: spec.dueDate ?? null,
  };
}

async function setAssignees(db: Db, taskId: number, ids: number[]) {
  await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
  if (ids.length) await db.insert(taskAssignees).values(ids.map((userId) => ({ taskId, userId })));
}

export async function createTask(db: Db, actorId: number, input: TaskInput): Promise<number> {
  const spec = cleanTaskInput(input);
  const [row] = await db.insert(tasks).values({ ...columns(spec), createdBy: actorId }).returning({ id: tasks.id });
  await setAssignees(db, row.id, spec.assigneeIds);
  await setParts(db, row.id, spec.parts ?? []);
  return row.id;
}

export async function updateTask(db: Db, id: number, input: TaskInput): Promise<void> {
  const spec = cleanTaskInput(input);
  const updated = await db.update(tasks).set(columns(spec))
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).returning({ id: tasks.id });
  if (!updated.length) throw new AppError('not_found', '업무를 찾을 수 없습니다');
  await setAssignees(db, id, spec.assigneeIds);
  await setParts(db, id, spec.parts ?? []);
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
  const ids = rows.map((r) => r.id);
  const [assigned, parts] = await Promise.all([
    db.select().from(taskAssignees).where(inArray(taskAssignees.taskId, ids)),
    db.select().from(taskParts).where(inArray(taskParts.taskId, ids)).orderBy(asc(taskParts.sort), asc(taskParts.id)),
  ]);
  return rows.map((r) => ({
    id: r.id, title: r.title, description: r.description, kind: r.kind, repeat: r.repeat,
    weekdays: r.weekdays, startDate: r.startDate, endDate: r.endDate, dueDate: r.dueDate,
    assigneeIds: assigned.filter((x) => x.taskId === r.id).map((x) => x.userId).sort((p, q) => p - q),
    parts: parts.filter((p) => p.taskId === r.id).map((p) => ({ id: p.id, title: p.title, assigneeId: p.assigneeId })),
  }));
}

function deriveStatus(parts: { status: TaskStatus }[]): TaskStatus {
  if (parts.every((p) => p.status === 'done')) return 'done';
  return parts.some((p) => p.status !== 'todo') ? 'doing' : 'todo';
}

async function buildOccurrences(db: Db, items: { task: TaskRow; key: string; dueHere?: boolean }[]): Promise<Occurrence[]> {
  if (!items.length) return [];
  const taskIds = [...new Set(items.map((i) => i.task.id))];
  const keys = [...new Set(items.map((i) => i.key))];
  const parts = await db.select({
    id: taskParts.id, taskId: taskParts.taskId, title: taskParts.title,
    assigneeId: taskParts.assigneeId, assigneeName: users.name,
  }).from(taskParts).leftJoin(users, eq(users.id, taskParts.assigneeId))
    .where(inArray(taskParts.taskId, taskIds)).orderBy(asc(taskParts.sort), asc(taskParts.id));
  const partStatuses = parts.length ? await db.select({
    partId: partStatus.partId, key: partStatus.occurrenceKey, status: partStatus.status,
    userId: users.id, userName: users.name, at: partStatus.updatedAt,
  }).from(partStatus).innerJoin(users, eq(users.id, partStatus.updatedBy))
    .where(and(inArray(partStatus.partId, parts.map((p) => p.id)), inArray(partStatus.occurrenceKey, keys))) : [];
  const [assigned, statuses, comments] = await Promise.all([
    db.select({ taskId: taskAssignees.taskId, id: users.id, name: users.name })
      .from(taskAssignees).innerJoin(users, eq(users.id, taskAssignees.userId))
      .where(inArray(taskAssignees.taskId, taskIds)).orderBy(asc(users.name)),
    db.select({
      taskId: taskStatus.taskId, key: taskStatus.occurrenceKey, status: taskStatus.status,
      userId: users.id, userName: users.name, at: taskStatus.updatedAt,
    }).from(taskStatus).innerJoin(users, eq(users.id, taskStatus.updatedBy))
      .where(and(inArray(taskStatus.taskId, taskIds), inArray(taskStatus.occurrenceKey, keys))),
    db.select({ taskId: taskComments.taskId, key: taskComments.occurrenceKey, n: count() })
      .from(taskComments)
      .where(and(inArray(taskComments.taskId, taskIds), inArray(taskComments.occurrenceKey, keys)))
      .groupBy(taskComments.taskId, taskComments.occurrenceKey),
  ]);
  return items.map(({ task, key, dueHere }) => {
    const st = statuses.find((s) => s.taskId === task.id && s.key === key);
    const myParts: PartOccurrence[] = parts.filter((p) => p.taskId === task.id).map((p) => {
      const ps = partStatuses.find((x) => x.partId === p.id && x.key === key);
      return {
        id: p.id, title: p.title,
        assignee: p.assigneeId && p.assigneeName ? { id: p.assigneeId, name: p.assigneeName } : null,
        status: ps?.status ?? 'todo',
        lastChange: ps ? { userId: ps.userId, userName: ps.userName, at: ps.at } : null,
      };
    });
    const assignees = assigned.filter((x) => x.taskId === task.id).map(({ id, name }) => ({ id, name }));
    for (const p of myParts) if (p.assignee && !assignees.some((x) => x.id === p.assignee!.id)) assignees.push(p.assignee);
    const latestPart = myParts.map((p) => p.lastChange).filter((c): c is LastChange => !!c)
      .sort((x, y) => y.at.getTime() - x.at.getTime())[0] ?? null;
    return {
      taskId: task.id,
      occurrenceKey: key,
      title: task.title,
      description: task.description,
      kind: task.kind,
      repeat: task.repeat,
      assignees: assignees.sort((x, y) => x.name.localeCompare(y.name, 'ko')),
      status: myParts.length ? deriveStatus(myParts) : st?.status ?? 'todo',
      lastChange: myParts.length ? latestPart : st ? { userId: st.userId, userName: st.userName, at: st.at } : null,
      commentCount: comments.find((c) => c.taskId === task.id && c.key === key)?.n ?? 0,
      parts: myParts,
      dueDate: task.kind === 'weekly' && task.repeat === 'none' ? task.dueDate : null,
      startDate: task.startDate,
      ...(dueHere ? { dueHere: true } : {}),
    };
  });
}

/** 주간 업무가 이 주(월요일 기준)에 보이는가. 한 번짜리는 시작일~마감일이 걸친 모든 주 */
function weeklyActive(task: TaskRow, weekStart: string): boolean {
  if (task.kind !== 'weekly') return false;
  if (task.repeat === 'none' && task.dueDate) {
    return weekStart >= weekStartOf(task.startDate) && weekStart <= weekStartOf(task.dueDate);
  }
  return occursInWeek(task, weekStart);
}

/** 주간 업무의 회차 키: 한 번짜리는 시작 주 월요일 하나, 반복은 그 주 월요일 */
function weeklyKey(task: TaskRow, weekStart: string): string {
  return task.repeat === 'none' ? weekStartOf(task.startDate) : weekStart;
}

/** 한 번만 하는 업무의 지금 상태(관리 화면 목록용). 반복 업무는 회차마다 달라서 빠진다 */
export async function getOneOffStatuses(db: Db): Promise<Map<number, TaskStatus>> {
  const once = (await liveTasks(db)).filter((t) => t.repeat === 'none');
  const built = await buildOccurrences(db, once.map((task) => ({ task, key: task.kind === 'dated' ? task.startDate : weeklyKey(task, task.startDate) })));
  return new Map(built.map((o) => [o.taskId, o.status]));
}

function sortOpenFirst(list: Occurrence[]): Occurrence[] {
  const rank = (o: Occurrence) => (o.status === 'done' ? 1 : 0);
  return [...list].sort((x, y) => rank(x) - rank(y) || x.title.localeCompare(y.title, 'ko'));
}

export async function getDayOccurrences(db: Db, date: string): Promise<Occurrence[]> {
  const rows = (await liveTasks(db)).filter((t) => occursOn(t, date));
  return sortOpenFirst(await buildOccurrences(db, rows.map((task) => ({ task, key: date }))));
}

/** 오늘 할 일: 그날 업무 + 마감일이 그날인 기간 업무(위클리의 그날 칸과 같다) */
export async function getTodayOccurrences(db: Db, date: string): Promise<Occurrence[]> {
  const all = await liveTasks(db);
  const items = [
    ...all.filter((t) => occursOn(t, date)).map((task) => ({ task, key: date })),
    ...all.filter((t) => t.kind === 'weekly' && t.repeat === 'none' && t.dueDate === date)
      .map((task) => ({ task, key: weeklyKey(task, weekStartOf(date)), dueHere: true })),
  ];
  return sortOpenFirst(await buildOccurrences(db, items));
}

export async function getWeeklyOccurrences(db: Db, weekStart: string): Promise<Occurrence[]> {
  const rows = (await liveTasks(db)).filter((t) => weeklyActive(t, weekStart));
  return sortOpenFirst(await buildOccurrences(db, rows.map((task) => ({ task, key: weeklyKey(task, weekStart) }))));
}

export async function getWeekView(db: Db, weekStart: string): Promise<Record<string, Occurrence[]>> {
  const all = await liveTasks(db);
  const days = weekDates(weekStart);
  const items = days.flatMap((date) => [
    ...all.filter((t) => occursOn(t, date)).map((task) => ({ task, key: date })),
    // 마감일이 이 날인 한 번짜리 주간 업무
    ...all.filter((t) => t.kind === 'weekly' && t.repeat === 'none' && t.dueDate === date)
      .map((task) => ({ task, key: weeklyKey(task, weekStartOf(date)), dueHere: true })),
  ]);
  const built = await buildOccurrences(db, items);
  return Object.fromEntries(days.map((d) => [d, sortOpenFirst(built.filter((o) =>
    (o.dueHere ? o.dueDate === d : o.occurrenceKey === d && o.kind === 'dated')))]));
}

/** 반복 업무는 이 기간(일) 안에 못 한 것만 지난 업무로(오래된 것까지 쌓이지 않게) */
export const PAST_REPEAT_DAYS = 7;

export async function getPastOccurrences(db: Db, today: string): Promise<Occurrence[]> {
  const thisWeek = weekStartOf(today);
  const lastWeek = addDays(thisWeek, -7);
  const recent = Array.from({ length: PAST_REPEAT_DAYS }, (_, i) => addDays(today, -(PAST_REPEAT_DAYS - i)));
  const rows = await liveTasks(db);
  const items = rows.flatMap((task) => {
    if (task.repeat === 'none') {
      const key = task.kind === 'dated' ? task.startDate : weekStartOf(task.startDate);
      // 날짜 업무는 그날이 지나면, 기간 업무는 마감일이 지나면(마감일이 없으면 그 주가 지나면) 지난 업무
      const isPast = task.kind === 'dated' ? key < today
        : task.dueDate ? task.dueDate < today : weekStartOf(task.startDate) < thisWeek;
      return isPast ? [{ task, key }] : [];
    }
    // 반복 업무: 날짜 업무는 최근 며칠 중 있던 날, 기간 업무(매주)는 지난주
    if (task.kind === 'dated') return recent.filter((d) => occursOn(task, d)).map((d) => ({ task, key: d }));
    return occursInWeek(task, lastWeek) ? [{ task, key: lastWeek }] : [];
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
  const [hasPart] = await db.select({ id: taskParts.id }).from(taskParts).where(eq(taskParts.taskId, taskId)).limit(1);
  if (hasPart) throw new AppError('has_parts', '파트가 있는 업무는 파트에서 체크하세요');
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

/** 업무를 등록한 사람(요청자)과 등록 시각. 수정해도 바뀌지 않는다. */
export async function getTaskOrigin(db: Db, taskId: number): Promise<{ creatorName: string; createdAt: Date } | null> {
  const [row] = await db.select({ creatorName: users.name, createdAt: tasks.createdAt })
    .from(tasks).innerJoin(users, eq(users.id, tasks.createdBy)).where(eq(tasks.id, taskId));
  return row ?? null;
}

/** 파트 하나의 상태를 바꾼다. 누구나 체크할 수 있고, 누가 바꿨는지 남는다. */
export async function setPartStatus(
  db: Db, actorId: number, partId: number, occurrenceKey: string, status: TaskStatus, now: Date,
): Promise<void> {
  const [part] = await db.select({ taskId: taskParts.taskId }).from(taskParts).where(eq(taskParts.id, partId));
  if (!part) throw new AppError('not_found', '파트를 찾을 수 없습니다');
  await assertOccurrence(db, part.taskId, occurrenceKey);
  await db.insert(partStatus).values({ partId, occurrenceKey, status, updatedBy: actorId, updatedAt: now })
    .onConflictDoUpdate({ target: [partStatus.partId, partStatus.occurrenceKey], set: { status, updatedBy: actorId, updatedAt: now } });
}

/** 파트 순서를 바꾼다. ids는 그 업무의 파트 전부를 원하는 순서로 */
export async function reorderParts(db: Db, taskId: number, ids: number[]): Promise<void> {
  const rows = await db.select({ id: taskParts.id }).from(taskParts).where(eq(taskParts.taskId, taskId));
  const have = new Set(rows.map((r) => r.id));
  if (ids.length !== have.size || new Set(ids).size !== ids.length || ids.some((id) => !have.has(id))) {
    throw new AppError('invalid', '파트 목록이 바뀌었어요. 새로고침한 뒤 다시 해 주세요');
  }
  for (const [i, id] of ids.entries()) await db.update(taskParts).set({ sort: i }).where(eq(taskParts.id, id));
}
