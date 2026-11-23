'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/app/actions/result';
import { Person } from '@/app/_ui/AvatarContext';
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

  const run = (fn: () => Promise<ActionResult>, after?: () => void) => start(async () => {
    const res = await fn();
    if (res?.error) { setError(res.error); return; }
    setError(null);
    after?.();
    onChanged?.();
  });

  return (
    <div className="stack" style={{ gap: 8 }}>
      {notes.length > 0 && (
        <ul className="notes">
          {notes.map((n) => (
            <li key={n.id} className="note">
              {editing?.id === n.id ? (
                <div className="note-form">
                  <textarea value={editing.body} onChange={(e) => setEditing({ id: n.id, body: e.target.value })} maxLength={2000} />
                  <button className="btn small primary" disabled={pending}
                    onClick={() => run(() => onEdit(n.id, editing.body), () => setEditing(null))}>저장</button>
                  <button className="btn small" onClick={() => setEditing(null)}>취소</button>
                </div>
              ) : (
                <>
                  <div className="note-body">{n.body}</div>
                  <div className="note-meta">
                    <span className="meta-who"><Person name={n.authorName} size={16} /><span>· {n.when}{n.edited ? ' (수정됨)' : ''}</span></span>
                    {n.authorId === me.id && (
                      <button className="btn link small" onClick={() => setEditing({ id: n.id, body: n.body })}>수정</button>
                    )}
                    {(n.authorId === me.id || me.role === 'admin') && (
                      <button className="btn link small" disabled={pending}
                        onClick={() => { if (confirm('메모를 삭제할까요?')) run(() => onDelete(n.id)); }}>삭제</button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="note-form" onSubmit={(e) => { e.preventDefault(); run(() => onAdd(draft), () => setDraft('')); }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} maxLength={2000} rows={2} />
        <button className="btn small primary" disabled={pending || !draft.trim()}>등록</button>
      </form>
      {error && <p className="msg error">{error}</p>}
    </div>
  );
}
