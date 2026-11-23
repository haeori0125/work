'use client';

import { useState, useTransition } from 'react';
import { setStatusAction } from '@/app/actions/tasks';
import { matchesWeekFilter, type OccurrenceView } from '@/lib/view';
import { CheckCircle, NEXT_STATUS } from './CheckCircle';
import { TaskDialog } from './TaskDialog';
import { AssigneeTag, StatusTag } from './TaskTags';
import { WeekFilter } from './WeekFilter';

export type WeekDay = {
  date: string; dayNum: number; weekday: string; isToday: boolean; isPast: boolean; isSun: boolean; items: OccurrenceView[];
};

type Props = {
  rangeLabel: string; days: WeekDay[]; goals: OccurrenceView[]; me: { id: number; role: 'member' | 'admin' };
  members: string[]; savedFilter: string[] | null;
};

/** 마감 · 담당(테두리) · 파트 진행 · 체크한 사람(채움) 태그 */
function Tags({ o, showDue }: { o: OccurrenceView; showDue: boolean }) {
  const any = o.assignees.length > 0 || o.lastBy || o.partsLabel || (showDue && (o.dueLabel || o.overdue)) || o.dueHere;
  if (!any) return null;
  return (
    <span className="tags mini">
      {o.dueHere && <span className={o.overdue ? 'tag date' : 'tag line due'}>{o.overdue ? '마감 지남' : '마감'}</span>}
      {showDue && !o.dueHere && o.overdue && <span className="tag date">마감 지남</span>}
      {showDue && !o.dueHere && !o.overdue && o.dueLabel && <span className="tag line due">{o.dueLabel}</span>}
      <AssigneeTag names={o.assignees} compact />
      {o.partsLabel && <span className={`tag ${o.status === 'todo' ? 'line' : o.status}`}>{o.partsLabel}</span>}
      <StatusTag status={o.status} by={o.lastBy} compact />
    </span>
  );
}

export function WeekPanel({ rangeLabel, days: allDays, goals: allGoals, me, members, savedFilter }: Props) {
  const [saved, setSaved] = useState(savedFilter);
  const [filter, setFilter] = useState(savedFilter);
  const keep = (o: OccurrenceView) => matchesWeekFilter(o.assignees, filter);
  const goals = allGoals.filter(keep);
  const days = allDays.map((d) => ({ ...d, items: d.items.filter(keep) }));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<OccurrenceView | null>(null);
  // 파트가 있는 업무는 원을 누르면 팝업이 열리고, 체크는 팝업의 파트에서 한다
  const press = (o: OccurrenceView) => {
    if (o.parts.length) { setOpened(o); return; }
    start(async () => {
      const res = await setStatusAction(o.taskId, o.occurrenceKey, NEXT_STATUS[o.status]);
      setError(res?.error ?? null);
    });
  };
  // 팝업은 서버에서 새로 받은 최신 데이터로 보여 준다
  const all = [...allGoals, ...allDays.flatMap((d) => d.items)];
  const current = opened && (all.find((o) => o.taskId === opened.taskId && o.occurrenceKey === opened.occurrenceKey) ?? opened);

  return (
    <section className="panel p-week" aria-label="위클리">
      <div className="panel-head">
        <h2>위클리</h2><span className="sub">{rangeLabel}</span>
        <WeekFilter members={members} filter={filter} saved={saved} onChange={setFilter} onSaved={setSaved} />
      </div>
      <div className="week-wrap">
        <div className="goals" aria-label="이번 주 업무">
          <span className="lbl">이번 주 업무</span>
          {goals.length === 0 && <span className="none">없음</span>}
          {goals.map((o) => (
            <span key={o.taskId} className={`goal ${o.status}`}>
              <CheckCircle status={o.status} title={o.parts.length ? `${o.title} (파트 보기)` : o.title} size="sm"
                onCycle={() => press(o)} disabled={pending} />
              <button type="button" className="goal-title as-link" onClick={() => setOpened(o)}>{o.title}</button>
              <Tags o={o} showDue />
            </span>
          ))}
        </div>
        {error && <p className="msg error" style={{ marginBottom: 10 }}>{error}</p>}
        <div className="week">
          {days.map((d) => {
            const done = d.items.filter((o) => o.status === 'done').length;
            return (
              <div key={d.date} className={`day${d.isToday ? ' today' : ''}${d.isSun ? ' sun' : ''}${d.isPast ? ' past' : ''}`}
                aria-label={`${d.dayNum}일 ${d.weekday}요일`}>
                <div className="day-head">
                  <span className="d">{d.dayNum}</span><span className="w">{d.weekday}</span>
                  <span className="c">{d.items.length ? `${done}/${d.items.length}` : ''}</span>
                </div>
                {d.items.length === 0 ? <div className="empty-day">업무 없음</div> : (
                  <ul className="items">
                    {d.items.map((o) => (
                      <li key={`${o.taskId}-${o.occurrenceKey}`} className={`item ${o.status}${o.dueHere ? ' due-item' : ''}`}>
                        <CheckCircle status={o.status} title={o.parts.length ? `${o.title} (파트 보기)` : o.title} size="sm"
                          onCycle={() => press(o)} disabled={pending} />
                        <div>
                          <button type="button" className="t as-link" onClick={() => setOpened(o)}>{o.title}</button>
                          <Tags o={o} showDue={false} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {current && <TaskDialog key={`${current.taskId}-${current.occurrenceKey}`} occ={current} me={me} onClose={() => setOpened(null)} />}
    </section>
  );
}
