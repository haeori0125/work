'use client';

import { useState, useTransition } from 'react';
import {
  addCommentAction, deleteCommentAction, editCommentAction, loadTaskDetails, setStatusAction, type TaskDetails,
} from '@/app/actions/tasks';
import type { TaskStatus } from '@/lib/tasks';
import { STATUSES, STATUS_LABEL, type OccurrenceView } from '@/lib/view';
import { NoteList } from './NoteList';

type Props = { occ: OccurrenceView; me: { id: number; role: 'member' | 'admin' }; showDate?: boolean };

export function TaskItem({ occ, me, showDate }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<TaskDetails | null>(null);

  const reload = () => start(async () => setDetails(await loadTaskDetails(occ.taskId, occ.occurrenceKey)));
  const toggle = () => { if (!open && !details) reload(); setOpen(!open); };
  const change = (s: TaskStatus) => start(async () => {
    const res = await setStatusAction(occ.taskId, occ.occurrenceKey, s);
    setError(res?.error ?? null);
    if (open) setDetails(await loadTaskDetails(occ.taskId, occ.occurrenceKey));
  });

  return (
    <li className={`task ${occ.status}`}>
      <div className="task-top">
        <span className="task-title">{occ.title}</span>
        <div className="status-group" role="group" aria-label={`${occ.title} 상태`}>
          {STATUSES.map((s) => (
            <button key={s} className={`s-${s}`} aria-pressed={occ.status === s} disabled={pending}
              onClick={() => occ.status !== s && change(s)}>{STATUS_LABEL[s]}</button>
          ))}
        </div>
      </div>
      {occ.description && <p className="task-desc">{occ.description}</p>}
      <div className="task-meta">
        {showDate && <span>📅 {occ.dateLabel}</span>}
        {occ.assignees.length > 0 && <span>담당: {occ.assignees.join(', ')}</span>}
        {occ.lastChange && <span className="last-change">{occ.lastChange}</span>}
        <button className="btn link small" onClick={toggle} aria-expanded={open}>
          💬 {occ.commentCount} {open ? '접기' : '메모·기록'}
        </button>
      </div>
      {error && <p className="msg error">{error}</p>}
      {open && (
        <div className="details">
          {!details ? <span className="muted">불러오는 중…</span> : (
            <>
              <NoteList
                notes={details.comments}
                me={me}
                placeholder="이 업무에 메모 남기기"
                onAdd={(body) => addCommentAction(occ.taskId, occ.occurrenceKey, body)}
                onEdit={editCommentAction}
                onDelete={deleteCommentAction}
                onChanged={reload}
              />
              {details.history.length > 0 && (
                <div className="muted">
                  <div>변경 기록</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {details.history.map((h, i) => <li key={i}>{h.when} {h.text}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
