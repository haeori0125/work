import { describe, expect, it } from 'vitest';
import { merge3, mergeLine } from '@/lib/merge';

describe('merge3', () => {
  const base = '제목\n하나\n둘\n셋';
  it('keeps both people’s edits on different lines', () => {
    expect(merge3(base, '제목\n하나!\n둘\n셋', '제목\n하나\n둘\n셋?')).toBe('제목\n하나!\n둘\n셋?');
  });
  it('keeps lines both added in the same place', () => {
    expect(merge3(base, '제목\n하나\n둘\n셋\n내 줄', '제목\n하나\n둘\n셋\n남 줄')).toBe('제목\n하나\n둘\n셋\n남 줄\n내 줄');
  });
  it('handles a delete on one side and an edit on the other', () => {
    expect(merge3(base, '제목\n둘\n셋', '제목\n하나\n둘\n셋 끝')).toBe('제목\n둘\n셋 끝');
  });
  it('merges edits on neighbouring lines', () => {
    expect(merge3(base, '제목\n하나 A\n둘\n셋', '제목\n하나\n둘 B\n셋')).toBe('제목\n하나 A\n둘 B\n셋');
  });
  it('merges two edits in different spots of the same line', () => {
    expect(mergeLine('오늘 회의 자료', '오늘 오전 회의 자료', '오늘 회의 자료 준비')).toBe('오늘 오전 회의 자료 준비');
    expect(merge3('a\n오늘 회의', 'a\n(A) 오늘 회의', 'a\n오늘 회의 (B)')).toBe('a\n(A) 오늘 회의 (B)');
  });
  it('keeps both when both typed at the same spot, saver wins when both replaced the same word', () => {
    expect(merge3(base, '제목\n하나 A\n둘\n셋', '제목\n하나 B\n둘\n셋')).toBe('제목\n하나 A B\n둘\n셋');
    expect(mergeLine('사과 3개', '배 3개', '귤 3개')).toBe('배 3개');
  });
  it('shortcuts when one side did nothing', () => {
    expect(merge3(base, base, 'x')).toBe('x');
    expect(merge3(base, 'y', base)).toBe('y');
  });
});
