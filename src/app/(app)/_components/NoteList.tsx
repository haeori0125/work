'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/app/actions/result';
import { MiniAvatar } from '@/app/_ui/AvatarContext';
import { useToast } from '@/app/_ui/Toast';
import type { NoteView } from '@/lib/view';

type Props = {
  notes: NoteView[];
  me: { id: number; role: 'member' | 'admin' };
  placeholder: string;
  onAdd: (body: string) => Promise<ActionResult>;
  onEdit: (id: number, body: string) => Promise<ActionResult>;
  onDelete: (id: number) => Promise<ActionResult>;
  onChanged?: () => void;
};

export function NoteList({ notes, me, placeholder, onAdd, onEdit, onDelete, onChanged }: Props) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toast = useToast();
  const run = (fn: () => Promise<ActionResult>, after?: () => void, okText?: string) => start(async () => {
    const res = await fn();
    if (res?.error) { setError(res.error); return; }
    if (okText) toast(okText);
    setError(null);
    after?.();
    onChanged?.();
  });

  const send = () => { if (draft.trim() && !pending) run(() => onAdd(draft), () => setDraft(''), '등록되었습니다'); };

  return (
    <div className="chat">
      {notes.length > 0 && (
        <ul className="chat-list">
          {notes.map((n, i) => {
            const mine = n.authorId === me.id;
            // 같은 사람이 이어서 쓴 말은 이름·사진을 한 번만
            const first = i === 0 || notes[i - 1].authorId !== n.authorId;
            return (
              <li key={n.id} className={`chat-msg${mine ? ' mine' : ''}${first ? ' first' : ''}`}>
                {!mine && <span className="chat-av">{first && <MiniAvatar name={n.authorName} size={28} />}</span>}
                <div className="chat-col">
                  {!mine && first && <span className="chat-name">{n.authorName}</span>}
                  {editing?.id === n.id ? (
                    <div className="chat-edit">
                      <textarea value={editing.body} onChange={(e) => setEditing({ id: n.id, body: e.target.value })} maxLength={2000} rows={2} autoFocus
                        aria-label="메모 고치기" />
                      <div className="row">
                        <button type="button" className="btn small" onClick={() => setEditing(null)}>취소</button>
                        <button type="button" className="btn small primary" disabled={pending || !editing.body.trim()}
                          onClick={() => run(() => onEdit(n.id, editing.body), () => setEditing(null), '저장되었습니다')}>저장</button>
                      </div>
                    </div>
                  ) : (
                    <div className="chat-line">
                      <div className="chat-bubble">{n.body}</div>
                      <span className="chat-meta">
                        {n.edited && <span>수정됨</span>}
                        <span>{n.when}</span>
                        <span className="chat-acts">
                          {mine && <button type="button" onClick={() => setEditing({ id: n.id, body: n.body })}>수정</button>}
                          {(mine || me.role === 'admin') && (
                            <button type="button" disabled={pending}
                              onClick={() => { if (confirm('메모를 삭제할까요?')) run(() => onDelete(n.id), undefined, '삭제되었습니다'); }}>삭제</button>
                          )}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} maxLength={2000} rows={1}
          aria-label={placeholder}
          onKeyDown={(e) => {
            // Enter로 보내기, Shift+Enter는 줄바꿈(한글 조합 중에는 무시)
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
          }} />
        <button className="chat-send" aria-label="보내기" disabled={pending || !draft.trim()}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3.5M3.5 8 8 3.5 12.5 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </form>
      {error && <p className="msg error">{error}</p>}
    </div>
  );
}
