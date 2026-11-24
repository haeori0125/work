import type { Note } from './memos';
import type { LastChange, Occurrence, TaskStatus } from './tasks';
import { formatDateLabel, formatKstTime, kstDate, kstWeekday } from './time';

export const STATUS_LABEL: Record<TaskStatus, string> = { todo: '미완료', doing: '진행 중', done: '완료' };
export const STATUSES: TaskStatus[] = ['todo', 'doing', 'done'];

const REPEAT_SHORT: Record<string, string> = { daily: '매일', weekdays: '평일', weekly_days: '매주', weekly: '매주' };

/** 날짜까지: "11/21(금) 09:14" (업무 팝업 안에서) */
export function formatWhenFull(at: Date): string {
  return `${formatDateLabel(kstDate(at))} ${formatKstTime(at)}`;
}

/** 오늘이면 "09:14", 다른 날이면 "11/21(금) 09:14" */
export function formatWhen(at: Date, today: string): string {
  const d = kstDate(at);
  return d === today ? formatKstTime(at) : `${formatDateLabel(d)} ${formatKstTime(at)}`;
}

const WEEKDAY_SHORT = ['월', '화', '수', '목', '금', '토', '일'];

export type PartView = {
  id: number;
  title: string;
  assignee: string | null;
  status: TaskStatus;
  /** "영희 10:12" — 화면에서 상태 아이콘(✓/◐)을 앞에 붙인다 */
  tag: string | null;
  by: string | null;
  /** 목록에서 보이는 체크 시각 "09:14" */
  at: string | null;
  /** 팝업 안에서 보이는 체크 날짜·시각 "11/21(금) 09:14" */
  atFull: string | null;
};

export type OccurrenceView = {
  taskId: number;
  occurrenceKey: string;
  title: string;
  description: string | null;
  kind: 'dated' | 'weekly';
  dateLabel: string;
  assignees: string[];
  status: TaskStatus;
  /** 상태 태그 글자: "민수 09:14" (미완료면 null) */
  lastChange: string | null;
  /** 위클리 칸용 짧은 상태 태그 글자: "민수" */
  lastBy: string | null;
  /** 목록에서 보이는 시각 "09:14" */
  lastAt: string | null;
  /** 팝업 안에서 보이는 날짜·시각 "11/21(금) 09:14" */
  lastAtFull: string | null;
  commentCount: number;
  repeatLabel: string | null;
  /** 주간 업무 마감: "~목" */
  dueLabel: string | null;
  overdue: boolean;
  dueHere: boolean;
  parts: PartView[];
  /** "파트 1/3" */
  partsLabel: string | null;
};

function changeTag(status: TaskStatus, change: LastChange | null, today: string | null): string | null {
  if (status === 'todo' || !change) return null; // 미완료로 되돌린 경우도 태그 없음(기록에는 남음)
  const when = today ? ` ${formatWhen(change.at, today)}` : '';
  return `${change.userName}${when}`;
}

export function toOccurrenceView(o: Occurrence, today: string): OccurrenceView {
  const partsDone = o.parts.filter((p) => p.status === 'done').length;
  return {
    taskId: o.taskId,
    occurrenceKey: o.occurrenceKey,
    title: o.title,
    description: o.description,
    kind: o.kind,
    dateLabel: o.kind === 'weekly' ? `${formatDateLabel(o.occurrenceKey)} 주` : formatDateLabel(o.occurrenceKey),
    assignees: o.assignees.map((a) => a.name),
    status: o.status,
    // 파트가 있는 업무는 파트마다 태그가 붙으므로 업무 줄에는 상태 태그를 두지 않는다
    lastChange: o.parts.length ? null : changeTag(o.status, o.lastChange, today),
    lastBy: o.parts.length ? null : changeTag(o.status, o.lastChange, null),
    // 목록(밖)에서는 시각만, 팝업(안)에서는 날짜와 시각
    lastAt: o.parts.length || o.status === 'todo' || !o.lastChange ? null : formatKstTime(o.lastChange.at),
    lastAtFull: o.parts.length || o.status === 'todo' || !o.lastChange ? null : formatWhenFull(o.lastChange.at),
    commentCount: o.commentCount,
    repeatLabel: REPEAT_SHORT[o.repeat] ?? null,
    dueLabel: !o.dueDate ? null : o.repeat === 'none' ? `~${formatDateLabel(o.dueDate)}` : `~${WEEKDAY_SHORT[kstWeekday(o.dueDate)]}`,
    overdue: !!o.dueDate && o.dueDate < today && o.status !== 'done',
    dueHere: !!o.dueHere,
    parts: o.parts.map((p) => ({
      id: p.id, title: p.title, assignee: p.assignee?.name ?? null, status: p.status,
      tag: changeTag(p.status, p.lastChange, today),
      by: p.status === 'todo' || !p.lastChange ? null : p.lastChange.userName,
      at: p.status === 'todo' || !p.lastChange ? null : formatKstTime(p.lastChange.at),
      atFull: p.status === 'todo' || !p.lastChange ? null : formatWhenFull(p.lastChange.at),
    })),
    partsLabel: o.parts.length ? `파트 ${partsDone}/${o.parts.length}` : null,
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
  if (def.kind === 'weekly') return def.repeat === 'weekly' ? '기간 · 매주 반복' : '기간 · 한 번';
  switch (def.repeat) {
    case 'daily': return '매일';
    case 'weekdays': return '평일(월~금)';
    case 'weekly_days': return `매주 ${def.weekdays.map((d) => WEEKDAY_NAMES[d]).join('·')}`;
    default: return '한 번';
  }
}

const SCALE_START = 6 * 60;
const SCALE_END = 24 * 60;

/** 기록 막대용: date(KST)의 06:00~24:00을 0~100%로. 범위 밖은 잘라 낸다. */
export function pctOfDay(at: Date, date: string): number {
  const midnight = Date.parse(`${date}T00:00:00+09:00`);
  const min = (at.getTime() - midnight) / 60e3;
  const pct = ((min - SCALE_START) / (SCALE_END - SCALE_START)) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 100) / 100));
}

/** 위클리 필터에서 "담당자가 없는 업무"를 뜻하는 값 */
export const NO_ASSIGNEE = '담당 없음';

/** 위클리 담당 필터: null이면 전체, 아니면 고른 사람이 담당(파트 포함)인 업무만 */
export function matchesWeekFilter(assignees: string[], filter: string[] | null): boolean {
  if (filter === null) return true;
  if (assignees.length === 0) return filter.includes(NO_ASSIGNEE);
  return assignees.some((n) => filter.includes(n));
}
