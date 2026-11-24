'use client';

import { useEffect, useRef, useState } from 'react';
import { MiniAvatar } from '@/app/_ui/AvatarContext';

type Person = { id: number; name: string };
type Props = {
  count: number; people: Person[]; initial: number[]; initialEdit: boolean; wasShared: boolean;
  onShare: (to: number[], edit: boolean) => void; onUnshare: () => void; onClose: () => void;
};

/** 공유할 사람 고르기: '모두' 또는 몇 명만 */
export function ShareDialog({ count, people, initial, initialEdit, wasShared, onShare, onUnshare, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [to, setTo] = useState<number[]>(initial);
  const [edit, setEdit] = useState(initialEdit);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  const toggle = (id: number) => setTo(to.includes(id) ? to.filter((x) => x !== id) : [...to, id]);

  return (
    <dialog ref={ref} className="task-dialog share-dialog" aria-labelledby="share-title" onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}>
      <div className="dlg-body">
        <div className="dlg-head plain">
          <h2 id="share-title">{count > 1 ? `메모 ${count}개 공유` : '메모 공유'}</h2>
          <button type="button" className="dlg-close" aria-label="닫기" onClick={() => ref.current?.close()}>✕</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>아무도 고르지 않으면 모두에게 공유돼요.</p>
        <div className="pick" role="radiogroup" aria-label="받는 사람이 할 수 있는 일">
          <label><input type="radio" className="vh" name="share-mode" checked={!edit} onChange={() => setEdit(false)} /><span>👀 읽기만</span></label>
          <label><input type="radio" className="vh" name="share-mode" checked={edit} onChange={() => setEdit(true)} /><span>✏️ 함께 편집</span></label>
        </div>
        <div className="pick share-pick" role="group" aria-label="공유할 사람">
          <label>
            <input type="checkbox" className="vh" checked={to.length === 0} onChange={() => setTo([])} />
            <span>👥 모두</span>
          </label>
          {people.map((m) => (
            <label key={m.id} className="pick-person">
              <input type="checkbox" className="vh" checked={to.includes(m.id)} onChange={() => toggle(m.id)} />
              <span><MiniAvatar name={m.name} size={20} />{m.name}</span>
            </label>
          ))}
        </div>
        <div className="tf-actions">
          {wasShared && <button type="button" className="btn danger" onClick={() => { onUnshare(); ref.current?.close(); }}>공유 해제</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => ref.current?.close()}>취소</button>
          <button type="button" className="btn primary" onClick={() => { onShare(to, edit); ref.current?.close(); }}>
            {to.length ? `${to.length}명에게 공유` : '모두에게 공유'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
