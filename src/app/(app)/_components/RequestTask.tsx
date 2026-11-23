'use client';

import { useRef, useState, useTransition } from 'react';
import { cancelRequestAction } from '@/app/actions/requests';
import { TaskForm } from '../admin/tasks/TaskForm';
import { PlusIcon } from '@/app/_ui/icons';
import { useToast } from '@/app/_ui/Toast';

export type MyRequest = { id: number; title: string; wantedLabel: string | null; status: 'pending' | 'approved' | 'rejected' };
const STATUS = { pending: '대기 중', approved: '추가됨', rejected: '거절됨' } as const;

/** 멤버용: 업무 추가 요청 보내기 + 내 요청 상태 보기 */
export function RequestTask({ mine, today, members }: { mine: MyRequest[]; today: string; members: { id: number; name: string }[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  // 보내고 나면 폼을 새로 그려 비운다
  const [formKey, setFormKey] = useState(0);
  const toast = useToast();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, start] = useTransition();
  const pending = mine.filter((r) => r.status === 'pending').length;

  return (
    <>
      <button type="button" className="add-link as-link" onClick={() => ref.current?.showModal()}>
        <span aria-hidden><PlusIcon size={10} /></span>업무 추가 요청{pending > 0 && <em className="req-count">대기 {pending}</em>}
      </button>
      <dialog ref={ref} className="task-dialog" aria-labelledby="req-title"
        onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}>
        <div className="dlg-body">
          <div className="dlg-head plain">
            <h2 id="req-title">업무 추가 요청</h2>
            <button type="button" className="dlg-close" aria-label="닫기" onClick={() => ref.current?.close()}>✕</button>
          </div>
          <p className="muted" style={{ margin: 0 }}>관리자 업무 추가와 같은 항목이에요. 관리자가 확인하고 승인하면 업무에 추가돼요.</p>
          <TaskForm key={formKey} task={null} members={members} today={today} mode="request"
            onSent={() => { toast('요청을 보냈어요'); setFormKey((k) => k + 1); ref.current?.close(); }} />
          {mine.length > 0 && (
            <section aria-label="내 요청">
              <div className="group-label">내 요청</div>
              {cancelError && <p className="msg error">{cancelError}</p>}
              <ul className="req-mine">
                {mine.map((r) => (
                  <li key={r.id}>
                    <span className="t">{r.title}</span>
                    {r.wantedLabel && <span className="muted">{r.wantedLabel}</span>}
                    <span className={`tag ${r.status === 'approved' ? 'done' : r.status === 'rejected' ? 'date' : 'line'}`}>{STATUS[r.status]}</span>
                    {r.status === 'pending' && (
                      <button type="button" className="btn small" disabled={cancelling}
                        onClick={() => start(async () => {
                          const res = await cancelRequestAction(r.id);
                          setCancelError(res?.error ?? null);
                          if (!res?.error) toast('요청을 취소했습니다');
                        })}>취소</button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </dialog>
    </>
  );
}
