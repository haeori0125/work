'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MiniAvatar } from '@/app/_ui/AvatarContext';
import { matchesWeekFilter, type OccurrenceView } from '@/lib/view';
import { TaskDialog } from './TaskDialog';
import { WeekFilter } from './WeekFilter';

export type MonthDay = { date: string; dayNum: number; inMonth: boolean; isToday: boolean; isSun: boolean; isSat: boolean; items: OccurrenceView[] };

type Props = {
  title: string; prevHref: string; nextHref: string; thisHref: string | null;
  weekdays: string[]; days: MonthDay[]; today: string;
  me: { id: number; role: 'member' | 'admin' }; members: string[]; savedFilter: string[] | null;
};

const MAX = 3;

/** 전체 업무 달력: 칸마다 업무 이름 한 줄씩, 많으면 +n. 폰에서는 점만 보이고 날짜를 누르면 아래에 목록 */
export function MonthPanel({ title, prevHref, nextHref, thisHref, weekdays, days: allDays, today, me, members, savedFilter }: Props) {
  const [saved, setSaved] = useState(savedFilter);
  const [filter, setFilter] = useState(savedFilter);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState(allDays.find((d) => d.isToday)?.date ?? allDays.find((d) => d.inMonth)!.date);
  const [opened, setOpened] = useState<OccurrenceView | null>(null);
  const days = allDays.map((d) => ({ ...d, items: d.items.filter((o) => matchesWeekFilter(o.assignees, filter)) }));
  const all = allDays.flatMap((d) => d.items);
  const current = opened && (all.find((o) => o.taskId === opened.taskId && o.occurrenceKey === opened.occurrenceKey) ?? opened);
  const pickedDay = days.find((d) => d.date === picked);

  // 담당자는 프로필 사진만(2명까지 + 나머지 수), 폰 목록에서는 조금 크게
  const chip = (o: OccurrenceView, big = false) => (
    <button key={`${o.taskId}-${o.occurrenceKey}`} type="button" className={`mc-item ${o.status}`} onClick={() => setOpened(o)}
      title={o.assignees.length ? `${o.title} · 담당 ${o.assignees.join(', ')}` : o.title}>
      <span className="mc-dot" aria-hidden />
      <span className="mc-t">{o.title}</span>
      {o.dueHere && <span className="mc-due">마감</span>}
      {o.assignees.length > 0 && (
        <span className="mc-who av-stack" aria-label={`담당 ${o.assignees.join(', ')}`}>
          {o.assignees.slice(0, big ? 3 : 2).map((n) => <MiniAvatar key={n} name={n} size={big ? 20 : 15} />)}
          {o.assignees.length > (big ? 3 : 2) && <span className="mc-extra">+{o.assignees.length - (big ? 3 : 2)}</span>}
        </span>
      )}
    </button>
  );

  return (
    <section className="panel p-month" aria-label="전체 업무">
      <div className="panel-head">
        <h2>전체 업무</h2>
        <div className="week-nav">
          <Link className="arrow" href={prevHref} scroll={false} aria-label="지난달">‹</Link>
          <span className="sub mc-title">{title}</span>
          <Link className="arrow" href={nextHref} scroll={false} aria-label="다음 달">›</Link>
          {thisHref && <Link className="btn small soft" href={thisHref} scroll={false}>이번 달</Link>}
        </div>
        <WeekFilter members={members} filter={filter} saved={saved} onChange={setFilter} onSaved={setSaved} />
      </div>
      <div className="mc">
        <div className="mc-grid" role="grid" aria-label={title}>
          {weekdays.map((w) => (
            <div key={w} className={`mc-wd${w === '일' ? ' sun' : ''}${w === '토' ? ' sat' : ''}`} role="columnheader">{w}</div>
          ))}
          {days.map((d) => {
            const expanded = open.has(d.date);
            const shown = expanded ? d.items : d.items.slice(0, MAX);
            const more = d.items.length - shown.length;
            return (
              <div key={d.date} role="gridcell" aria-label={`${Number(d.date.slice(5, 7))}월 ${d.dayNum}일, 업무 ${d.items.length}개`}
                className={`mc-cell${d.inMonth ? '' : ' out'}${d.isToday ? ' today' : ''}${d.date === picked ? ' picked' : ''}${d.date < today ? ' past' : ''}`}>
                <button type="button" className={`mc-num${d.isSun ? ' sun' : ''}${d.isSat ? ' sat' : ''}`} onClick={() => setPicked(d.date)}
                  aria-label={`${d.dayNum}일 업무 보기`}>{d.dayNum}</button>
                <div className="mc-items">
                  {shown.map((o) => chip(o))}
                  {more > 0 && <button type="button" className="mc-more" onClick={() => setOpen(new Set(open).add(d.date))}>+{more}개</button>}
                  {expanded && d.items.length > MAX && (
                    <button type="button" className="mc-more" onClick={() => { const n = new Set(open); n.delete(d.date); setOpen(n); }}>접기</button>
                  )}
                </div>
                {d.items.length > 0 && (
                  <span className="mc-dots" aria-hidden>
                    {d.items.slice(0, 4).map((o) => <i key={`${o.taskId}-${o.occurrenceKey}`} className={o.status} />)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* 폰: 고른 날의 업무 목록 */}
        {pickedDay && (
          <div className="mc-agenda" aria-label="고른 날 업무">
            <div className="group-label">{Number(pickedDay.date.slice(5, 7))}월 {pickedDay.dayNum}일</div>
            {pickedDay.items.length === 0 ? <p className="empty">업무 없음</p> : <div className="mc-list">{pickedDay.items.map((o) => chip(o, true))}</div>}
          </div>
        )}
      </div>
      {current && <TaskDialog key={`${current.taskId}-${current.occurrenceKey}`} occ={current} me={me} onClose={() => setOpened(null)} />}
    </section>
  );
}
