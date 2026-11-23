'use client';

import { MiniAvatar } from '@/app/_ui/AvatarContext';
import { StatusMark } from '@/app/_ui/icons';
import type { TaskStatus } from '@/lib/tasks';
import { STATUS_LABEL } from '@/lib/view';

/** 담당 태그: "담당" + 사람마다 작은 사진과 이름 */
export function AssigneeTag({ names, compact = false }: { names: string[]; compact?: boolean }) {
  if (!names.length) return null;
  // 좁은 칸(위클리)에서는 사진만 겹쳐 보여 주고 이름은 마우스를 올렸을 때
  if (compact) {
    return (
      <span className="tag line who-tag compact" title={`담당 ${names.join(', ')}`} aria-label={`담당 ${names.join(', ')}`}>
        담당
        <span className="av-stack">{names.map((n) => <MiniAvatar key={n} name={n} size={16} />)}</span>
      </span>
    );
  }
  return (
    <span className="tag line who-tag">
      담당
      {names.map((n, i) => (
        <span key={n} className="who-name"><MiniAvatar name={n} size={14} />{n}{i < names.length - 1 ? ',' : ''}</span>
      ))}
    </span>
  );
}

/** 진행 기록 태그: 상태 아이콘 + 사진 + 이름 (+ 시각) */
export function StatusTag({ status, by, at, className = '', compact = false }: {
  status: TaskStatus; by: string | null; at?: string | null; className?: string; compact?: boolean;
}) {
  if (status === 'todo' || !by) return null;
  if (compact) {
    return (
      <span className={`tag ${status} who-tag compact ${className}`} title={`${STATUS_LABEL[status]} · ${by}`} aria-label={`${STATUS_LABEL[status]} · ${by}`}>
        <StatusMark status={status} /><MiniAvatar name={by} size={16} />
      </span>
    );
  }
  return (
    <span className={`tag ${status} who-tag ${className}`} title={`${STATUS_LABEL[status]} · ${by}${at ? ` ${at}` : ''}`}>
      <StatusMark status={status} /><MiniAvatar name={by} size={14} />{by}{at ? ` ${at}` : ''}
    </span>
  );
}
