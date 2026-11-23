'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { savePrefsAction } from '@/app/actions/prefs';
import { Person } from '@/app/_ui/AvatarContext';
import { FilterIcon } from '@/app/_ui/icons';
import { NO_ASSIGNEE } from '@/lib/view';

type Props = {
  members: string[];
  filter: string[] | null;
  saved: string[] | null;
  onChange: (f: string[] | null) => void;
  onSaved: (f: string[] | null) => void;
};

const same = (a: string[] | null, b: string[] | null) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((x) => b.includes(x)));

/** 위클리 카드 오른쪽 위 필터 아이콘 + 고르는 창 */
export function WeekFilter({ members, filter, saved, onChange, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  const toggle = (name: string) => {
    const cur = filter ?? [];
    const next = cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name];
    onChange(next.length ? next : null);
    setMsg(null);
  };
  const save = () => start(async () => {
    const res = await savePrefsAction({ weekFilter: filter });
    if (res?.error) { setMsg(res.error); return; }
    onSaved(filter); setMsg('저장했습니다');
  });
  const count = filter?.length ?? 0;
  const options = [...members, NO_ASSIGNEE];

  return (
    <div className="wf" ref={box}>
      <button type="button" className={`wf-btn${count ? ' on' : ''}`} aria-expanded={open} aria-label={count ? `담당 필터 ${count}명` : '담당 필터'}
        title="담당 필터" onClick={() => setOpen(!open)}>
        <FilterIcon />{count > 0 && <span className="wf-count">{count}</span>}
      </button>
      {open && (
        <div className="wf-pop" role="dialog" aria-label="담당 필터">
          <div className="wf-head"><b>담당 필터</b><span className="muted">고른 사람의 업무만 보여요</span></div>
          <div className="wf-opts">
            <button type="button" className="wf-opt" aria-pressed={filter === null} onClick={() => { onChange(null); setMsg(null); }}>전체</button>
            {options.map((n) => (
              <button key={n} type="button" className="wf-opt" aria-pressed={!!filter?.includes(n)} onClick={() => toggle(n)}>
                {n === NO_ASSIGNEE ? n : <Person name={n} size={18} />}
              </button>
            ))}
          </div>
          <div className="wf-foot">
            <span className="muted">{msg ?? (same(filter, saved) ? '저장된 필터예요' : '저장하지 않으면 새로고침할 때 돌아가요')}</span>
            <button type="button" className="btn primary small" disabled={pending || same(filter, saved)} onClick={save}>필터 저장</button>
          </div>
        </div>
      )}
    </div>
  );
}
