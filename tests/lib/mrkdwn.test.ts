import { describe, expect, it } from 'vitest';
import { autoBullet, continueList, indentLine, parseBlocks, parseInline } from '@/lib/mrkdwn';

describe('parseInline', () => {
  it('reads slack-style marks and code', () => {
    expect(parseInline('a *굵게* _기울임_ ~취소~ `x*y*` 끝')).toEqual([
      { t: 'text', v: 'a ' }, { t: 'b', c: [{ t: 'text', v: '굵게' }] }, { t: 'text', v: ' ' },
      { t: 'i', c: [{ t: 'text', v: '기울임' }] }, { t: 'text', v: ' ' }, { t: 's', c: [{ t: 'text', v: '취소' }] },
      { t: 'text', v: ' ' }, { t: 'code', v: 'x*y*' }, { t: 'text', v: ' 끝' },
    ]);
  });
  it('leaves marks glued to words or spaces alone', () => {
    expect(parseInline('2*3*4 and snake_case_name and * not *')).toEqual([{ t: 'text', v: '2*3*4 and snake_case_name and * not *' }]);
  });
  it('nests marks', () => {
    expect(parseInline('*굵게 _기울임_*')).toEqual([{ t: 'b', c: [{ t: 'text', v: '굵게 ' }, { t: 'i', c: [{ t: 'text', v: '기울임' }] }] }]);
  });
});

describe('parseBlocks', () => {
  it('reads lists, quotes, code blocks and paragraphs', () => {
    const b = parseBlocks('제목\n• 하나\n  - 둘\n1. 첫째\n2. 둘째\n> 인용\n```\nconst a = 1;\n```\n\n끝');
    expect(b.map((x) => x.t)).toEqual(['p', 'ul', 'ol', 'quote', 'pre', 'gap', 'p']);
    expect(b[1]).toMatchObject({ items: [{ depth: 0 }, { depth: 1 }] });
    expect(b[2]).toMatchObject({ items: [{ n: 1 }, { n: 2 }] });
    expect(b[4]).toEqual({ t: 'pre', v: 'const a = 1;' });
  });
});

describe('editor helpers', () => {
  it('turns "* " or "- " at line start into a bullet', () => {
    expect(autoBullet('메모\n* ', 6)).toEqual({ value: '메모\n• ', caret: 5 });
    expect(autoBullet('  - ', 4)).toEqual({ value: '  • ', caret: 4 });
    expect(autoBullet('a * ', 4)).toBeNull();
  });
  it('continues and ends lists on Enter', () => {
    expect(continueList('• 사과', 4)).toEqual({ value: '• 사과\n• ', caret: 7 });
    expect(continueList('3. 셋', 4)).toEqual({ value: '3. 셋\n4. ', caret: 8 });
    expect(continueList('• ', 2)).toEqual({ value: '', caret: 0 });
    expect(continueList('그냥 글', 4)).toBeNull();
  });
  it('indents and outdents list lines', () => {
    expect(indentLine('• 하나', 4, false)).toEqual({ value: '  • 하나', caret: 6 });
    expect(indentLine('  • 하나', 6, true)).toEqual({ value: '• 하나', caret: 4 });
    expect(indentLine('글', 1, false)).toBeNull();
  });
});
