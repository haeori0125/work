'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { saveChangeAction, setChangeAction } from '@/app/actions/onsite';
import type { ActionResult } from '@/app/actions/result';
import { MiniAvatar, Person } from '@/app/_ui/AvatarContext';
import { PersonSelect } from '@/app/_ui/PersonSelect';
import { useToast } from '@/app/_ui/Toast';
import { SLOTS, SLOT_INFO, type Change, type DayLecture, type OnsiteDay } from '@/lib/onsite-shared';
import { kstWeekday } from '@/lib/time';

type Day = OnsiteDay & { inMonth: boolean; label: string };
type Props = {
  me: { id: number; role: 'member' | 'admin' };
  view: 'cal' | 'changes'; today: string;
  month: string; monthTitle: string; prevMonth: string; nextMonth: string; isThisMonth: boolean;
  weekdays: string[]; days: Day[]; changes: (Change & { label: string })[]; members: { id: number; name: string }[];
};

/** 현장 수업: 달력(강의별 실제 출근) · 변동 사항 */
export function OnsiteView(p: Props) {
  const isAdmin = p.me.role === 'admin';
  const q = (o: { month?: string; view?: string }) => {
    const s = new URLSearchParams();
    const month = o.month ?? p.month, view = o.view ?? p.view;
    if (month) s.set('month', month);
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
        </nav>
        <span className="os-legend">{SLOTS.map((s) => <span key={s.key}>{s.label} {s.time}</span>)}</span>
      </div>
      {p.view === 'cal' && <CalendarView {...p} isAdmin={isAdmin} q={q} />}
      {p.view === 'changes' && <ChangesView {...p} isAdmin={isAdmin} q={q} />}
    </section>
  );
}

