'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  createNoteAction, deleteNoteAction, leaveNoteAction, setNotePinnedAction, setNotesSharedAction, syncNoteAction, updateNoteAction,
  type NoteDto, type SharedNoteDto,
} from '@/app/actions/notes';
import type { Presence } from '@/lib/notes';
import { useToast } from '@/app/_ui/Toast';
import { PlusIcon } from '@/app/_ui/icons';
import { notePreview, noteTitle } from '@/lib/note-text';
import { RichEditor, SHORTCUTS, type FormatKey, type RichEditorHandle } from '@/app/_ui/RichEditor';
import { MiniAvatar } from '@/app/_ui/AvatarContext';
import { ShareDialog } from './ShareDialog';

const SAVE_DELAY = 800;
const RETRY_DELAY = 3000;
/** 같이 보는 사람·바뀐 내용을 확인하는 간격 */
const SYNC_MS = 2000;
const dayFmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' });
const fullFmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

function sortNotes(list: NoteDto[]): NoteDto[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
}

export function NotesApp({ initial, others, people }: { initial: NoteDto[]; others: SharedNoteDto[]; people: { id: number; name: string }[] }) {
  const [notes, setNotes] = useState(() => sortNotes(initial));
  // 다른 사람이 공유한 메모(같이 고칠 수 있는 것도 있음)
  const [theirs, setTheirs] = useState(others);
  // 같이 보고 있는 사람
  const [peers, setPeers] = useState<Presence[]>([]);
  // 메모마다 서버와 마지막으로 맞춘 판(동시에 고친 글을 합칠 때 기준)
  const base = useRef(new Map<number, { version: number; body: string }>());
  const [currentId, setCurrentId] = useState<number | null>(initial[0]?.id ?? others[0]?.id ?? null);
  // 여러 개 골라 공유/공유 해제
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const toast = useToast();
  // 공유할 사람 고르는 창(어떤 메모들을)
  const [sharing, setSharing] = useState<number[] | null>(null);
  const editor = useRef<RichEditorHandle>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [creating, setCreating] = useState(false);
  // 방금 만든 메모는 열리자마자 입력할 수 있게
  const [fresh, setFresh] = useState<number | null>(null);
  const pending = useRef<{ id: number; body: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = notes.find((n) => n.id === currentId) ?? null;
  // 다른 사람이 공유한 메모: 함께 편집이면 고칠 수 있고, 아니면 읽기만
  const viewing = current ? null : theirs.find((n) => n.id === currentId) ?? null;
  const doc = current ?? viewing;
  const canEdit = !!current || !!viewing?.sharedEdit;
  const docs = useRef({ notes, theirs, currentId });
  useEffect(() => { docs.current = { notes, theirs, currentId }; });
  const findDoc = (id: number) => docs.current.notes.find((n) => n.id === id) ?? docs.current.theirs.find((n) => n.id === id) ?? null;
  /** 메모 글·판을 내 목록이든 공유받은 목록이든 바꾼다 */
  const setDoc = useCallback((id: number, patch: { body?: string; version?: number; updatedAt?: string }) => {
    setNotes((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    setTheirs((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

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
    let retry = true;
    try {
      const res = await updateNoteAction(p.id, p.body, base.current.get(p.id));
      if ('error' in res) { failed = res.error; retry = res.code !== 'too_long' && res.code !== 'not_found'; }
      else if (res.body === p.body || pending.current) {
        // 다른 사람이 고친 게 섞였는데 그사이 내가 또 입력했다면, 다음 저장 때 내 입력 기준으로 다시 합친다
        base.current.set(p.id, res.body === p.body ? res : { version: -1, body: p.body });
        setDoc(p.id, { version: res.version });
      } else {
        // 다른 사람이 고친 게 합쳐졌다 → 화면도 그 글로
        base.current.set(p.id, res);
        setDoc(p.id, { body: res.body, version: res.version });
        if (docs.current.currentId === p.id) editor.current?.setText(res.body);
      }
    } catch {
      failed = '저장하지 못했습니다. 인터넷 연결을 확인하세요. 잠시 뒤 다시 저장합니다.';
    }
    saving.current = false;
    if (failed) {
      pending.current ??= p; // 그사이 새로 입력한 글이 없으면 이 글을 다시 저장 대상으로
      setSaveState('error');
      setError(failed);
      if (retry) timer.current = setTimeout(() => { void flush(); }, RETRY_DELAY);
      return false;
    }
    setError(null);
    setSaveState(pending.current ? 'dirty' : 'saved');
    return true;
  }, [setDoc]);

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
    if (!doc || !canEdit) return;
    // 처음 고칠 때의 글이 합칠 때 기준
    if (!base.current.has(doc.id)) base.current.set(doc.id, { version: doc.version, body: doc.body });
    setDoc(doc.id, { body, updatedAt: new Date().toISOString() });
    pending.current = { id: doc.id, body };
    setSaveState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, SAVE_DELAY);
  };

  // 열어 둔 메모: 몇 초마다 내가 어디 있는지 알리고, 같이 보는 사람과 바뀐 내용을 받는다
  useEffect(() => {
    if (currentId === null) return;
    const id = currentId;
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      const d = findDoc(id);
      if (!d) return;
      const known = base.current.get(id)?.version ?? d.version;
      const res = await syncNoteAction(id, editor.current?.caretLine() ?? null, known).catch(() => null);
      if (stop || !res || 'error' in res) return;
      setPeers(res.others);
      // 기다리는 사이 내가 저장했으면 그 판이 더 새로울 수 있다(옛 글로 덮지 않게 다시 확인)
      const latest = base.current.get(id)?.version ?? findDoc(id)?.version ?? known;
      if (res.body !== null && !pending.current && !saving.current && res.version > Math.max(known, latest)) {
        base.current.set(id, { version: res.version, body: res.body });
        setDoc(id, { body: res.body, version: res.version });
        editor.current?.setText(res.body);
      }
      setTheirs((list) => list.map((n) => (n.id === id && n.sharedEdit !== res.edit ? { ...n, sharedEdit: res.edit } : n)));
    };
    void tick();
    const t = setInterval(tick, SYNC_MS);
    return () => { stop = true; clearInterval(t); setPeers([]); void leaveNoteAction(id).catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const select = async (id: number) => {
    if (!(await flush())) return; // 저장 못 한 글이 있으면 다른 메모로 넘어가지 않는다
    setNotes((list) => sortNotes(list));
    setCurrentId(id); setArmed(false); setMobileOpen(true); setError(null);
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
    setCurrentId(res.id); setQuery(''); setArmed(false); setMobileOpen(true);
    setFresh(res.id);
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

  const share = async (ids: number[], shared: boolean, to: number[] = [], canEditToo = false) => {
    if (!ids.length) return;
    if (!(await flush())) return;
    const res = await setNotesSharedAction(ids, shared, to, canEditToo);
    if (res?.error) { setError(res.error); return; }
    setNotes((list) => list.map((n) => (ids.includes(n.id) ? { ...n, shared, sharedEdit: shared && canEditToo, sharedTo: shared ? to : [] } : n)));
    setPicked(new Set()); setPicking(false);
    if (res?.ok) toast(res.ok);
  };

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => (q ? notes.filter((n) => n.body.toLowerCase().includes(q)) : notes), [notes, q]);
  const visibleOthers = q ? theirs.filter((n) => n.body.toLowerCase().includes(q)) : theirs;
  // 공유된 메모(내 것 + 다른 사람 것)는 맨 위에 모아서
  const sharedRows = [
    ...visible.filter((n) => n.shared).map((n) => ({ ...n, author: null as string | null })),
    ...visibleOthers.map((n) => ({ ...n, pinned: false, shared: true, author: n.authorName })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pinned = visible.filter((n) => n.pinned && !n.shared);
  const rest = visible.filter((n) => !n.pinned && !n.shared);
  const pickedMine = notes.filter((n) => picked.has(n.id));
  const shareList = sharing ? notes.filter((n) => sharing.includes(n.id)) : [];

  type Row = { id: number; body: string; updatedAt: string; shared?: boolean; sharedEdit?: boolean; sharedTo?: number[]; author?: string | null };
  const nameOf = new Map(people.map((m) => [m.id, m.name]));
  const live = new Set(peers.map((x) => x.userId));
  const toLabel = (ids: number[]) => {
    if (!ids.length) return '모두';
    const names = ids.map((x) => nameOf.get(x)).filter(Boolean) as string[];
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}명` : names.join(', ');
  };
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
                {n.shared && <span className="nl-by">{n.author ? `${n.author} 님이 공유` : `내가 공유함 · ${toLabel(n.sharedTo ?? [])}`}{n.sharedEdit ? ' · 함께 편집' : ''}</span>}
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
        {notes.length === 0 && theirs.length === 0 ? <p className="nl-empty">메모가 없습니다. &lsquo;새 메모&rsquo;를 눌러 시작하세요.</p>
          : visible.length === 0 && visibleOthers.length === 0 ? <p className="nl-empty">검색 결과가 없습니다</p>
            : <>{group('🔗 공유된 메모', sharedRows)}{group('📌 고정됨', pinned)}{group('메모', rest)}</>}
        {picking && (
          <div className="nl-bar">
            <span>{pickedMine.length ? `${pickedMine.length}개 선택` : '공유할 메모를 고르세요'}</span>
            <button className="btn small" type="button" disabled={!pickedMine.some((n) => n.shared)}
              onClick={() => share(pickedMine.filter((n) => n.shared).map((n) => n.id), false)}>공유 해제</button>
            <button className="btn small primary" type="button" disabled={!pickedMine.length}
              onClick={() => setSharing(pickedMine.map((n) => n.id))}>공유…</button>
          </div>
        )}
      </section>
      <section className="panel note-editor" aria-label="메모 편집">
        <div className="ne-top">
          <button className="ne-back" type="button" onClick={async () => { if (await flush()) setMobileOpen(false); }}>‹ 메모</button>
          <span className="muted ne-date">{doc ? fullFmt.format(new Date(doc.updatedAt)) : ''}</span>
          <span className="spacer" />
          {viewing && peers.length > 0 && (
            <span className="ne-shared-with" title={`지금 보는 중: ${peers.map((x) => x.name).join(', ')}`}>
              {peers.slice(0, 4).map((x) => <span key={x.userId} className="ne-sw-av live"><MiniAvatar name={x.name} size={22} /></span>)}
            </span>
          )}
          {viewing && <span className="muted ne-from">{viewing.authorName} 님이 공유 · {viewing.sharedEdit ? '함께 편집' : '읽기 전용'}</span>}
          {current && <>
            {current.shared && (() => {
              // 공유 받은 사람 프로필. 지금 메모를 보고 있는 사람은 테두리로 표시(모두에게 공유면 보고 있는 사람만)
              const ids = current.sharedTo.length ? current.sharedTo : peers.map((x) => x.userId);
              const shown = [...ids].sort((a, b) => Number(live.has(b)) - Number(live.has(a))).slice(0, 4);
              return (
                <button type="button" className="ne-shared-with" onClick={() => setSharing([current.id])}
                  title={`공유 중 · ${toLabel(current.sharedTo)}${peers.length ? ` · 지금 보는 중: ${peers.map((x) => x.name).join(', ')}` : ''}`}
                  aria-label={`공유 받는 사람: ${toLabel(current.sharedTo)}`}>
                  {current.sharedTo.length === 0 && <span className="ne-all">👥 모두</span>}
                  {shown.map((id) => (
                    <span key={id} className={`ne-sw-av${live.has(id) ? ' live' : ''}`}><MiniAvatar name={nameOf.get(id) ?? peers.find((x) => x.userId === id)?.name ?? '?'} size={22} /></span>
                  ))}
                  {ids.length > 4 && <span className="mc-extra">+{ids.length - 4}</span>}
                </button>
              );
            })()}
            <button className={`btn small${current.shared ? ' soft' : ''}`} type="button" onClick={() => setSharing([current.id])}
              title={current.shared ? `공유 중 · ${toLabel(current.sharedTo)}` : '공유할 사람 고르기'}>{current.shared ? '공유 중' : '공유'}</button>
            <button className="btn small" type="button" onClick={togglePin}>{current.pinned ? '고정 해제' : '고정'}</button>
            <button className="btn small danger" type="button" onClick={remove}>{armed ? '한 번 더 누르면 삭제' : '삭제'}</button>
          </>}
        </div>
        {doc ? (
          <RichEditor id="note-text" key={`${doc.id}-${canEdit}`} ref={editor} initial={doc.body} autoFocus={fresh === doc.id} readOnly={!canEdit}
            onChange={edit} onBlur={() => { void flush(); }}
            marks={peers.filter((x) => x.line !== null).map((x) => ({ key: x.userId, name: x.name, line: x.line! }))}
            placeholder={canEdit ? '첫 줄이 메모 제목이 됩니다' : ''} ariaLabel={canEdit ? '메모 내용' : '공유된 메모 내용'} />
        ) : <p className="nl-empty">{creating ? '새 메모를 만드는 중…' : '왼쪽에서 메모를 고르거나 새 메모를 만드세요.'}</p>}
        {doc && canEdit && <FormatBar onApply={(k) => editor.current?.apply(k)} />}
        <div className="ne-foot">
          <span className="muted" role="status">
            {saveState === 'saving' ? '저장 중…' : saveState === 'dirty' ? '입력 중…' : saveState === 'error' ? `저장하지 못했습니다 · ${error ?? ''}` : '자동 저장됨'}
          </span>
          {doc && <span className="muted">{doc.body.length.toLocaleString()}자</span>}
          {error && saveState !== 'error' && <span className="err">{error}</span>}
        </div>
      </section>
      {sharing && (
        <ShareDialog count={shareList.length} people={people} initial={shareList.length === 1 ? shareList[0].sharedTo : []}
          initialEdit={shareList.length === 1 && shareList[0].sharedEdit}
          wasShared={shareList.some((n) => n.shared)} onClose={() => setSharing(null)}
          onShare={(to, canEditToo) => { void share(sharing, true, to, canEditToo); }} onUnshare={() => { void share(sharing, false); }} />
      )}
    </div>
  );
}

const TOOLS: { key: FormatKey; label: string; icon: React.ReactNode }[] = [
  { key: 'b', label: '굵게', icon: <b>B</b> },
  { key: 'i', label: '기울임', icon: <i style={{ fontFamily: 'Georgia, serif' }}>I</i> },
  { key: 'u', label: '밑줄', icon: <u>U</u> },
  { key: 's', label: '취소선', icon: <s>S</s> },
  { key: 'code', label: '코드', icon: <span className="fmt-mono">&lt;/&gt;</span> },
  { key: 'ol', label: '번호 목록', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M7 4h7M7 8h7M7 12h7" /><text x="1" y="6" fontSize="5.5" fill="currentColor" stroke="none" fontWeight="700">1</text>
      <text x="1" y="14" fontSize="5.5" fill="currentColor" stroke="none" fontWeight="700">2</text></svg>
  ) },
  { key: 'ul', label: '글머리표', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M7 4h7M7 8h7M7 12h7" /><g fill="currentColor" stroke="none"><circle cx="2.8" cy="4" r="1.3" /><circle cx="2.8" cy="8" r="1.3" /><circle cx="2.8" cy="12" r="1.3" /></g></svg>
  ) },
  { key: 'todo', label: '체크리스트', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2" width="5" height="5" rx="1.2" /><path d="m2.6 4.6 1 1 1.8-2" /><rect x="1.5" y="9" width="5" height="5" rx="1.2" /><path d="M9 4.5h5.5M9 11.5h5.5" /></svg>
  ) },
  { key: 'q', label: '인용', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 2.5v11M7 5h7M7 8h7M7 11h5" /></svg>
  ) },
  { key: 'pre', label: '코드 블록', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="M6 6.5 4.5 8 6 9.5M10 6.5 11.5 8 10 9.5" strokeLinecap="round" /></svg>
  ) },
];

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const noSub = () => () => {};
const keyLabel = (key: FormatKey, mac: boolean) => {
  const k = SHORTCUTS.find((x) => x.key === key);
  if (!k) return '';
  const c = k.code.replace(/^Key|^Digit/, '');
  return mac ? `${k.alt ? '⌥' : ''}${k.shift ? '⇧' : ''}⌘${c}` : `Ctrl+${k.alt ? 'Alt+' : ''}${k.shift ? 'Shift+' : ''}${c}`;
};

/** 슬랙처럼 편집 칸 아래의 서식 버튼 줄. 누르는 동안 편집 칸 포커스를 뺏지 않는다 */
function FormatBar({ onApply }: { onApply: (key: FormatKey) => void }) {
  // 맥이면 ⌘, 아니면 Ctrl로 안내(서버에서는 Ctrl로 그렸다가 브라우저에서 맞춘다)
  const mac = useSyncExternalStore(noSub, isMac, () => false);
  return (
    <div className="fmt-bar" role="toolbar" aria-label="서식">
      {TOOLS.map((t, i) => (
        <span key={t.key} className="fmt-wrap">
          {(i === 5 || i === 8) && <span className="fmt-sep" aria-hidden />}
          <button type="button" className="fmt-btn" aria-label={t.label} title={keyLabel(t.key, mac) ? `${t.label} (${keyLabel(t.key, mac)})` : t.label}
            onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={() => onApply(t.key)}>{t.icon}</button>
        </span>
      ))}
    </div>
  );
}
