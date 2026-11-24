'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { MiniAvatar } from './AvatarContext';

type Option = { id: number; name: string };
type Props = { value: number[]; options: Option[]; onChange: (ids: number[]) => void; label: string; emptyLabel?: string };

/** 여러 사람 고르기: 프로필 사진이 보이는 목록에서 누를 때마다 체크/해제(목록은 열린 채로) */
export function PersonMultiSelect({ value, options, onChange, label, emptyLabel = '고르기' }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const picked = options.filter((o) => value.includes(o.id));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="psel" ref={box}>
      <button type="button" className={`psel-btn${open ? ' open' : ''}`} aria-label={label} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined} onClick={() => { setActive(0); setOpen(!open); }}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); return; }
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[active]) toggle(options[active].id); }
          else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false);
        }}>
        {picked.length ? (
          <>
            <span className="av-stack">{picked.slice(0, 3).map((x) => <MiniAvatar key={x.id} name={x.name} size={20} />)}</span>
            <span className="psel-name">{picked.length > 2 ? `${picked[0].name} 외 ${picked.length - 1}명` : picked.map((x) => x.name).join(', ')}</span>
          </>
        ) : <span className="psel-name muted">{emptyLabel}</span>}
        <svg className="psel-caret" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="psel-list" role="listbox" aria-multiselectable="true" id={listId} aria-label={label}>
          {options.length === 0 && <li className="muted psel-empty" role="presentation">고를 사람이 없어요</li>}
          {options.map((o, i) => {
            const on = value.includes(o.id);
            return (
              <li key={o.id} role="option" aria-selected={on} className={i === active ? 'active' : undefined}
                onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => toggle(o.id)}>
                <span className={`psel-box${on ? ' on' : ''}`} aria-hidden>
                  {on && <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2.2 6.3 4.8 8.8 9.8 3.4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                <MiniAvatar name={o.name} size={20} /><span>{o.name}</span>
              </li>
            );
          })}
          <li className="psel-done" role="presentation"><button type="button" className="btn small" onClick={() => setOpen(false)}>완료</button></li>
        </ul>
      )}
    </div>
  );
}
