'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { deleteSegment, editSegment, getSegmentDate } from '@/lib/attendance';
import { AppError } from '@/lib/errors';
import {
  approveMember, listActiveMembers, rejectMember, resetPassword, setDisabled, setRole,
} from '@/lib/members';
import { approveRequest, getPendingRequest } from '@/lib/requests';
import { createTask, deleteTask, listTaskDefinitions, updateTask, type TaskDefinition } from '@/lib/tasks';
import { parseTask } from './task-form';
import { kstDate, kstDateTime } from '@/lib/time';
import { requireActionAdmin } from '@/server/session';
import { runAction, type ActionResult } from './result';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function saveTaskAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const admin = await requireActionAdmin();
    const db = await getDb();
    const id = Number(str(form, 'id'));
    const input = parseTask(form);
    const requestId = Number(str(form, 'requestId'));
    if (id) await updateTask(db, id, input);
    else {
      if (requestId) await getPendingRequest(db, requestId); // 이미 처리된 요청이면 업무를 만들지 않는다
      const taskId = await createTask(db, admin.id, input);
      if (requestId) await approveRequest(db, requestId, admin.id, taskId, new Date());
    }
    revalidatePath('/', 'layout');
    return id ? 'edit' : requestId ? 'approved' : 'new';
  });
  if (result?.error) return result;
  // 업무 팝업에서 고칠 때는 그 자리에 머문다
  if (str(form, 'stay')) return { ok: '저장되었습니다' };
  redirect(`/admin/tasks?saved=${result?.ok ?? 'new'}`);
}

/** 업무 팝업에서 바로 고치기: 그 업무의 내용과 고를 수 있는 사람들 */
export async function loadTaskForEditAction(id: number): Promise<{ task: TaskDefinition; members: { id: number; name: string }[]; today: string } | { error: string }> {
  try {
    await requireActionAdmin();
    const db = await getDb();
    const [defs, members] = await Promise.all([listTaskDefinitions(db), listActiveMembers(db)]);
    const task = defs.find((d) => d.id === id);
    if (!task) return { error: '업무를 찾을 수 없습니다' };
    return { task, members: members.map((m) => ({ id: m.id, name: m.name })), today: kstDate(new Date()) };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}

export async function deleteTaskAction(id: number): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionAdmin();
    await deleteTask(await getDb(), id, new Date());
    revalidatePath('/', 'layout');
  });
}

async function memberAction(fn: (adminId: number) => Promise<void>): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireActionAdmin();
    await fn(admin.id);
    revalidatePath('/admin/members');
  });
}

export const approveAction = async (id: number) => memberAction(async () => approveMember(await getDb(), id));
export const rejectAction = async (id: number) => memberAction(async () => rejectMember(await getDb(), id));
export const setRoleAction = async (id: number, role: 'member' | 'admin') =>
  memberAction(async (adminId) => setRole(await getDb(), adminId, id, role));
export const setDisabledAction = async (id: number, disabled: boolean) =>
  memberAction(async (adminId) => setDisabled(await getDb(), adminId, id, disabled));
export const resetPasswordAction = async (id: number, password: string) =>
  memberAction(async () => resetPassword(await getDb(), id, password));

export async function deleteSegmentAction(id: number): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionAdmin();
    await deleteSegment(await getDb(), id);
    revalidatePath('/', 'layout');
  });
}

export async function editSegmentAction(id: number, clockIn: string, clockOut: string): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireActionAdmin();
    const db = await getDb();
    const date = await getSegmentDate(db, id);
    const inAt = kstDateTime(date, clockIn);
    if (!inAt) throw new AppError('invalid', '출근 시간을 확인하세요');
    let outAt: Date | null = null;
    if (clockOut) {
      outAt = kstDateTime(date, clockOut);
      if (!outAt) throw new AppError('invalid', '퇴근 시간을 확인하세요');
    }
    await editSegment(db, admin.id, id, { clockIn: inAt, clockOut: outAt }, new Date());
    revalidatePath('/', 'layout');
    return '저장했습니다';
  });
}
