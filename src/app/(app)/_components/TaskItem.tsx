'use client';

import { useState, useTransition } from 'react';
import {
  addCommentAction, deleteCommentAction, editCommentAction, loadTaskDetails, setStatusAction, type TaskDetails,
} from '@/app/actions/tasks';
import type { OccurrenceView } from '@/lib/view';
import { CheckCircle, NEXT_STATUS } from './CheckCircle';
import { NoteList } from './NoteList';

type Props = { occ: OccurrenceView; me: { id: number; role: 'member' | 'admin' }; showDate?: boolean };

export function TaskItem({ occ, me, showDate }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<TaskDetails | null>(null);

  const reload = () => start(async () => setDetails(await loadTaskDetails(occ.taskId, occ.occurrenceKey)));
  const toggle = () => { if (!open && !details) reload(); setOpen(!open); };
  const cycle = () => start(async () => {
    const res = await setStatusAction(occ.taskId, occ.occurrenceKey, NEXT_STATUS[occ.status]);
    setError(res?.error ?? null);
    if (open) setDetails(await loadTaskDetails(occ.taskId, occ.occurrenceKey));
  });

  return (
    <li className={`task-row ${occ.status}`}>
      <CheckCircle status={occ.status} title={occ.title} onCycle={cycle} disabled={pending} />
      <div>
        <div className="task-title">{occ.title}</div>
        {occ.description && <p className="task-desc">{occ.description}</p>}
        <div className="meta">
          {showDate && <span>{occ.dateLabel}</span>}
          {occ.assignees.length > 0 && <span>담당 {occ.assignees.join(', ')}</span>}
          {occ.repeatLabel && <span>↻ {occ.repeatLabel}</span>}
          {occ.lastChange && <span className={`by ${occ.status} last-change`}>{occ.lastChange}</span>}
          <button className="btn link small memo-n" onClick={toggle} aria-expanded={open}>
            {occ.commentCount > 0 ? `메모 ${occ.commentCount}` : '메모·기록'}{open ? ' ▴' : ''}
          </button>
        </div>
        {error && <p className="msg error" style={{ marginTop: 6 }}>{error}</p>}
      </div>
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
