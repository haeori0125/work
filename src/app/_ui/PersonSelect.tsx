'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { MiniAvatar } from './AvatarContext';

type Option = { id: number; name: string };
type Props = { value: number | null; options: Option[]; onChange: (id: number | null) => void; label: string; emptyLabel?: string };

/** 담당자 고르기: 기본 드롭다운 대신 프로필 사진이 보이는 목록(키보드 ↑↓ Enter Esc) */
export function PersonSelect({ value, options, onChange, label, emptyLabel = '담당 없음' }: Props) {
  const [open, setOpen] = useState(false);
  const all: (Option | null)[] = [null, ...options];
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const show = () => { setActive(Math.max(0, all.findIndex((o) => (o?.id ?? null) === value))); setOpen(true); };
  const pick = (o: Option | null) => { onChange(o?.id ?? null); setOpen(false); button.current?.focus(); };

  return (
    <div className="psel" ref={box}>
      <button ref={button} type="button" className={`psel-btn${open ? ' open' : ''}`} aria-label={label} aria-haspopup="listbox"
        aria-expanded={open} aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); show(); return; }
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(all.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(all[active]); }
          else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false);
        }}>
        {current ? <><MiniAvatar name={current.name} size={20} /><span className="psel-name">{current.name}</span></> : <span className="psel-name muted">{emptyLabel}</span>}
        <svg className="psel-caret" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="psel-list" role="listbox" id={listId} aria-label={label}>
          {all.map((o, i) => {
            const selected = (o?.id ?? null) === value;
            return (
              <li key={o?.id ?? 'none'} role="option" aria-selected={selected} className={i === active ? 'active' : undefined}
                onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}>
                {o ? <><MiniAvatar name={o.name} size={20} /><span>{o.name}</span></> : <span className="muted">{emptyLabel}</span>}
                {selected && (
                  <svg className="psel-check" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2.2 6.3 4.8 8.8 9.8 3.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
