'use client';

import { MiniAvatar } from '@/app/_ui/AvatarContext';
import { ArrowIcon, StatusMark } from '@/app/_ui/icons';
import type { TaskStatus } from '@/lib/tasks';
import { STATUS_LABEL } from '@/lib/view';

/** 담당 태그: "담당" + 사람마다 작은 사진과 이름 */
export function AssigneeTag({ names, compact = false }: { names: string[]; compact?: boolean }) {
  if (!names.length) return null;
  // 좁은 칸(위클리)에서는 사진만 겹쳐 보여 주고 이름은 마우스를 올렸을 때
  if (compact) {
    return (
      <span className="tag line who-tag compact" title={`담당 ${names.join(', ')}`} aria-label={`담당 ${names.join(', ')}`}>
        <ArrowIcon />
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

/**
 * 파트 진행 태그. 파트를 다 끝내면 "파트 4/4" 대신 ✓ + 파트를 끝낸 사람 프로필(다른 업무의 완료 표시와 같게)
 */
export function PartsTag({ status, label, doneBy, compact = false }: {
  status: TaskStatus; label: string | null; doneBy: (string | null)[]; compact?: boolean;
}) {
  if (!label) return null;
  const who = [...new Set(doneBy.filter((x): x is string => !!x))];
  if (status === 'done' && who.length) {
    return (
      <span className={`tag done who-tag${compact ? ' compact' : ''}`} title={`${label} 완료 · ${who.join(', ')}`} aria-label={`${label} 완료 · ${who.join(', ')}`}>
        <StatusMark status="done" />
        <span className="av-stack">{who.map((n) => <MiniAvatar key={n} name={n} size={compact ? 16 : 14} />)}</span>
      </span>
    );
  }
  return <span className={`tag parts-tag ${status === 'todo' ? 'line' : status}`}><StatusMark status={status} />{label}</span>;
}
