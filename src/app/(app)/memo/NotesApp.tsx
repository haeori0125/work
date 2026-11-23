'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createNoteAction, deleteNoteAction, setNotePinnedAction, updateNoteAction, type NoteDto,
} from '@/app/actions/notes';
import { notePreview, noteTitle } from '@/lib/note-text';

const SAVE_DELAY = 800;
const dayFmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' });
const fullFmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

function sortNotes(list: NoteDto[]): NoteDto[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
}

export function NotesApp({ initial }: { initial: NoteDto[] }) {
  const [notes, setNotes] = useState(() => sortNotes(initial));
  const [currentId, setCurrentId] = useState<number | null>(initial[0]?.id ?? null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [creating, setCreating] = useState(false);
  const pending = useRef<{ id: number; body: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = notes.find((n) => n.id === currentId) ?? null;

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    setSaveState('saving');
    const res = await updateNoteAction(p.id, p.body);
    if (res?.error) { setSaveState('error'); setError(res.error); return; }
    setSaveState(pending.current ? 'dirty' : 'saved');
  }, []);

  useEffect(() => {
    const onHide = () => { void flush(); };
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); void flush(); };
  }, [flush]);

  const edit = (body: string) => {
    if (!current) return;
    const now = new Date().toISOString();
    setNotes((list) => list.map((n) => (n.id === current.id ? { ...n, body, updatedAt: now } : n)));
    pending.current = { id: current.id, body };
    setSaveState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, SAVE_DELAY);
  };

  const select = async (id: number) => {
    await flush();
    setNotes((list) => sortNotes(list));
    setCurrentId(id); setArmed(false); setMobileOpen(true); setError(null);
  };

  const create = async () => {
    if (creating) return;
    await flush();
    // 새 메모가 만들어지기 전에 입력한 글자가 이전 메모에 들어가지 않도록 편집 칸을 닫아 둔다.
    setCreating(true); setCurrentId(null); setMobileOpen(true);
    const res = await createNoteAction();
    setCreating(false);
    if ('error' in res) { setError(res.error); return; }
    setNotes((list) => sortNotes([res, ...list]));
    setCurrentId(res.id); setQuery(''); setArmed(false); setMobileOpen(true);
    requestAnimationFrame(() => document.getElementById('note-text')?.focus());
  };

  const togglePin = async () => {
    if (!current) return;
    await flush();
    const pinned = !current.pinned;
    const res = await setNotePinnedAction(current.id, pinned);
    if (res?.error) { setError(res.error); return; }
    setNotes((list) => sortNotes(list.map((n) => (n.id === current.id ? { ...n, pinned, updatedAt: new Date().toISOString() } : n))));
  };

  const remove = async () => {
    if (!current) return;
    if (!armed) { setArmed(true); return; }
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    pending.current = null;
    const res = await deleteNoteAction(current.id);
    if (res?.error) { setError(res.error); return; }
    const rest = notes.filter((n) => n.id !== current.id);
    setNotes(rest); setCurrentId(rest[0]?.id ?? null); setArmed(false); setMobileOpen(false); setSaveState('saved');
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? notes.filter((n) => n.body.toLowerCase().includes(q)) : notes;
  }, [notes, query]);
  const pinned = visible.filter((n) => n.pinned);
  const others = visible.filter((n) => !n.pinned);

  const group = (label: string, items: NoteDto[]) => items.length > 0 && (
    <>
      <div className="nl-group">{label}</div>
      <ul className="nl">
        {items.map((n) => (
          <li key={n.id}>
            <button type="button" aria-current={n.id === currentId} onClick={() => select(n.id)}>
              <b>{noteTitle(n.body)}</b>
              <span><em>{dayFmt.format(new Date(n.updatedAt))}</em> {notePreview(n.body)}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div className={`notes-app${mobileOpen ? ' open' : ''}`}>
      <section className="panel note-list" aria-label="메모 목록">
        <div className="nl-head">
          <h2>개인 메모</h2>
          <button className="btn primary small" type="button" onClick={create} disabled={creating}>＋ 새 메모</button>
          <span className="lock">🔒 나만 볼 수 있습니다</span>
        </div>
        <input className="nl-search" type="search" placeholder="검색" aria-label="메모 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        {notes.length === 0 ? <p className="nl-empty">메모가 없습니다. &lsquo;새 메모&rsquo;를 눌러 시작하세요.</p>
          : visible.length === 0 ? <p className="nl-empty">검색 결과가 없습니다</p>
            : <>{group('📌 고정됨', pinned)}{group('메모', others)}</>}
      </section>
      <section className="panel note-editor" aria-label="메모 편집">
        <div className="ne-top">
          <button className="ne-back" type="button" onClick={async () => { await flush(); setMobileOpen(false); }}>‹ 메모</button>
          <span className="muted">{current ? fullFmt.format(new Date(current.updatedAt)) : ''}</span>
          <span className="spacer" />
          {current && <>
            <button className="btn small" type="button" onClick={togglePin}>{current.pinned ? '고정 해제' : '고정'}</button>
            <button className="btn small danger" type="button" onClick={remove}>{armed ? '한 번 더 누르면 삭제' : '삭제'}</button>
          </>}
        </div>
        {current ? (
          <textarea id="note-text" value={current.body} onChange={(e) => edit(e.target.value)} onBlur={() => { void flush(); }}
            placeholder="첫 줄이 메모 제목이 됩니다" aria-label="메모 내용" maxLength={20000} />
        ) : <p className="nl-empty">{creating ? '새 메모를 만드는 중…' : '왼쪽에서 메모를 고르거나 새 메모를 만드세요.'}</p>}
        <div className="ne-foot">
          <span className="muted" role="status">
            {saveState === 'saving' ? '저장 중…' : saveState === 'dirty' ? '입력 중…' : saveState === 'error' ? (error ?? '저장하지 못했습니다') : '자동 저장됨'}
          </span>
          {current && <span className="muted">{current.body.length.toLocaleString()}자</span>}
          {error && saveState !== 'error' && <span className="err">{error}</span>}
        </div>
      </section>
    </div>
  );
}
