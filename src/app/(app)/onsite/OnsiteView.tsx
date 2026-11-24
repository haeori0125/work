'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { copyBaseAction, setBaseCellAction, setChangeAction } from '@/app/actions/onsite';
import type { ActionResult } from '@/app/actions/result';
import { MiniAvatar, Person } from '@/app/_ui/AvatarContext';
import { useToast } from '@/app/_ui/Toast';
import { SLOTS, type BaseWeek, type Change, type OnsiteDay, type Slot } from '@/lib/onsite-shared';
import { kstWeekday } from '@/lib/time';

type Day = OnsiteDay & { inMonth: boolean; label: string };
type Props = {
  me: { id: number; role: 'member' | 'admin' };
  view: 'cal' | 'changes' | 'base'; today: string;
  month: string; monthTitle: string; prevMonth: string; nextMonth: string; isThisMonth: boolean;
  weekdays: string[]; days: Day[]; changes: (Change & { label: string })[]; members: { id: number; name: string }[];
  term: string; termTitle: string; prevTerm: string; nextTerm: string; prevTermTitle: string; base: BaseWeek;
};

const SLOT = Object.fromEntries(SLOTS.map((s) => [s.key, s])) as Record<Slot, (typeof SLOTS)[number]>;
const WD_MON = ['월', '화', '수', '목', '금', '토', '일'];

/** 현장 수업: 달력(실제 출근) · 변동 사항 · 기본 스케줄 */
export function OnsiteView(p: Props) {
  const isAdmin = p.me.role === 'admin';
  const q = (o: { month?: string; term?: string; view?: string }) => {
    const s = new URLSearchParams();
    const month = o.month ?? p.month, term = o.term ?? p.term, view = o.view ?? p.view;
    if (month) s.set('month', month);
    if (o.term || p.view === 'base') s.set('term', term);
    if (view !== 'cal') s.set('view', view);
    return `/onsite?${s}`;
  };
  return (
    <section className="panel os" aria-label="현장 수업">
      <div className="panel-head os-head">
        <h2>현장 수업</h2>
        <nav className="os-tabs" aria-label="보기">
          <Link href={q({ view: 'cal' })} aria-current={p.view === 'cal' ? 'page' : undefined} scroll={false}>달력</Link>
          <Link href={q({ view: 'changes' })} aria-current={p.view === 'changes' ? 'page' : undefined} scroll={false}>변동 사항</Link>
          <Link href={q({ view: 'base' })} aria-current={p.view === 'base' ? 'page' : undefined} scroll={false}>기본 스케줄</Link>
        </nav>
        <span className="os-legend">{SLOTS.map((s) => <span key={s.key} className={`os-slotname ${s.key}`}>{s.label} {s.time}</span>)}</span>
      </div>
      {p.view === 'cal' && <CalendarView {...p} isAdmin={isAdmin} q={q} />}
      {p.view === 'changes' && <ChangesView {...p} isAdmin={isAdmin} q={q} />}
      {p.view === 'base' && <BaseView {...p} isAdmin={isAdmin} q={q} />}
    </section>
  );
}

type ViewProps = Props & { isAdmin: boolean; q: (o: { month?: string; term?: string; view?: string }) => string };

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const run = (fn: () => Promise<ActionResult>, ok?: string) => start(async () => {
    const res = await fn();
    setError(res?.error ?? null);
    if (!res?.error && ok) toast(ok);
  });
  return { pending, error, run };
}

function MonthNav({ q, monthTitle, prevMonth, nextMonth, isThisMonth }: ViewProps) {
  return (
    <div className="nav-group">
      <div className="week-nav">
        <Link className="arrow" href={q({ month: prevMonth })} scroll={false} aria-label="지난달">‹</Link>
        <span className="sub">{monthTitle}</span>
        <Link className="arrow" href={q({ month: nextMonth })} scroll={false} aria-label="다음 달">›</Link>
      </div>
      {!isThisMonth && <Link className="btn small soft" href={q({ month: '' })} scroll={false}>이번 달</Link>}
    </div>
  );
}

