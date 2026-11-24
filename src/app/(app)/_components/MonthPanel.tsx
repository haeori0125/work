'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MiniAvatar } from '@/app/_ui/AvatarContext';
import type { DayLecture } from '@/lib/onsite-shared';
import { SLOT_INFO } from '@/lib/onsite-shared';
import { matchesWeekFilter, type OccurrenceView } from '@/lib/view';
import { TaskDialog } from './TaskDialog';
import { WeekFilter } from './WeekFilter';

export type MonthDay = { date: string; dayNum: number; inMonth: boolean; isToday: boolean; isSun: boolean; isSat: boolean; items: OccurrenceView[]; onsite: DayLecture[] };

type Props = {
  title: string; titleShort: string; prevHref: string; nextHref: string; thisHref: string | null;
  weekdays: string[]; days: MonthDay[]; today: string;
  me: { id: number; role: 'member' | 'admin' }; members: string[]; savedFilter: string[] | null;
};

const MAX = 3;

/** 전체 업무 달력: 칸마다 업무 이름 한 줄씩, 많으면 +n. 폰에서는 점만 보이고 날짜를 누르면 아래에 목록 */
export function MonthPanel({ title, titleShort, prevHref, nextHref, thisHref, weekdays, days: allDays, today, me, members, savedFilter }: Props) {
  const [saved, setSaved] = useState(savedFilter);
  const [filter, setFilter] = useState(savedFilter);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState(allDays.find((d) => d.isToday)?.date ?? allDays.find((d) => d.inMonth)!.date);
  const [opened, setOpened] = useState<OccurrenceView | null>(null);
  // 담당 필터는 현장 강의 출근에도 같이 건다(담당 없음 = 아직 사람 없는 강의)
  const days = allDays.map((d) => ({
    ...d, items: d.items.filter((o) => matchesWeekFilter(o.assignees, filter)),
    onsite: d.onsite.filter((l) => matchesWeekFilter(l.staff.map((x) => x.name), filter)),
  }));
  const all = allDays.flatMap((d) => d.items);
  const current = opened && (all.find((o) => o.taskId === opened.taskId && o.occurrenceKey === opened.occurrenceKey) ?? opened);
  // 달을 넘겨 고른 날이 화면에 없으면: 이번 달이면 오늘, 아니면 그 달 1일
  const shownPick = days.some((d) => d.date === picked) ? picked
    : (days.find((d) => d.isToday) ?? days.find((d) => d.inMonth)!).date;
  const pickedDay = days.find((d) => d.date === shownPick);

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

  // 현장 강의 막대: 지점명 · 출근 사람 사진
  const lecture = (l: DayLecture, big = false) => (
    <Link key={l.lectureId} href="/onsite" className="mc-onsite" title={`현장 · ${l.title} ${SLOT_INFO[l.slot].label} ${SLOT_INFO[l.slot].time}${l.staff.length ? ` · ${l.staff.map((x) => x.name).join(', ')}` : ' · 미배정'}`}>
      <span className="mc-pin" aria-hidden>현장</span>
      <span className="mc-t">{l.title}{big && <span className="muted"> {SLOT_INFO[l.slot].label} {SLOT_INFO[l.slot].time}</span>}</span>
      {l.staff.length > 0 ? (
        <span className="mc-who av-stack">{l.staff.slice(0, big ? 3 : 2).map((x) => <MiniAvatar key={x.id} name={x.name} size={big ? 20 : 15} />)}
          {l.staff.length > (big ? 3 : 2) && <span className="mc-extra">+{l.staff.length - (big ? 3 : 2)}</span>}</span>
      ) : <span className="mc-unset">미배정</span>}
    </Link>
  );

  return (
    <section className="panel p-month" aria-label="전체 업무">
      <div className="panel-head">
        <h2>전체 업무</h2>
        <div className="nav-group">
          <div className="week-nav">
            <Link className="arrow" href={prevHref} scroll={false} aria-label="지난달">‹</Link>
            <span className="sub"><span className="lbl-long">{title}</span><span className="lbl-short">{titleShort}</span></span>
            <Link className="arrow" href={nextHref} scroll={false} aria-label="다음 달">›</Link>
          </div>
          {thisHref && <Link className="btn small soft" href={thisHref} scroll={false}><span className="lbl-long">이번 달</span><span className="lbl-short">오늘</span></Link>}
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
                className={`mc-cell${d.inMonth ? '' : ' out'}${d.isToday ? ' today' : ''}${d.date === shownPick ? ' picked' : ''}${d.date < today ? ' past' : ''}`}>
                <button type="button" className={`mc-num${d.isSun ? ' sun' : ''}${d.isSat ? ' sat' : ''}`} onClick={() => setPicked(d.date)}
                  aria-label={`${d.dayNum}일 업무 보기`}>{d.dayNum}</button>
                <div className="mc-items">
                  {d.onsite.map((l) => lecture(l))}
                  {shown.map((o) => chip(o))}
                  {more > 0 && <button type="button" className="mc-more" onClick={() => setOpen(new Set(open).add(d.date))}>+{more}개</button>}
                  {expanded && d.items.length > MAX && (
                    <button type="button" className="mc-more" onClick={() => { const n = new Set(open); n.delete(d.date); setOpen(n); }}>접기</button>
                  )}
                </div>
                {(d.items.length > 0 || d.onsite.length > 0) && (
                  <span className="mc-dots" aria-hidden>
                    {d.onsite.map((l) => <i key={`o${l.lectureId}`} className="onsite" />)}
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
            {pickedDay.onsite.length > 0 && <div className="mc-list">{pickedDay.onsite.map((l) => lecture(l, true))}</div>}
            {pickedDay.items.length === 0 ? <p className="empty">업무 없음 · 날짜를 누르면 그날 업무가 보여요</p> : <div className="mc-list">{pickedDay.items.map((o) => chip(o, true))}</div>}
          </div>
        )}
      </div>
      {current && <TaskDialog key={`${current.taskId}-${current.occurrenceKey}`} occ={current} me={me} onClose={() => setOpened(null)} />}
    </section>
  );
}
