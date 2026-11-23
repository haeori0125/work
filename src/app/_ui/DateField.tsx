'use client';

import { useEffect, useRef, useState } from 'react';
import { shiftMonth } from '@/lib/month';
import { addDays, kstDate, kstWeekday, weekStartOf } from '@/lib/time';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const WD_MON = ['월', '화', '수', '목', '금', '토', '일'];

type Props = {
  name: string;
  defaultValue?: string | null;
  /** 비울 수 있는 칸이면 '지우기'가 생긴다 */
  optional?: boolean;
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
};

function label(date: string, today: string) {
  const [y, m, d] = date.split('-').map(Number);
  const md = `${m}월 ${d}일 (${WD_MON[kstWeekday(date)]})`;
  return y === Number(today.slice(0, 4)) ? md : `${y}년 ${md}`;
}

/** 날짜 고르기: 기본 달력 대신 사이트 모양 달력. 값은 숨은 칸(name)으로 폼에 실린다 */
export function DateField({ name, defaultValue, optional = false, placeholder = '날짜 고르기', id, ...rest }: Props) {
  const [today] = useState(() => kstDate(new Date()));
  const [value, setValue] = useState(defaultValue || '');
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((defaultValue || today).slice(0, 7));
  const [focus, setFocus] = useState(defaultValue || today);
  const box = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  // 키보드로 움직이면 그 날짜 칸에 초점
  useEffect(() => {
    if (open) grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus();
  }, [open, focus]);

  const show = () => { const f = value || today; setFocus(f); setMonth(f.slice(0, 7)); setOpen(true); };
  const pick = (d: string) => { setValue(d); setOpen(false); button.current?.focus(); };
  const move = (d: string) => { setFocus(d); setMonth(d.slice(0, 7)); };
  const start = weekStartOf(`${month}-01`, 'sun');
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));

  return (
    <div className="dfield" ref={box}>
      <input type="hidden" name={name} value={value} />
      <button ref={button} id={id} type="button" className={`dfield-btn${open ? ' open' : ''}`} aria-haspopup="dialog" aria-expanded={open}
        aria-label={rest['aria-label'] ? `${rest['aria-label']} ${value ? label(value, today) : '없음'}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}>
        <span className={value ? undefined : 'muted'}>{value ? label(value, today) : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2.5" y="3.5" width="11" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="dpop" role="dialog" aria-label="날짜 고르기"
          onKeyDown={(e) => {
            const k: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
            if (k[e.key] !== undefined) { e.preventDefault(); move(addDays(focus, k[e.key])); }
            else if (e.key === 'PageUp' || e.key === 'PageDown') {
              e.preventDefault();
              const m = shiftMonth(focus.slice(0, 7), e.key === 'PageUp' ? -1 : 1);
              move(`${m}-${String(Math.min(Number(focus.slice(8)), 28)).padStart(2, '0')}`);
            } else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); button.current?.focus(); }
          }}>
          <div className="dpop-head">
            <b>{Number(month.slice(0, 4))}년 {Number(month.slice(5))}월</b>
            <button type="button" className="dpop-nav" aria-label="지난달" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <button type="button" className="dpop-nav" aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </div>
          <div className="dpop-grid" ref={grid} role="grid">
            {WD.map((w) => <span key={w} className={`dpop-wd${w === '일' ? ' sun' : w === '토' ? ' sat' : ''}`}>{w}</span>)}
            {days.map((d) => {
              const wd = kstWeekday(d);
              return (
                <button key={d} type="button" data-date={d} tabIndex={d === focus ? 0 : -1}
                  className={`dpop-day${d.slice(0, 7) !== month ? ' out' : ''}${d === today ? ' today' : ''}${d === value ? ' on' : ''}${wd === 6 ? ' sun' : wd === 5 ? ' sat' : ''}`}
                  aria-label={label(d, today)} aria-pressed={d === value} onClick={() => pick(d)}>
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>
          <div className="dpop-foot">
            {optional && value ? <button type="button" className="btn link small" onClick={() => { setValue(''); setOpen(false); }}>지우기</button> : <span />}
            <button type="button" className="btn link small" onClick={() => pick(today)}>오늘</button>
          </div>
        </div>
      )}
    </div>
  );
}