function Faces({ people, max = 4 }: { people: { id: number; name: string; added?: boolean }[]; max?: number }) {
  return (
    <span className="av-stack os-faces">
      {people.slice(0, max).map((x) => <span key={x.id} className={x.added ? 'os-added' : undefined}><MiniAvatar name={x.name} size={18} /></span>)}
      {people.length > max && <span className="os-more">+{people.length - max}</span>}
    </span>
  );
}

function CalendarView(p: ViewProps) {
  const { days, me, isAdmin } = p;
  const firstPick = days.find((d) => d.date === p.today)?.date ?? days.find((d) => d.inMonth)!.date;
  const [picked, setPicked] = useState(firstPick);
  const shown = days.some((d) => d.date === picked) ? picked : firstPick;
  const day = days.find((d) => d.date === shown)!;
  const mine = (d: Day) => d.slots.some((s) => s.staff.some((x) => x.id === me.id));
  const myCount = days.filter((d) => d.inMonth).reduce((n, d) => n + d.slots.filter((s) => s.staff.some((x) => x.id === me.id)).length, 0);

  return (
    <div className="os-body">
      <div className="os-bar">
        <MonthNav {...p} />
        {!isAdmin && <span className="os-mine">이번 달 내 출근 <b>{myCount}회</b></span>}
      </div>
      <div className="os-layout">
        <div className="mc-grid os-grid" role="grid" aria-label={p.monthTitle}>
          {p.weekdays.map((w) => <div key={w} className={`mc-wd${w === '일' ? ' sun' : w === '토' ? ' sat' : ''}`} role="columnheader">{w}</div>)}
          {days.map((d) => {
            const wd = kstWeekday(d.date);
            const changed = d.slots.some((s) => s.off.length || s.staff.some((x) => x.added));
            return (
              <button key={d.date} type="button" role="gridcell" onClick={() => setPicked(d.date)}
                className={`mc-cell os-cell${d.inMonth ? '' : ' out'}${d.date === p.today ? ' today' : ''}${d.date === shown ? ' picked' : ''}${mine(d) ? ' mine' : ''}`}
                aria-label={`${d.label} ${d.slots.map((s) => `${SLOT[s.slot].label} ${s.staff.length}명`).join(', ')}`}>
                <span className={`mc-num${wd === 6 ? ' sun' : wd === 5 ? ' sat' : ''}`}>{Number(d.date.slice(8))}{changed && <i className="os-dot" aria-hidden />}</span>
                {d.slots.map((s) => s.staff.length > 0 && (
                  <span key={s.slot} className={`os-line ${s.slot}`}><span className="os-k">{SLOT[s.slot].label}</span><Faces people={s.staff} /></span>
                ))}
              </button>
            );
          })}
        </div>
        <DayPanel key={day.date} day={day} members={p.members} isAdmin={isAdmin} me={me} />
      </div>
    </div>
  );
}

