import Link from 'next/link';
import type { OccurrenceView } from '@/lib/view';
import { TaskItem } from './TaskItem';

type Props = {
  dateLabel: string;
  past: OccurrenceView[];
  today: OccurrenceView[];
  me: { id: number; role: 'member' | 'admin' };
};

export function TodayPanel({ dateLabel, past, today, me }: Props) {
  const left = today.filter((o) => o.status !== 'done').length;
  const doing = today.filter((o) => o.status === 'doing').length;
  return (
    <section className="panel p-today" aria-label="오늘">
      <div className="panel-head">
        <h2>오늘</h2><span className="sub">{dateLabel}</span>
        <span className="count" aria-label="남은 일">{left}</span>
      </div>
      <div className="tiles">
        <div className="tile"><span className="dot" style={{ background: 'var(--accent)' }} /><span className="l">남은 일</span><span className="n">{left}</span></div>
        <div className="tile"><span className="dot" style={{ background: 'var(--doing)' }} /><span className="l">진행 중</span><span className="n">{doing}</span></div>
        <div className="tile"><span className="dot" style={{ background: 'var(--red)' }} /><span className="l">지난 업무</span><span className="n">{past.length}</span></div>
      </div>
      {past.length > 0 && (
        <section aria-label="지난 업무">
          <div className="group-label warn">지난 업무</div>
          <ul className="rows">{past.map((o) => <TaskItem key={`${o.taskId}-${o.occurrenceKey}`} occ={o} me={me} showDate />)}</ul>
        </section>
      )}
      <section aria-label="오늘 업무">
        <div className="group-label">오늘 할 일</div>
        {today.length === 0 ? <p className="empty">오늘 업무가 없습니다</p> : (
          <ul className="rows">{today.map((o) => <TaskItem key={`${o.taskId}-${o.occurrenceKey}`} occ={o} me={me} />)}</ul>
        )}
      </section>
      {me.role === 'admin' && <Link className="add-link" href="/admin/tasks"><span aria-hidden>+</span>새로운 할 일</Link>}
    </section>
  );
}
