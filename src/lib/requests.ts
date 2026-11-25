import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { taskRequests, tasks, users } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppError } from './errors';
import { cleanTaskInput, type TaskInput } from './tasks';

export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type TaskRequest = {
  id: number;
  requesterId: number;
  requesterName: string;
  title: string;
  description: string | null;
  wantedDate: string | null;
  status: RequestStatus;
  createdAt: Date;
  /** 멤버가 정한 업무 설정 전체 */
  spec: TaskInput | null;
  /** 고쳐 달라는 요청이면 그 업무 id */
  editOf: number | null;
};
function parseSpec(raw: string | null): TaskInput | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as TaskInput; } catch { return null; }
}

const columns = {
  id: taskRequests.id, requesterId: taskRequests.requesterId, requesterName: users.name, title: taskRequests.title,
  description: taskRequests.description, wantedDate: taskRequests.wantedDate, status: taskRequests.status, createdAt: taskRequests.createdAt, spec: taskRequests.spec,
  editOf: taskRequests.editOf,
};
const withSpec = <T extends { spec: string | null }>(r: T) => ({ ...r, spec: parseSpec(r.spec) });

/**
 * 업무 추가와 같은 규칙으로 검사해서 요청으로 저장한다.
 * editOf가 있으면 그 업무를 고쳐 달라는 요청(파트 id를 남겨 둬야 기존 파트가 고쳐진다), 없으면 새 업무라 파트 id는 버린다.
 */
export async function createRequest(db: Db, userId: number, input: TaskInput, now: Date, editOf: number | null = null): Promise<number> {
  const parts = editOf ? (input.parts ?? []) : (input.parts ?? []).map(({ title, assigneeId }) => ({ title, assigneeId }));
  const spec = cleanTaskInput({ ...input, parts });
  if (editOf) {
    const [t] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, editOf), isNull(tasks.deletedAt)));
    if (!t) throw new AppError('not_found', '업무를 찾을 수 없습니다');
  }
  const [row] = await db.insert(taskRequests).values({
    requesterId: userId, title: spec.title, description: spec.description, wantedDate: spec.startDate,
    spec: JSON.stringify(spec), createdAt: now, editOf,
  }).returning({ id: taskRequests.id });
  return row.id;
}

/** 관리자용: 아직 처리 안 된 요청, 먼저 온 순서 */
export async function listPendingRequests(db: Db): Promise<TaskRequest[]> {
  const rows = await db.select(columns).from(taskRequests).innerJoin(users, eq(users.id, taskRequests.requesterId))
    .where(eq(taskRequests.status, 'pending')).orderBy(asc(taskRequests.createdAt), asc(taskRequests.id));
  return rows.map(withSpec);
}

/** 멤버용: 내가 올린 요청, 최근 순 */
export async function listMyRequests(db: Db, userId: number, limit = 10): Promise<TaskRequest[]> {
  const rows = await db.select(columns).from(taskRequests).innerJoin(users, eq(users.id, taskRequests.requesterId))
    .where(eq(taskRequests.requesterId, userId)).orderBy(desc(taskRequests.createdAt), desc(taskRequests.id)).limit(limit);
  return rows.map(withSpec);
}

export async function getPendingRequest(db: Db, id: number): Promise<TaskRequest> {
  const [row] = await db.select(columns).from(taskRequests).innerJoin(users, eq(users.id, taskRequests.requesterId))
    .where(eq(taskRequests.id, id));
  if (!row) throw new AppError('not_found', '요청을 찾을 수 없습니다');
  if (row.status !== 'pending') throw new AppError('conflict', '이미 처리된 요청입니다');
  return withSpec(row);
}

async function decide(db: Db, id: number, adminId: number, status: 'approved' | 'rejected', now: Date, taskId: number | null) {
  const done = await db.update(taskRequests).set({ status, decidedBy: adminId, decidedAt: now, taskId })
    .where(and(eq(taskRequests.id, id), eq(taskRequests.status, 'pending'))).returning({ id: taskRequests.id });
  if (!done.length) {
    await getPendingRequest(db, id); // 없는 요청이면 not_found, 처리된 요청이면 conflict
    throw new AppError('conflict', '이미 처리된 요청입니다');
  }
}

export const approveRequest = (db: Db, id: number, adminId: number, taskId: number, now: Date) => decide(db, id, adminId, 'approved', now, taskId);
export const rejectRequest = (db: Db, id: number, adminId: number, now: Date) => decide(db, id, adminId, 'rejected', now, null);

/** 요청한 사람이 아직 처리 안 된 요청을 취소한다 */
export async function cancelRequest(db: Db, userId: number, id: number): Promise<void> {
  const req = await getPendingRequest(db, id);
  if (req.requesterId !== userId) throw new AppError('forbidden', '내가 올린 요청만 취소할 수 있습니다');
  await db.delete(taskRequests).where(and(eq(taskRequests.id, id), eq(taskRequests.status, 'pending')));
}
