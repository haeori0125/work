import { describe, expect, it } from 'vitest';
import { pctOfDay } from '@/lib/view';

describe('pctOfDay', () => {
  it('maps 06:00–24:00 KST onto 0–100', () => {
    expect(pctOfDay(new Date('2026-11-22T21:00:00Z'), '2026-11-23')).toBe(0); // 06:00 KST
    expect(pctOfDay(new Date('2026-11-23T06:00:00Z'), '2026-11-23')).toBe(50); // 15:00 KST
    expect(pctOfDay(new Date('2026-11-23T15:00:00Z'), '2026-11-23')).toBe(100); // 24:00 KST
  });
  it('clamps times outside the scale', () => {
    expect(pctOfDay(new Date('2026-11-22T18:00:00Z'), '2026-11-23')).toBe(0); // 03:00 KST
  });
});

describe('toOccurrenceView', () => {
  const base = {
    taskId: 1, occurrenceKey: '2026-11-23', title: '팀 투두 페이지 완성하기', description: null,
    kind: 'dated' as const, repeat: 'none' as const, assignees: [{ id: 1, name: '장은채' }], commentCount: 0,
    lastChange: { userId: 2, userName: '이현은', at: new Date('2026-11-23T13:40:00Z') }, parts: [], dueDate: null, startDate: '2026-11-23',
  };

  it('shows no last-change tag once a task is back to todo', async () => {
    const { toOccurrenceView } = await import('@/lib/view');
    const todo = toOccurrenceView({ ...base, status: 'todo' }, '2026-11-23');
    expect(todo.lastChange).toBeNull();
    expect(todo.lastBy).toBeNull();
  });

  it('status tags carry the person who checked (and the time on full tags)', async () => {
    const { toOccurrenceView } = await import('@/lib/view');
    const done = toOccurrenceView({ ...base, status: 'done' }, '2026-11-23');
    expect(done.lastChange).toBe('이현은 22:40');
    expect(done.lastBy).toBe('이현은');
    const self = toOccurrenceView({ ...base, status: 'doing', lastChange: { ...base.lastChange, userId: 1, userName: '장은채' } }, '2026-11-23');
    expect(self.lastChange).toBe('장은채 22:40');
    const nobody = toOccurrenceView({ ...base, assignees: [], status: 'done' }, '2026-11-23');
    expect(nobody.lastBy).toBe('이현은');
  });

  it('labels deadlines, overdue weekly tasks and part progress', async () => {
    const { toOccurrenceView } = await import('@/lib/view');
    const weekly = { ...base, kind: 'weekly' as const, repeat: 'weekly' as const, dueDate: '2026-11-26', status: 'todo' as const };
    expect(toOccurrenceView(weekly, '2026-11-24').dueLabel).toBe('~목');
    expect(toOccurrenceView({ ...weekly, repeat: 'none' }, '2026-11-24').dueLabel).toBe('~11/26(목)');
    expect(toOccurrenceView(weekly, '2026-11-24').overdue).toBe(false);
    expect(toOccurrenceView(weekly, '2026-11-27').overdue).toBe(true);
    expect(toOccurrenceView({ ...weekly, status: 'done' }, '2026-11-27').overdue).toBe(false);
    const parts = [
      { id: 1, title: '장소', assignee: { id: 1, name: '장은채' }, status: 'done' as const, lastChange: { userId: 2, userName: '이현은', at: new Date('2026-11-23T01:12:00Z') } },
      { id: 2, title: '현수막', assignee: null, status: 'todo' as const, lastChange: null },
    ];
    const v = toOccurrenceView({ ...base, status: 'doing', parts }, '2026-11-23');
    expect(v.partsLabel).toBe('파트 1/2');
    expect(v.parts.map((p) => p.tag)).toEqual(['이현은 10:12', null]);
  });
});

describe('matchesWeekFilter', () => {
  it('keeps tasks whose assignees (incl. part assignees) are selected, or unassigned ones when chosen', async () => {
    const { matchesWeekFilter, NO_ASSIGNEE } = await import('@/lib/view');
    expect(matchesWeekFilter(['영희'], null)).toBe(true);
    expect(matchesWeekFilter(['영희', '민수'], ['민수'])).toBe(true);
    expect(matchesWeekFilter(['영희'], ['민수'])).toBe(false);
    expect(matchesWeekFilter([], ['민수'])).toBe(false);
    expect(matchesWeekFilter([], [NO_ASSIGNEE])).toBe(true);
    expect(matchesWeekFilter(['영희'], [])).toBe(false);
  });
});
