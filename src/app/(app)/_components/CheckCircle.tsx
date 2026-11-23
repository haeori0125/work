'use client';

import type { TaskStatus } from '@/lib/tasks';
import { STATUS_LABEL } from '@/lib/view';

export const NEXT_STATUS: Record<TaskStatus, TaskStatus> = { todo: 'doing', doing: 'done', done: 'todo' };

type Props = { status: TaskStatus; title: string; size?: 'md' | 'sm'; onCycle: () => void; disabled?: boolean };

/** 누를 때마다 미완료 → 진행 중 → 완료 → 미완료 */
export function CheckCircle({ status, title, size = 'md', onCycle, disabled }: Props) {
  return (
    <button
      type="button"
      className={`check ${size === 'sm' ? 'small ' : ''}${status}`}
      aria-label={`${title}: ${STATUS_LABEL[status]}`}
      title={`${STATUS_LABEL[status]} → ${STATUS_LABEL[NEXT_STATUS[status]]}`}
      onClick={onCycle}
      disabled={disabled}
    />
  );
}
