'use client';

import { useEffect, useRef } from 'react';
import type { OccurrenceView } from '@/lib/view';
import { TaskItem } from './TaskItem';

/**
 * 로그인 직후 한 번: 내가 맡은 지난 업무가 있으면 팝업으로 알려 준다.
 * 여기서 바로 체크해서 끝낼 수 있다(끝낸 건 목록에서 빠진다). 닫으면 표시(쿠키)를 지워서 다시 뜨지 않는다.
 */
export function PastAlert({ items, me }: { items: OccurrenceView[]; me: { id: number; role: 'member' | 'admin' } }) {
  const ref = useRef<HTMLDialogElement>(null);
  const done = () => { document.cookie = 'past_alert=; Max-Age=0; path=/'; };
  useEffect(() => {
    const d = ref.current;
    if (!items.length) { done(); return; }
    if (d && items.length && !d.open) d.showModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 팝업에서 다 끝내서 목록이 비면 표시도 지운다
  useEffect(() => { if (!items.length) done(); }, [items.length]);
  if (!items.length) return null;
  return (
    <dialog ref={ref} className="task-dialog past-alert" aria-labelledby="past-alert-t" onClose={done}
      onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}>
      <div className="dlg-body">
        <div className="dlg-head plain">
          <h2 id="past-alert-t">지난 업무가 {items.length}개 있어요</h2>
          <button type="button" className="dlg-close" aria-label="닫기" onClick={() => ref.current?.close()}>✕</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>내가 맡은 업무 중 날짜가 지났는데 아직 끝나지 않은 것들이에요. 여기서 바로 체크할 수 있어요.</p>
        <ul className="rows past-list">
          {items.map((o) => <TaskItem key={`${o.taskId}-${o.occurrenceKey}`} occ={o} me={me} showDate />)}
        </ul>
        <button type="button" className="btn primary past-ok" onClick={() => ref.current?.close()}>확인</button>
      </div>
    </dialog>
  );
}
