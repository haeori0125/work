'use client';

import { StatusMark } from '@/app/_ui/icons';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  addCommentAction, deleteCommentAction, editCommentAction, loadTaskDetails, setStatusAction, type TaskDetails,
} from '@/app/actions/tasks';
import { Person } from '@/app/_ui/AvatarContext';
import { RichText } from '@/app/_ui/RichText';
import { STATUS_LABEL, type OccurrenceView } from '@/lib/view';
import { CheckCircle, NEXT_STATUS } from './CheckCircle';
import { TaskForm } from '../admin/tasks/TaskForm';
import { loadTaskForEditAction } from '@/app/actions/admin';
import { useToast } from '@/app/_ui/Toast';
import type { TaskDefinition } from '@/lib/tasks';
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

  // 업무 고치기(관리자): 내용을 불러와서 같은 팝업 안에 수정 폼을 띄운다
  const toast = useToast();
  const [edit, setEdit] = useState<{ task: TaskDefinition; members: { id: number; name: string }[]; today: string } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const openEdit = async () => {
    setEditLoading(true);
    const res = await loadTaskForEditAction(occ.taskId).catch(() => ({ error: '불러오지 못했습니다. 인터넷 연결을 확인하세요.' }));
    setEditLoading(false);
    if ('error' in res) { setError(res.error); return; }
    setEdit(res);
  };

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
          <div className="dlg-tools">
            {/* 관리자는 이 팝업 안에서 바로 업무를 고친다 */}
            {me.role === 'admin' && !edit && (
              <button type="button" className="dlg-close dlg-edit" aria-label="업무 수정" title="업무 수정" onClick={openEdit} disabled={editLoading}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            )}
            <button type="button" className="dlg-close" aria-label="닫기" onClick={() => ref.current?.close()}>✕</button>
          </div>
        </div>

        {edit ? (
          <div className="dlg-editform">
            <TaskForm task={edit.task} members={edit.members} today={edit.today}
              inline={{ onCancel: () => setEdit(null) }}
              onSent={(msg) => { toast(msg); setEdit(null); reload(); }} />
          </div>
        ) : (<>

        <div className="tags">
          <span className="tag line">{occ.dateLabel}</span>
          {occ.overdue && <span className="tag date">마감 지남</span>}
          {occ.dueLabel && !occ.overdue && <span className="tag line due">{occ.dueLabel}까지</span>}
          {occ.repeatLabel && <span className="tag line">↻ {occ.repeatLabel}</span>}
          <AssigneeTag names={occ.assignees} />
          {occ.partsLabel && <span className={`tag parts-tag ${occ.status === 'todo' ? 'line' : occ.status}`}><StatusMark status={occ.status} />{occ.partsLabel}</span>}
          <StatusTag status={occ.status} by={occ.parts.length ? null : occ.lastBy} at={occ.lastAtFull} />
        </div>
        {details?.origin && (
          <p className="dlg-origin">요청 <Person name={details.origin.by} /> · {details.origin.date} 등록</p>
        )}
        {occ.description && <RichText className="dlg-desc" text={occ.description} />}
        {error && <p className="msg error">{error}</p>}

        {hasParts && (
          <section className="dlg-sec" aria-label="파트">
            <h3>파트 <span className="muted">{occ.partsLabel?.replace('파트 ', '')}</span></h3>
            <PartList parts={occ.parts} taskId={occ.taskId} occurrenceKey={occ.occurrenceKey} />
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
        </>)}
      </div>
    </dialog>
  );
}
