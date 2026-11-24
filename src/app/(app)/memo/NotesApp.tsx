'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createNoteAction, deleteNoteAction, setNotePinnedAction, setNotesSharedAction, updateNoteAction, type NoteDto, type SharedNoteDto,
} from '@/app/actions/notes';
import { useToast } from '@/app/_ui/Toast';
import { PlusIcon } from '@/app/_ui/icons';
import { notePreview, noteTitle } from '@/lib/note-text';
import { autoBullet, continueList, indentLine } from '@/lib/mrkdwn';
import { RichText } from '@/app/_ui/RichText';

const SAVE_DELAY = 800;
const RETRY_DELAY = 3000;
const dayFmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' });
const fullFmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

function sortNotes(list: NoteDto[]): NoteDto[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
}

export function NotesApp({ initial, others }: { initial: NoteDto[]; others: SharedNoteDto[] }) {
  const [notes, setNotes] = useState(() => sortNotes(initial));
  const [currentId, setCurrentId] = useState<number | null>(initial[0]?.id ?? others[0]?.id ?? null);
  // 여러 개 골라 공유/공유 해제
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const toast = useToast();
  // 쓰는 중이 아니면 서식이 적용된 모습으로 보여 주고, 누르면 편집
  const [writing, setWriting] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [creating, setCreating] = useState(false);
  const pending = useRef<{ id: number; body: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = notes.find((n) => n.id === currentId) ?? null;
  // 다른 사람이 공유한 메모는 읽기만
  const viewing = current ? null : others.find((n) => n.id === currentId) ?? null;

  const saving = useRef(false);

  /** 저장 안 된 글을 저장한다. 실패하면 글을 되돌려 놓고 잠시 뒤 다시 시도한다. 성공하면 true. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const p = pending.current;
    if (!p) return true;
    pending.current = null;
    saving.current = true;
    setSaveState('saving');
    let failed: string | null = null;
    try {
      const res = await updateNoteAction(p.id, p.body);
      if (res?.error) failed = res.error;
    } catch {
      failed = '저장하지 못했습니다. 인터넷 연결을 확인하세요. 잠시 뒤 다시 저장합니다.';
    }
    saving.current = false;
    if (failed) {
      pending.current ??= p; // 그사이 새로 입력한 글이 없으면 이 글을 다시 저장 대상으로
      setSaveState('error');
      setError(failed);
      timer.current = setTimeout(() => { void flush(); }, RETRY_DELAY);
      return false;
    }
    setError(null);
    setSaveState(pending.current ? 'dirty' : 'saved');
    return true;
  }, []);

  useEffect(() => {
    const onHide = () => { void flush(); };
    // 저장 안 된 글이 있으면 창을 닫기 전에 묻는다.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current || saving.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      void flush();
    };
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
    if (!(await flush())) return; // 저장 못 한 글이 있으면 다른 메모로 넘어가지 않는다
    setNotes((list) => sortNotes(list));
    setCurrentId(id); setArmed(false); setMobileOpen(true); setError(null); setWriting(false);
  };

  const create = async () => {
    if (creating) return;
    if (!(await flush())) return;
    // 새 메모가 만들어지기 전에 입력한 글자가 이전 메모에 들어가지 않도록 편집 칸을 닫아 둔다.
    setCreating(true); setCurrentId(null); setMobileOpen(true);
    const res = await createNoteAction().catch(() => ({ error: '새 메모를 만들지 못했습니다. 인터넷 연결을 확인하세요.' }));
    setCreating(false);
    if ('error' in res) { setError(res.error); return; }
    setNotes((list) => sortNotes([res, ...list]));
    setCurrentId(res.id); setQuery(''); setArmed(false); setMobileOpen(true); setWriting(true);
    requestAnimationFrame(() => document.getElementById('note-text')?.focus());
  };

  const togglePin = async () => {
    if (!current) return;
    if (!(await flush())) return;
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

  const share = async (ids: number[], shared: boolean) => {
    if (!ids.length) return;
    if (!(await flush())) return;
    const res = await setNotesSharedAction(ids, shared);
    if (res?.error) { setError(res.error); return; }
    setNotes((list) => list.map((n) => (ids.includes(n.id) ? { ...n, shared } : n)));
    setPicked(new Set()); setPicking(false);
    if (res?.ok) toast(res.ok);
  };

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => (q ? notes.filter((n) => n.body.toLowerCase().includes(q)) : notes), [notes, q]);
  const visibleOthers = q ? others.filter((n) => n.body.toLowerCase().includes(q)) : others;
  // 공유된 메모(내 것 + 다른 사람 것)는 맨 위에 모아서
  const sharedRows = [
    ...visible.filter((n) => n.shared).map((n) => ({ ...n, author: null as string | null })),
    ...visibleOthers.map((n) => ({ ...n, pinned: false, shared: true, author: n.authorName })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pinned = visible.filter((n) => n.pinned && !n.shared);
  const rest = visible.filter((n) => !n.pinned && !n.shared);
  const pickedMine = notes.filter((n) => picked.has(n.id));

  type Row = { id: number; body: string; updatedAt: string; shared?: boolean; author?: string | null };
  const group = (label: string, items: Row[]) => items.length > 0 && (
    <>
      <div className="nl-group">{label}</div>
      <ul className="nl">
        {items.map((n) => {
          const mine = !n.author;
          const on = picked.has(n.id);
          return (
            <li key={n.id} className={picking && mine ? 'picking' : undefined}>
              {picking && mine && (
                <input type="checkbox" className="nl-check" checked={on} aria-label={`${noteTitle(n.body)} 고르기`}
                  onChange={() => { const s = new Set(picked); if (on) s.delete(n.id); else s.add(n.id); setPicked(s); }} />
              )}
              <button type="button" aria-current={n.id === currentId}
                onClick={() => { if (picking && mine) { const s = new Set(picked); if (on) s.delete(n.id); else s.add(n.id); setPicked(s); } else void select(n.id); }}>
                <b>{noteTitle(n.body)}</b>
                <span><em>{dayFmt.format(new Date(n.updatedAt))}</em> {notePreview(n.body)}</span>
                {n.shared && <span className="nl-by">{n.author ? `${n.author} 님이 공유` : '내가 공유함'}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <div className={`notes-app${mobileOpen ? ' open' : ''}`}>
      <section className="panel note-list" aria-label="메모 목록">
        <div className="nl-head">
          <h2>개인 메모</h2>
          <button className="btn primary small" type="button" onClick={create} disabled={creating}><PlusIcon size={10} /> 새 메모</button>
          <button className="btn small" type="button" onClick={() => { setPicking(!picking); setPicked(new Set()); }}>{picking ? '취소' : '선택'}</button>
          <span className="lock">🔒 공유하지 않은 메모는 나만 볼 수 있어요</span>
        </div>
        <input className="nl-search" type="search" placeholder="검색" aria-label="메모 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        {notes.length === 0 && others.length === 0 ? <p className="nl-empty">메모가 없습니다. &lsquo;새 메모&rsquo;를 눌러 시작하세요.</p>
          : visible.length === 0 && visibleOthers.length === 0 ? <p className="nl-empty">검색 결과가 없습니다</p>
            : <>{group('🔗 공유된 메모', sharedRows)}{group('📌 고정됨', pinned)}{group('메모', rest)}</>}
        {picking && (
          <div className="nl-bar">
            <span>{pickedMine.length ? `${pickedMine.length}개 선택` : '공유할 메모를 고르세요'}</span>
            <button className="btn small" type="button" disabled={!pickedMine.some((n) => n.shared)}
              onClick={() => share(pickedMine.filter((n) => n.shared).map((n) => n.id), false)}>공유 해제</button>
            <button className="btn small primary" type="button" disabled={!pickedMine.some((n) => !n.shared)}
              onClick={() => share(pickedMine.filter((n) => !n.shared).map((n) => n.id), true)}>공유</button>
          </div>
        )}
      </section>
      <section className="panel note-editor" aria-label="메모 편집">
        <div className="ne-top">
          <button className="ne-back" type="button" onClick={async () => { if (await flush()) setMobileOpen(false); }}>‹ 메모</button>
          <span className="muted">{current ? fullFmt.format(new Date(current.updatedAt)) : viewing ? fullFmt.format(new Date(viewing.updatedAt)) : ''}</span>
          <span className="spacer" />
          {viewing && <span className="muted">{viewing.authorName} 님이 공유한 메모 · 읽기 전용</span>}
          {current && <>
            <button className="btn small" type="button" onClick={() => share([current.id], !current.shared)}>{current.shared ? '공유 해제' : '공유'}</button>
            <button className="btn small" type="button" onClick={togglePin}>{current.pinned ? '고정 해제' : '고정'}</button>
            <button className="btn small danger" type="button" onClick={remove}>{armed ? '한 번 더 누르면 삭제' : '삭제'}</button>
          </>}
        </div>
        {current ? (
          writing || !current.body ? (
            <textarea id="note-text" ref={area} value={current.body} autoFocus={writing}
              onFocus={() => setWriting(true)}
              onChange={(e) => {
                // 줄 맨 앞 "* "·"- " → "• "
                const r = autoBullet(e.target.value, e.target.selectionStart);
                if (!r) { edit(e.target.value); return; }
                edit(r.value);
                requestAnimationFrame(() => area.current?.setSelectionRange(r.caret, r.caret));
              }}
              onKeyDown={(e) => {
                const t = e.currentTarget;
                if (t.selectionStart !== t.selectionEnd || e.nativeEvent.isComposing) return;
                const r = e.key === 'Enter' && !e.shiftKey ? continueList(t.value, t.selectionStart)
                  : e.key === 'Tab' ? indentLine(t.value, t.selectionStart, e.shiftKey) : null;
                if (!r) return;
                e.preventDefault();
                edit(r.value);
                requestAnimationFrame(() => area.current?.setSelectionRange(r.caret, r.caret));
              }}
              onBlur={() => { void flush(); if (current.body) setWriting(false); }}
              placeholder={'첫 줄이 메모 제목이 됩니다\n* 글머리표  1. 번호  `코드`  *굵게*  _기울임_  ~취소선~  > 인용  ```코드 블록```'}
              aria-label="메모 내용" maxLength={20000} />
          ) : (
            <div className="ne-view" role="button" tabIndex={0} aria-label="메모 편집하기" title="눌러서 편집"
              onClick={() => setWriting(true)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setWriting(true); } }}>
              <RichText text={current.body} />
            </div>
          )
        ) : viewing ? (
          <div className="ne-view readonly" aria-label="공유된 메모 내용"><RichText text={viewing.body} /></div>
        ) : <p className="nl-empty">{creating ? '새 메모를 만드는 중…' : '왼쪽에서 메모를 고르거나 새 메모를 만드세요.'}</p>}
        <div className="ne-foot">
          <span className="muted" role="status">
            {saveState === 'saving' ? '저장 중…' : saveState === 'dirty' ? '입력 중…' : saveState === 'error' ? `저장하지 못했습니다 · ${error ?? ''}` : '자동 저장됨'}
          </span>
          {current && <span className="muted">{current.body.length.toLocaleString()}자</span>}
          {error && saveState !== 'error' && <span className="err">{error}</span>}
        </div>
      </section>
    </div>
  );
}
