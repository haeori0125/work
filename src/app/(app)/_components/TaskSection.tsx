import type { OccurrenceView } from '@/lib/view';
import { TaskItem } from './TaskItem';

type Props = {
  title: string;
  sub?: string;
  items: OccurrenceView[];
  me: { id: number; role: 'member' | 'admin' };
  empty: string;
  showDate?: boolean;
  className?: string;
};

export function TaskSection({ title, sub, items, me, empty, showDate, className }: Props) {
  const done = items.filter((o) => o.status === 'done').length;
  return (
    <section className={`section ${className ?? ''}`} aria-label={title}>
      <div className="section-head">
        <h2>{title}</h2>
        {sub && <span className="muted section-sub">{sub}</span>}
        <span className="spacer" />
        {items.length > 0 && <span className="muted">{done}/{items.length} 완료</span>}
      </div>
      {items.length === 0 ? <p className="empty">{empty}</p> : (
        <ul className="task-list">
          {items.map((o) => <TaskItem key={`${o.taskId}-${o.occurrenceKey}`} occ={o} me={me} showDate={showDate} />)}
        </ul>
      )}
    </section>
  );
}
