'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  addCommentAction, deleteCommentAction, editCommentAction, loadTaskDetails, setStatusAction, type TaskDetails,
} from '@/app/actions/tasks';
import { Person } from '@/app/_ui/AvatarContext';
import { STATUS_LABEL, type OccurrenceView } from '@/lib/view';
import { CheckCircle, NEXT_STATUS } from './CheckCircle';
import { NoteList } from './NoteList';
import { PartList } from './PartList';
import { AssigneeTag, StatusTag } from './TaskTags';

type Props = { occ: OccurrenceView; me: { id: number; role: 'member' | 'admin' }; onClose: () => void };

/** 할 일 세부 내용 팝업: 설명 · 담당 · 마감 · 파트 · 메모 · 변경 기록 */
export function TaskDialog({ occ, me, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [details, setDetails] = useState<TaskDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reload = () => start(async () => setDetails(await loadTaskDetails(occ.taskId, occ.occurrenceKey)));
  useEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasParts = occ.parts.length > 0;
  const cycle = () => start(async () => {
    const res = await setStatusAction(occ.taskId, occ.occurrenceKey, NEXT_STATUS[occ.status]);
    setError(res?.error ?? null);
    setDetails(await loadTaskDetails(occ.taskId, occ.occurrenceKey));
  });

  return (
    <dialog ref={ref} className="task-dialog" aria-labelledby={`dlg-${occ.taskId}`} onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}>
      <div className="dlg-body">
        <div className="dlg-head">
          {hasParts
            ? <span className={`check ${occ.status}`} aria-label={STATUS_LABEL[occ.status]} />
            : <CheckCircle status={occ.status} title={occ.title} onCycle={cycle} disabled={pending} />}
          <h2 id={`dlg-${occ.taskId}`} className={occ.status === 'done' ? 'done' : undefined}>{occ.title}</h2>
          <button type="button" className="dlg-close" aria-label="닫기" onClick={() => ref.current?.close()}>✕</button>
        </div>

        <div className="tags">
          <span className="tag line">{occ.dateLabel}</span>
          {occ.overdue && <span className="tag date">마감 지남</span>}
          {occ.dueLabel && !occ.overdue && <span className="tag line due">{occ.dueLabel}까지</span>}
          {occ.repeatLabel && <span className="tag line">↻ {occ.repeatLabel}</span>}
          <AssigneeTag names={occ.assignees} />
          {occ.partsLabel && <span className={`tag ${occ.status === 'todo' ? 'line' : occ.status}`}>{occ.partsLabel}</span>}
          <StatusTag status={occ.status} by={occ.parts.length ? null : occ.lastBy} at={occ.lastAt} />
        </div>
        {details?.origin && (
          <p className="dlg-origin">요청 <Person name={details.origin.by} /> · {details.origin.date} 등록</p>
        )}
        {occ.description && <p className="dlg-desc">{occ.description}</p>}
        {error && <p className="msg error">{error}</p>}

        {hasParts && (
          <section className="dlg-sec" aria-label="파트">
            <h3>파트 <span className="muted">{occ.partsLabel?.replace('파트 ', '')}</span></h3>
            <PartList parts={occ.parts} occurrenceKey={occ.occurrenceKey} />
          </section>
        )}

        <section className="dlg-sec" aria-label="메모">
          <h3>메모</h3>
          {!details ? <span className="muted">불러오는 중…</span> : (
            <NoteList
              notes={details.comments}
              me={me}
              placeholder="이 업무에 메모 남기기"
              onAdd={(body) => addCommentAction(occ.taskId, occ.occurrenceKey, body)}
              onEdit={editCommentAction}
              onDelete={deleteCommentAction}
              onChanged={reload}
            />
          )}
        </section>

        {details && details.history.length > 0 && (
          <details className="dlg-sec dlg-toggle">
            <summary>변경 기록 <span className="muted">{details.history.length}</span></summary>
            <ul className="dlg-history">{details.history.map((h, i) => <li key={i}><span className="muted">{h.when}</span> {h.text}</li>)}</ul>
          </details>
        )}
      </div>
    </dialog>
  );
}