function DayPanel({ day, members, isAdmin, me }: { day: Day; members: { id: number; name: string }[]; isAdmin: boolean; me: { id: number } }) {
  const { pending, error, run } = useRun();
  const [editing, setEditing] = useState(false);
  const notes = Object.fromEntries(day.slots.flatMap((s) => s.off.map((o) => [`${s.slot}-${o.id}`, o.note ?? ''])));
  const [draft, setDraft] = useState<Record<string, string>>(notes);
  const change = (slot: Slot, userId: number, kind: 'off' | 'on' | null, note?: string | null, ok = '저장되었습니다') =>
    run(() => setChangeAction({ date: day.date, slot, userId, kind, note }), ok);

  return (
    <aside className="os-day" aria-label={`${day.label} 출근`}>
      <div className="os-day-head">
        <b>{day.label}</b>
        {isAdmin && <button type="button" className="btn small" onClick={() => setEditing(!editing)}>{editing ? '완료' : '변동 입력'}</button>}
      </div>
      {day.slots.map((s) => {
        const base = new Set([...s.staff.filter((x) => !x.added).map((x) => x.id), ...s.off.map((x) => x.id)]);
        return (
          <div key={s.slot} className={`os-slot ${s.slot}`}>
            <div className="os-slot-head"><span className={`os-slotname ${s.slot}`}>{SLOT[s.slot].label}</span><span className="muted">{SLOT[s.slot].time}</span></div>
            {!editing && (
              <>
                {s.staff.length === 0 && s.off.length === 0 && <p className="muted os-none">수업 없음</p>}
                <ul className="os-people">
                  {s.staff.map((x) => (
                    <li key={x.id} className={x.id === me.id ? 'me' : undefined}><Person name={x.name} size={20} />{x.added && <span className="os-badge on">추가</span>}</li>
                  ))}
                  {s.off.map((x) => (
                    <li key={x.id} className="off"><Person name={x.name} size={20} /><span className="os-badge off">빠짐</span>{x.note && <span className="muted os-note">{x.note}</span>}</li>
                  ))}
                </ul>
              </>
            )}
            {editing && (
              <>
                <div className="os-pick">
                  {members.map((m) => {
                    const inBase = base.has(m.id);
                    const isOff = s.off.some((x) => x.id === m.id);
                    const isOn = s.staff.some((x) => x.id === m.id && x.added);
                    const state = inBase ? (isOff ? 'off' : 'base') : isOn ? 'on' : 'none';
                    const next = state === 'base' ? 'off' : state === 'none' ? 'on' : null;
                    return (
                      <button key={m.id} type="button" className={`os-chip ${state}`} disabled={pending}
                        title={{ base: '누르면 빠짐', off: '누르면 다시 출근', on: '누르면 추가 취소', none: '누르면 추가 출근' }[state]}
                        onClick={() => change(s.slot, m.id, next, null, { off: '빠짐으로 바꿨습니다', on: '추가 출근으로 바꿨습니다', null: '기본대로 돌렸습니다' }[String(next) as 'off' | 'on' | 'null'])}>
                        <Person name={m.name} size={18} />
                        {state === 'off' && <span className="os-badge off">빠짐</span>}
                        {state === 'on' && <span className="os-badge on">추가</span>}
                      </button>
                    );
                  })}
                </div>
                {[...s.off, ...s.staff.filter((x) => x.added)].map((x) => {
                  const k = `${s.slot}-${x.id}`;
                  const kind = s.off.some((o) => o.id === x.id) ? 'off' : 'on';
                  return (
                    <form key={k} className="os-memo" onSubmit={(e) => { e.preventDefault(); change(s.slot, x.id, kind, draft[k] ?? ''); }}>
                      <span>{x.name} {kind === 'off' ? '빠짐' : '추가'}</span>
                      <input value={draft[k] ?? ''} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} placeholder="사유 (선택)" maxLength={100} aria-label={`${x.name} 사유`} />
                      <button className="btn small" disabled={pending}>저장</button>
                    </form>
                  );
                })}
              </>
            )}
          </div>
        );
      })}
      {editing && <p className="help">기본 스케줄인 사람을 누르면 빠짐, 아닌 사람을 누르면 추가 출근이 돼요. 한 번 더 누르면 되돌려요.</p>}
      {error && <p className="msg error">{error}</p>}
    </aside>
  );
}

