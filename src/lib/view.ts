import type { Note } from './memos';
import type { Occurrence, TaskStatus } from './tasks';
import { formatDateLabel, formatKstTime, kstDate } from './time';

export const STATUS_LABEL: Record<TaskStatus, string> = { todo: '미완료', doing: '진행 중', done: '완료' };
export const STATUSES: TaskStatus[] = ['todo', 'doing', 'done'];

/** 오늘이면 "09:14", 다른 날이면 "11/21(금) 09:14" */
export function formatWhen(at: Date, today: string): string {
  const d = kstDate(at);
  return d === today ? formatKstTime(at) : `${formatDateLabel(d)} ${formatKstTime(at)}`;
}

export type OccurrenceView = {
  taskId: number;
  occurrenceKey: string;
  title: string;
  description: string | null;
  kind: 'dated' | 'weekly';
  dateLabel: string;
  assignees: string[];
  status: TaskStatus;
  lastChange: string | null;
  commentCount: number;
};

export function toOccurrenceView(o: Occurrence, today: string): OccurrenceView {
  return {
    taskId: o.taskId,
    occurrenceKey: o.occurrenceKey,
    title: o.title,
    description: o.description,
    kind: o.kind,
    dateLabel: o.kind === 'weekly' ? `${formatDateLabel(o.occurrenceKey)} 주` : formatDateLabel(o.occurrenceKey),
    assignees: o.assignees.map((a) => a.name),
    status: o.status,
    lastChange: o.lastChange ? `${STATUS_LABEL[o.status]} · ${o.lastChange.userName} ${formatWhen(o.lastChange.at, today)}` : null,
    commentCount: o.commentCount,
  };
}

export type NoteView = { id: number; authorId: number; authorName: string; body: string; when: string; edited: boolean };

export function toNoteView(n: Note, today: string): NoteView {
  return {
    id: n.id, authorId: n.authorId, authorName: n.authorName, body: n.body,
    when: formatWhen(n.createdAt, today), edited: n.updatedAt.getTime() !== n.createdAt.getTime(),
  };
}

const WEEKDAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

export function describeRepeat(def: { kind: 'dated' | 'weekly'; repeat: string; weekdays: number[] }): string {
  if (def.kind === 'weekly') return def.repeat === 'weekly' ? '주간 · 매주 반복' : '주간 · 한 번';
  switch (def.repeat) {
    case 'daily': return '매일';
    case 'weekdays': return '평일(월~금)';
    case 'weekly_days': return `매주 ${def.weekdays.map((d) => WEEKDAY_NAMES[d]).join('·')}`;
    default: return '한 번';
  }
}
