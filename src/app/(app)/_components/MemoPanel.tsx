'use client';

import { useState, useTransition } from 'react';
import { addBoardPostAction, deleteBoardPostAction, editBoardPostAction } from '@/app/actions/memos';
import type { ActionResult } from '@/app/actions/result';
import type { NoteView } from '@/lib/view';

type Props = { posts: NoteView[]; me: { id: number; role: 'member' | 'admin' } };

export function MemoPanel({ posts, me }: Props) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) => start(async () => {
    const res = await fn();
    if (res?.error) { setError(res.error); return; }
    setError(null); after?.();
  });
  return (
    <section className="panel p-memo" aria-label="오늘의 공용 메모">
      <div className="panel-head"><h2>메모</h2><span className="sub">오늘의 공용 메모 · 모두가 함께 봅니다</span></div>
      <div className="memo-body">
        {posts.length === 0 ? <p className="muted" style={{ margin: 0 }}>아직 메모가 없습니다. 인수인계나 공지를 남겨 보세요.</p> : (
          <ul className="cards">
            {posts.map((n) => (
              <li key={n.id} className="card-note">
                {editing?.id === n.id ? (
                  <>
                    <textarea value={editing.body} onChange={(e) => setEditing({ id: n.id, body: e.target.value })} maxLength={2000} aria-label="메모 수정" />
                    <div className="row">
                      <button className="btn small primary" disabled={pending} onClick={() => run(() => editBoardPostAction(n.id, editing.body), () => setEditing(null))}>저장</button>
                      <button className="btn small" onClick={() => setEditing(null)}>취소</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>{n.body}</p>
                    <div className="note-meta">
                      <span>{n.authorName} · {n.when}{n.edited ? ' (수정됨)' : ''}</span>
                      {n.authorId === me.id && <button className="btn link small" onClick={() => setEditing({ id: n.id, body: n.body })}>수정</button>}
                      {(n.authorId === me.id || me.role === 'admin') && (
                        <button className="btn link small" disabled={pending} style={{ color: armed === n.id ? 'var(--red)' : undefined }}
                          onClick={() => (armed === n.id ? run(() => deleteBoardPostAction(n.id), () => setArmed(null)) : setArmed(n.id))}>
                          {armed === n.id ? '한 번 더 누르면 삭제' : '삭제'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <form className="compose" onSubmit={(e) => { e.preventDefault(); run(() => addBoardPostAction(draft), () => setDraft('')); }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="인수인계, 공지 등을 남겨 주세요" maxLength={2000} aria-label="공용 메모 입력" />
          {error && <p className="msg error">{error}</p>}
          <button className="btn primary" disabled={pending || !draft.trim()}>등록</button>
        </form>
      </div>
    </section>
  );
}
