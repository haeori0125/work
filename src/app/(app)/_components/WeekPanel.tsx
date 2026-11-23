'use client';

import { useState, useTransition } from 'react';
import { setStatusAction } from '@/app/actions/tasks';
import type { OccurrenceView } from '@/lib/view';
import { CheckCircle, NEXT_STATUS } from './CheckCircle';

export type WeekDay = {
  date: string; dayNum: number; weekday: string; isToday: boolean; isPast: boolean; isSun: boolean; items: OccurrenceView[];
};

type Props = { rangeLabel: string; days: WeekDay[]; goals: OccurrenceView[] };

export function WeekPanel({ rangeLabel, days, goals }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cycle = (o: OccurrenceView) => start(async () => {
    const res = await setStatusAction(o.taskId, o.occurrenceKey, NEXT_STATUS[o.status]);
    setError(res?.error ?? null);
  });
  return (
    <section className="panel p-week" aria-label="위클리">
      <div className="panel-head"><h2>위클리</h2><span className="sub">{rangeLabel}</span></div>
      <div className="week-wrap">
        <div className="goals" aria-label="이번 주 업무">
          <span className="lbl">이번 주 업무</span>
          {goals.length === 0 && <span className="none">없음</span>}
          {goals.map((o) => (
            <span key={o.taskId} className={`goal ${o.status}`}>
              <CheckCircle status={o.status} title={o.title} size="sm" onCycle={() => cycle(o)} disabled={pending} />
              <span>{o.title}</span>
              {o.lastBy && <span className={`tag ${o.status}`}>{o.lastBy}</span>}
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
                      <li key={o.taskId} className={`item ${o.status}`}>
                        <CheckCircle status={o.status} title={o.title} size="sm" onCycle={() => cycle(o)} disabled={pending} />
                        <div>
                          <span className="t">{o.title}</span>
                          {(o.assignees.length > 0 || o.lastBy) && (
                            <span className="tags mini">
                              {o.assignees.length > 0 && <span className="tag">담당 {o.assignees.join(', ')}</span>}
                              {o.lastBy && <span className={`tag ${o.status}`} title={o.lastChange ?? undefined}>{o.lastBy}</span>}
                            </span>
                          )}
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
    </section>
  );
}