type ViewProps = Props & { isAdmin: boolean; q: (o: { month?: string; view?: string }) => string };

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
  const mine = (d: Day) => d.lectures.some((l) => l.staff.some((x) => x.id === me.id));
  const myCount = days.filter((d) => d.inMonth).reduce((n, d) => n + d.lectures.filter((l) => l.staff.some((x) => x.id === me.id)).length, 0);

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
            const changed = d.lectures.some((l) => l.off.length || l.staff.some((x) => x.added));
            return (
              <button key={d.date} type="button" role="gridcell" onClick={() => setPicked(d.date)}
                className={`mc-cell os-cell${d.inMonth ? '' : ' out'}${d.date === p.today ? ' today' : ''}${d.date === shown ? ' picked' : ''}${mine(d) ? ' mine' : ''}`}
                aria-label={`${d.label} ${d.lectures.map((l) => `${l.title} ${l.staff.length ? `${l.staff.length}명` : '미배정'}`).join(', ')}`}>
                <span className={`mc-num${wd === 6 ? ' sun' : wd === 5 ? ' sat' : ''}`}>{Number(d.date.slice(8))}{changed && <i className="os-dot" aria-hidden />}</span>
                {d.lectures.map((l) => (
                  <span key={l.lectureId} className={`os-line${l.staff.length ? '' : ' empty'}`}>
                    <span className="os-k">{l.title}</span>
                    {l.staff.length ? <Faces people={l.staff} /> : <span className="os-unset">미배정</span>}
                  </span>
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
  const [editing, setEditing] = useState(false);
  return (
    <aside className="os-day" aria-label={`${day.label} 출근`}>
      <div className="os-day-head">
        <b>{day.label}</b>
        {isAdmin && day.lectures.length > 0 && <button type="button" className="btn small" onClick={() => setEditing(!editing)}>{editing ? '완료' : '변동 입력'}</button>}
      </div>
      {day.lectures.length === 0 && <p className="muted os-none">이 날은 현장 강의가 없어요</p>}
      {day.lectures.map((l) => <LectureDay key={l.lectureId} date={day.date} lec={l} members={members} editing={editing} me={me} />)}
      {editing && <p className="help">빠지는 사람만 고르면 빠짐, 대신 나오는 사람만 고르면 추가 출근으로 남아요.</p>}
    </aside>
  );
}

function LectureDay({ date, lec, members, editing, me }: { date: string; lec: DayLecture; members: { id: number; name: string }[]; editing: boolean; me: { id: number } }) {
  const { pending, error, run } = useRun();
  const slot = SLOT_INFO[lec.slot];
  const added = lec.staff.filter((x) => x.added);
  return (
    <div className="os-slot">
      <div className="os-slot-head"><b>{lec.title}</b><span className="muted">{slot.label} {slot.time}</span></div>
      {lec.staff.length === 0 && lec.off.length === 0 && <p className="muted os-none">아직 출근할 사람이 없어요</p>}
      <ul className="os-people">
        {lec.staff.map((x) => (
          <li key={x.id} className={x.id === me.id ? 'me' : undefined}><Person name={x.name} size={20} />{x.added && <span className="os-badge on">추가</span>}</li>
        ))}
        {lec.off.map((x) => (
          <li key={x.id} className="off"><Person name={x.name} size={20} /><span className="os-badge off">빠짐</span>{x.note && <span className="muted os-note">{x.note}</span>}</li>
        ))}
      </ul>
      {editing && (
        <>
          {(lec.off.length > 0 || added.length > 0) && (
            <ul className="os-undo">
              {[...lec.off.map((x) => ({ ...x, kind: 'off' as const })), ...added.map((x) => ({ ...x, kind: 'on' as const }))].map((x) => (
                <li key={`${x.kind}-${x.id}`}>
                  <span>{x.name} {x.kind === 'off' ? '빠짐' : '추가'}</span>
                  <button type="button" className="btn link small" disabled={pending}
                    onClick={() => run(() => setChangeAction({ lectureId: lec.lectureId, date, userId: x.id, kind: null }), '되돌렸습니다')}>되돌리기</button>
                </li>
              ))}
            </ul>
          )}
          <ChangeForm date={date} lec={lec} members={members} />
        </>
      )}
      {error && <p className="msg error">{error}</p>}
    </div>
  );
}

/** 변동 입력: 빠지는 사람 ▾ · 대신 나오는 사람 ▾ · 사유 */
function ChangeForm({ date, lec, members }: { date: string; lec: DayLecture; members: { id: number; name: string }[] }) {
  const { pending, error, run } = useRun();
  const [off, setOff] = useState<number | null>(null);
  const [on, setOn] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const working = new Set(lec.staff.map((x) => x.id));
  const offOptions = lec.staff.filter((x) => !x.added);
  const onOptions = members.filter((m) => !working.has(m.id) && !lec.off.some((x) => x.id === m.id));
  return (
    <form className="os-change" onSubmit={(e) => {
      e.preventDefault();
      run(() => saveChangeAction({ lectureId: lec.lectureId, date, offUserId: off, onUserId: on, note }), '변동을 저장했습니다');
      setOff(null); setOn(null); setNote('');
    }}>
      <div className="os-change-row">
        <div className="field"><span>빠지는 사람</span><PersonSelect value={off} options={offOptions} onChange={setOff} label={`${lec.title} 빠지는 사람`} emptyLabel="없음" /></div>
        <span className="os-arrow" aria-hidden>→</span>
        <div className="field"><span>대신 나오는 사람</span><PersonSelect value={on} options={onOptions} onChange={setOn} label={`${lec.title} 대신 나오는 사람`} emptyLabel="없음" /></div>
      </div>
      <div className="os-change-row">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="사유 (선택)" maxLength={100} aria-label={`${lec.title} 사유`} />
        <button className="btn small primary" disabled={pending || (!off && !on)}>저장</button>
      </div>
      {error && <p className="msg error">{error}</p>}
    </form>
  );
}

type Group = { key: string; date: string; label: string; lectureId: number; title: string; slot: Change['slot']; off: (Change & { label: string })[]; on: (Change & { label: string })[] };

function ChangesView(p: ViewProps) {
  const { pending, error, run } = useRun();
  const [onlyMine, setOnlyMine] = useState(false);
  const list = p.changes.filter((c) => !onlyMine || c.user.id === p.me.id);
  // 날짜·강의별로 묶는다(빠진 사람 → 대신 나온 사람)
  const groups: Group[] = [];
  for (const c of list) {
    const key = `${c.date}-${c.lectureId}`;
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, date: c.date, label: c.label, lectureId: c.lectureId, title: c.title, slot: c.slot, off: [], on: [] }; groups.push(g); }
    (c.kind === 'off' ? g.off : g.on).push(c);
  }
  const undo = (c: Change) => run(() => setChangeAction({ lectureId: c.lectureId, date: c.date, userId: c.user.id, kind: null }), '되돌렸습니다');
  const Who = ({ c }: { c: Change }) => (
    <span className={`os-who ${c.kind}`}>
      <Person name={c.user.name} size={20} />
      {p.isAdmin && <button type="button" className="os-x" disabled={pending} aria-label={`${c.user.name} ${c.kind === 'off' ? '빠짐' : '추가'} 되돌리기`} title="되돌리기" onClick={() => undo(c)}>✕</button>}
    </span>
  );
  return (
    <div className="os-body">
      <div className="os-bar">
        <MonthNav {...p} />
        <label className="os-only"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> 내 것만</label>
      </div>
      <p className="help">담당과 다르게 빠지거나 대신 나오는 날만 모아서 보여요.</p>
      {groups.length === 0 ? <p className="empty">이번 달 변동 사항이 없습니다</p> : (
        <ul className="os-groups">
          {groups.map((g) => {
            const notes = [...new Set([...g.off, ...g.on].map((c) => c.note).filter(Boolean))];
            return (
              <li key={g.key} className="os-group">
                <div className="os-g-head">
                  <span className="os-c-date">{g.label}</span>
                  <b>{g.title}</b>
                  <span className="muted">{SLOT_INFO[g.slot].label} {SLOT_INFO[g.slot].time}</span>
                </div>
                <div className="os-g-body">
                  {g.off.length > 0 && <span className="os-g-side"><span className="os-badge off">빠짐</span>{g.off.map((c) => <Who key={c.id} c={c} />)}</span>}
                  {g.off.length > 0 && g.on.length > 0 && <span className="os-arrow" aria-hidden>→</span>}
                  {g.on.length > 0 && <span className="os-g-side"><span className="os-badge on">{g.off.length ? '대신' : '추가'}</span>{g.on.map((c) => <Who key={c.id} c={c} />)}</span>}
                  {notes.length > 0 && <span className="os-g-note">{notes.join(' · ')}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="msg error">{error}</p>}
    </div>
  );
}
