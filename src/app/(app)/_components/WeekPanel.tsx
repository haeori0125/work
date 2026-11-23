'use client';

import { useState, useTransition } from 'react';
import { setStatusAction } from '@/app/actions/tasks';
import type { OccurrenceView } from '@/lib/view';
import { StatusMark } from '@/app/_ui/icons';
import { CheckCircle, NEXT_STATUS } from './CheckCircle';
import { PartList } from './PartList';

export type WeekDay = {
  date: string; dayNum: number; weekday: string; isToday: boolean; isPast: boolean; isSun: boolean; items: OccurrenceView[];
};

type Props = { rangeLabel: string; days: WeekDay[]; goals: OccurrenceView[] };

const keyOf = (o: OccurrenceView, where: string) => `${where}-${o.taskId}-${o.occurrenceKey}`;

/** 담당(테두리) · 마감 · 파트 진행 · 체크한 사람(채움) 태그 */
function Tags({ o, showDue }: { o: OccurrenceView; showDue: boolean }) {
  const any = o.assignees.length > 0 || o.lastBy || o.partsLabel || (showDue && (o.dueLabel || o.overdue)) || o.dueHere;
  if (!any) return null;
  return (
    <span className="tags mini">
      {o.dueHere && <span className={o.overdue ? 'tag date' : 'tag line due'}>{o.overdue ? '마감 지남' : '마감'}</span>}
      {showDue && !o.dueHere && o.overdue && <span className="tag date">마감 지남</span>}
      {showDue && !o.dueHere && !o.overdue && o.dueLabel && <span className="tag line due">{o.dueLabel}</span>}
      {o.assignees.length > 0 && <span className="tag line">담당 {o.assignees.join(', ')}</span>}
      {o.partsLabel && <span className={`tag ${o.status === 'todo' ? 'line' : o.status}`}>{o.partsLabel}</span>}
      {o.lastBy && <span className={`tag ${o.status}`} title={o.lastChange ?? undefined}><StatusMark status={o.status} />{o.lastBy}</span>}
    </span>
  );
}

export function WeekPanel({ rangeLabel, days, goals }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  // 파트가 있는 업무는 원을 누르면 파트 목록이 열리고, 체크는 파트에서 한다
  const press = (o: OccurrenceView, key: string) => {
    if (o.parts.length) { setOpen(open === key ? null : key); return; }
    start(async () => {
      const res = await setStatusAction(o.taskId, o.occurrenceKey, NEXT_STATUS[o.status]);
      setError(res?.error ?? null);
    });
  };
  const openGoal = goals.find((o) => open === keyOf(o, 'goal'));

  return (
    <section className="panel p-week" aria-label="위클리">
      <div className="panel-head"><h2>위클리</h2><span className="sub">{rangeLabel}</span></div>
      <div className="week-wrap">
        <div className="goals" aria-label="이번 주 업무">
          <span className="lbl">이번 주 업무</span>
          {goals.length === 0 && <span className="none">없음</span>}
          {goals.map((o) => (
            <span key={o.taskId} className={`goal ${o.status}`}>
              <CheckCircle status={o.status} title={o.parts.length ? `${o.title} (파트 보기)` : o.title} size="sm"
                onCycle={() => press(o, keyOf(o, 'goal'))} disabled={pending} />
              <span className="goal-title">{o.title}</span>
              <Tags o={o} showDue />
            </span>
          ))}
          {openGoal && <div className="goal-parts"><PartList parts={openGoal.parts} occurrenceKey={openGoal.occurrenceKey} compact /></div>}
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
                    {d.items.map((o) => {
                      const key = keyOf(o, d.date);
                      return (
                        <li key={key} className={`item ${o.status}${o.dueHere ? ' due-item' : ''}`}>
                          <CheckCircle status={o.status} title={o.parts.length ? `${o.title} (파트 보기)` : o.title} size="sm"
                            onCycle={() => press(o, key)} disabled={pending} />
                          <div>
                            <span className="t">{o.title}</span>
                            <Tags o={o} showDue={false} />
                            {open === key && <PartList parts={o.parts} occurrenceKey={o.occurrenceKey} compact />}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
