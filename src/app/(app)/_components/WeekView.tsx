'use client';

import { useState } from 'react';
import { STATUS_LABEL, type OccurrenceView } from '@/lib/view';

type Day = { date: string; dayLabel: string; dateNum: string; items: OccurrenceView[] };

export function WeekView({ days, today }: { days: Day[]; today: string }) {
  const [sel, setSel] = useState(days.some((d) => d.date === today) ? today : days[0].date);
  const day = days.find((d) => d.date === sel)!;
  return (
    <section className="section" aria-label="위클리">
      <div className="section-head"><h2>위클리</h2><span className="muted section-sub">이번 주 날짜별 업무</span></div>
      <div className="day-tabs" role="tablist">
        {days.map((d) => (
          <button key={d.date} role="tab" aria-selected={d.date === sel}
            className={d.date === sel ? 'day-tab active' : 'day-tab'} onClick={() => setSel(d.date)}>
            {d.dayLabel}<small>{d.dateNum}{d.items.length ? ` · ${d.items.length}` : ''}</small>
          </button>
        ))}
      </div>
      {day.items.length === 0 ? <p className="empty">이 날 업무가 없습니다</p> : (
        <div>
          {day.items.map((o) => (
            <div key={o.taskId} className="week-item">
              <span className={`badge ${o.status}`}>{STATUS_LABEL[o.status]}</span>
              <span style={{ flex: 1 }}>{o.title}</span>
              {o.assignees.length > 0 && <span className="muted">{o.assignees.join(', ')}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
