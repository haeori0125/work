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
  it('shows no last-change tag once a task is back to todo', async () => {
    const { toOccurrenceView } = await import('@/lib/view');
    const base = {
      taskId: 1, occurrenceKey: '2026-11-23', title: '팀 투두 페이지 완성하기', description: null,
      kind: 'dated' as const, repeat: 'none' as const, assignees: [{ id: 1, name: '장은채' }], commentCount: 0,
      lastChange: { userName: '이현은', at: new Date('2026-11-23T13:40:00Z') },
    };
    const todo = toOccurrenceView({ ...base, status: 'todo' }, '2026-11-23');
    expect(todo.lastChange).toBeNull();
    expect(todo.lastBy).toBeNull();
    const done = toOccurrenceView({ ...base, status: 'done' }, '2026-11-23');
    expect(done.lastBy).toBe('이현은');
    expect(done.lastChange).toBe('완료 · 이현은 22:40');
  });
});