function ChangesView(p: ViewProps) {
  const { pending, error, run } = useRun();
  const [onlyMine, setOnlyMine] = useState(false);
  const list = p.changes.filter((c) => !onlyMine || c.user.id === p.me.id);
  return (
    <div className="os-body">
      <div className="os-bar">
        <MonthNav {...p} />
        <label className="os-only"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> 내 것만</label>
      </div>
      <p className="help">기본 스케줄과 다르게 빠지거나 추가로 나오는 날만 모아서 보여요.</p>
      {list.length === 0 ? <p className="empty">이번 달 변동 사항이 없습니다</p> : (
        <ul className="os-changes">
          {list.map((c) => (
            <li key={c.id}>
              <span className="os-c-date">{c.label}</span>
              <span className={`os-slotname ${c.slot}`}>{SLOT[c.slot].label}</span>
              <Person name={c.user.name} size={20} />
              <span className={`os-badge ${c.kind}`}>{c.kind === 'off' ? '빠짐' : '추가'}</span>
              {c.note && <span className="muted os-note">{c.note}</span>}
              {p.isAdmin && (
                <button type="button" className="btn small" disabled={pending}
                  onClick={() => run(() => setChangeAction({ date: c.date, slot: c.slot, userId: c.user.id, kind: null }), '기본대로 돌렸습니다')}>되돌리기</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="msg error">{error}</p>}
    </div>
  );
}

function BaseView(p: ViewProps) {
  const { pending, error, run } = useRun();
  const [cell, setCell] = useState<{ wd: number; slot: Slot } | null>(null);
  const empty = Object.values(p.base).every((w) => SLOTS.every((s) => w[s.key].length === 0));
  const people = cell ? p.base[cell.wd][cell.slot] : [];
  const toggle = (id: number) => {
    if (!cell) return;
    const ids = people.some((x) => x.id === id) ? people.filter((x) => x.id !== id).map((x) => x.id) : [...people.map((x) => x.id), id];
    run(() => setBaseCellAction(p.term, cell.wd, cell.slot, ids));
  };
  return (
    <div className="os-body">
      <div className="os-bar">
        <div className="nav-group">
          <div className="week-nav">
            <Link className="arrow" href={p.q({ term: p.prevTerm })} scroll={false} aria-label="이전 기간">‹</Link>
            <span className="sub">{p.termTitle}</span>
            <Link className="arrow" href={p.q({ term: p.nextTerm })} scroll={false} aria-label="다음 기간">›</Link>
          </div>
        </div>
        {p.isAdmin && (
          <button type="button" className="btn small" disabled={pending}
            onClick={() => { if (empty || confirm(`${p.termTitle} 기본 스케줄을 ${p.prevTermTitle} 것으로 바꿀까요?`)) run(() => copyBaseAction(p.prevTerm, p.term), '복사했습니다'); }}>
            {p.prevTermTitle} 복사해 오기
          </button>
        )}
      </div>
      <p className="help">이 기간 동안 매주 반복되는 출근이에요. {p.isAdmin ? '칸을 누르면 사람을 고를 수 있어요.' : ''}</p>
      <div className="os-base-wrap">
        <table className="os-base">
          <thead><tr><th />{WD_MON.map((w, i) => <th key={w} className={i === 6 ? 'sun' : i === 5 ? 'sat' : undefined}>{w}</th>)}</tr></thead>
          <tbody>
            {SLOTS.map((s) => (
              <tr key={s.key}>
                <th><span className={`os-slotname ${s.key}`}>{s.label}</span><small>{s.time}</small></th>
                {WD_MON.map((w, wd) => {
                  const list = p.base[wd][s.key];
                  const on = cell?.wd === wd && cell.slot === s.key;
                  return (
                    <td key={w} className={on ? 'on' : undefined}>
                      {p.isAdmin ? (
                        <button type="button" className="os-base-cell" onClick={() => setCell(on ? null : { wd, slot: s.key })} aria-pressed={on}
                          aria-label={`${w}요일 ${s.label} ${list.map((x) => x.name).join(', ') || '없음'}`}>
                          {list.length ? list.map((x) => <Person key={x.id} name={x.name} size={18} />) : <span className="muted">—</span>}
                        </button>
                      ) : (
                        <div className="os-base-cell">{list.length ? list.map((x) => <Person key={x.id} name={x.name} size={18} />) : <span className="muted">—</span>}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cell && p.isAdmin && (
        <div className="os-cell-edit">
          <b>{WD_MON[cell.wd]}요일 {SLOT[cell.slot].label}</b> <span className="muted">{SLOT[cell.slot].time} · 누를 때마다 바로 저장돼요</span>
          <div className="os-pick">
            {p.members.map((m) => {
              const sel = people.some((x) => x.id === m.id);
              return (
                <button key={m.id} type="button" className={`os-chip ${sel ? 'base' : 'none'}`} aria-pressed={sel} disabled={pending} onClick={() => toggle(m.id)}>
                  <Person name={m.name} size={18} />
                </button>
              );
            })}
          </div>
        </div>
      )}
      {error && <p className="msg error">{error}</p>}
    </div>
  );
}
