import { AppError } from '@/lib/errors';
import type { Kind, Repeat } from '@/lib/recurrence';
import type { PartInput, TaskInput } from '@/lib/tasks';

/** 업무 추가 폼(관리자 추가 · 멤버 요청 공용)을 읽는다 */
export const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export function parseTask(form: FormData): TaskInput {
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
    dueWeekday: kind === 'weekly' && repeat === 'weekly' && str(form, 'dueWeekday') !== '' ? Number(str(form, 'dueWeekday')) : null,
    dueDate: kind === 'weekly' && repeat === 'none' ? str(form, 'dueDate') || null : null,
    parts: parseParts(str(form, 'parts')),
  };
}

/** 폼의 숨은 칸에 담긴 파트 목록(JSON)을 검사해서 꺼낸다 */
export function parseParts(raw: string): PartInput[] {
  if (!raw) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new AppError('invalid', '파트 정보를 읽지 못했습니다'); }
  if (!Array.isArray(data)) throw new AppError('invalid', '파트 정보를 읽지 못했습니다');
  return data.map((p) => ({
    id: Number.isInteger(p?.id) ? p.id : undefined,
    title: typeof p?.title === 'string' ? p.title : '',
    assigneeId: Number.isInteger(p?.assigneeId) ? p.assigneeId : null,
  }));
}

