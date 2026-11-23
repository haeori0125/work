'use client';

import { useState, useTransition } from 'react';
import { setStatusAction } from '@/app/actions/tasks';
import { RichText } from '@/app/_ui/RichText';
import type { OccurrenceView } from '@/lib/view';
import { CheckCircle, NEXT_STATUS } from './CheckCircle';
import { TaskDialog } from './TaskDialog';
import { AssigneeTag, StatusTag } from './TaskTags';

type Props = { occ: OccurrenceView; me: { id: number; role: 'member' | 'admin' }; showDate?: boolean };

export function TaskItem({ occ, me, showDate }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const hasParts = occ.parts.length > 0;
  // 파트가 있으면 원을 눌러도 팝업에서 파트를 체크한다
  const cycle = () => hasParts ? setOpen(true) : start(async () => {
    const res = await setStatusAction(occ.taskId, occ.occurrenceKey, NEXT_STATUS[occ.status]);
    setError(res?.error ?? null);
  });

  return (
    <li className={`task-row ${occ.status}`}>
      <CheckCircle status={occ.status} title={hasParts ? `${occ.title} (파트 보기)` : occ.title} onCycle={cycle} disabled={pending} />
      <div>
        <button type="button" className="task-title as-link" onClick={() => setOpen(true)}>{occ.title}</button>
        {occ.description && <RichText className="task-desc" text={occ.description} />}
        <div className="meta tags">
          {showDate && <span className="tag date">{occ.dateLabel}</span>}
          {occ.overdue && <span className="tag date">마감 지남</span>}
          <AssigneeTag names={occ.assignees} />
          {occ.dueLabel && !occ.overdue && <span className="tag line">{occ.dueLabel}</span>}
          {occ.repeatLabel && <span className="tag line">↻ {occ.repeatLabel}</span>}
          {occ.partsLabel && <span className={`tag ${occ.status === 'todo' ? 'line' : occ.status}`}>{occ.partsLabel}</span>}
          <StatusTag status={occ.status} by={occ.lastBy} at={occ.lastAt} className="last-change" />
          {occ.commentCount > 0 && (
            <button type="button" className="tag line memo-n" onClick={() => setOpen(true)}>메모 {occ.commentCount}</button>
          )}
        </div>
        {error && <p className="msg error" style={{ marginTop: 6 }}>{error}</p>}
      </div>
      {open && <TaskDialog occ={occ} me={me} onClose={() => setOpen(false)} />}
    </li>
  );
}
