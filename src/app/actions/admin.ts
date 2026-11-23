'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { editAttendance } from '@/lib/attendance';
import { AppError } from '@/lib/errors';
import {
  approveMember, rejectMember, resetPassword, setDisabled, setRole,
} from '@/lib/members';
import type { Kind, Repeat } from '@/lib/recurrence';
import { createTask, deleteTask, updateTask, type TaskInput } from '@/lib/tasks';
import { kstDateTime } from '@/lib/time';
import { requireActionAdmin } from '@/server/session';
import { runAction, type ActionResult } from './result';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

function parseTask(form: FormData): TaskInput {
  const kind = str(form, 'kind') as Kind;
  const repeat = str(form, kind === 'weekly' ? 'repeatWeekly' : 'repeatDated') as Repeat;
  return {
    title: str(form, 'title'),
    description: str(form, 'description') || null,
    kind,
    repeat,
    weekdays: form.getAll('weekdays').map(Number),
    startDate: str(form, 'startDate'),
    endDate: str(form, 'endDate') || null,
    assigneeIds: form.getAll('assignees').map(Number).filter(Number.isInteger),
  };
}

export async function saveTaskAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const admin = await requireActionAdmin();
    const db = await getDb();
    const id = Number(str(form, 'id'));
    const input = parseTask(form);
    if (id) await updateTask(db, id, input);
    else await createTask(db, admin.id, input);
    revalidatePath('/', 'layout');
  });
  if (result?.error) return result;
  redirect('/admin/tasks?saved=1');
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

export async function editAttendanceAction(
  id: number, date: string, clockIn: string, clockOut: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireActionAdmin();
    const inAt = kstDateTime(date, clockIn);
    if (!inAt) throw new AppError('invalid', '출근 시간을 확인하세요');
    let outAt: Date | null = null;
    if (clockOut) {
      outAt = kstDateTime(date, clockOut);
      if (!outAt) throw new AppError('invalid', '퇴근 시간을 확인하세요');
    }
    await editAttendance(await getDb(), admin.id, id, { clockIn: inAt, clockOut: outAt }, new Date());
    revalidatePath('/', 'layout');
    return '저장했습니다';
  });
}
