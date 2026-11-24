import { describe, expect, it } from 'vitest';
import { autoArrow, toEditorHtml, autoBullet, continueList, indentLine, parseBlocks, parseInline, toggleLines, wrapCodeBlock, wrapInline } from '@/lib/mrkdwn';

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
    expect(autoBullet('  - ', 4)).toEqual({ value: '  ◦ ', caret: 4 });
    expect(autoBullet('a * ', 4)).toBeNull();
  });
  it('continues and ends lists on Enter', () => {
    expect(continueList('• 사과', 4)).toEqual({ value: '• 사과\n• ', caret: 7 });
    expect(continueList('3. 셋', 4)).toEqual({ value: '3. 셋\n4. ', caret: 8 });
    expect(continueList('• ', 2)).toEqual({ value: '', caret: 0 });
    expect(continueList('그냥 글', 4)).toBeNull();
  });
  it('indents and outdents list lines', () => {
    // 노션처럼 단계마다 글머리표가 바뀐다
    expect(indentLine('• 하나', 4, false)).toEqual({ value: '\t◦ 하나', caret: 5 });
    expect(indentLine('\t◦ 하나', 5, false)).toEqual({ value: '\t\t▪ 하나', caret: 6 });
    expect(indentLine('\t◦ 하나', 5, true)).toEqual({ value: '• 하나', caret: 4 });
    expect(indentLine('  • 하나', 6, true)).toEqual({ value: '• 하나', caret: 4 });
    expect(indentLine('3. 셋', 4, false)).toEqual({ value: '\t1. 셋', caret: 5 });
    expect(continueList('\t◦ 둘', 4)).toEqual({ value: '\t◦ 둘\n\t◦ ', caret: 8 });
    expect(parseBlocks('• a\n\t◦ b\n\t\t▪ c')).toEqual([{ t: 'ul', items: [
      { depth: 0, c: [{ t: 'text', v: 'a' }] }, { depth: 1, c: [{ t: 'text', v: 'b' }] }, { depth: 2, c: [{ t: 'text', v: 'c' }] }] }]);
    expect(indentLine('글', 1, false)).toBeNull();
  });
});

describe('toolbar edits', () => {
  it('wraps and unwraps inline marks', () => {
    expect(wrapInline('a bc d', 2, 4, '*')).toEqual({ value: 'a *bc* d', start: 3, end: 5 });
    expect(wrapInline('a *bc* d', 3, 5, '*')).toEqual({ value: 'a bc d', start: 2, end: 4 });
    expect(wrapInline('ab', 1, 1, '`')).toEqual({ value: 'a``b', start: 2, end: 2 });
  });
  it('makes a code block', () => {
    expect(wrapCodeBlock('x\ny', 2, 3).value).toBe('x\n```\ny\n```');
    expect(wrapCodeBlock('', 0, 0)).toEqual({ value: '```\n\n```', start: 4, end: 4 });
  });
  it('toggles lists and quotes on lines', () => {
    expect(toggleLines('a\nb', 0, 3, 'ul').value).toBe('• a\n• b');
    expect(toggleLines('• a\n• b', 0, 7, 'ul').value).toBe('a\nb');
    expect(toggleLines('• a\nb', 0, 5, 'ol').value).toBe('1. a\n2. b');
    expect(toggleLines('hi', 1, 1, 'quote')).toEqual({ value: '> hi', start: 4, end: 4 });
  });
});

describe('autoArrow', () => {
  it('turns -> and <- into arrows, but not inside code', () => {
    expect(autoArrow('a ->', 4)).toEqual({ value: 'a →', caret: 3 });
    expect(autoArrow('<-x', 2)).toEqual({ value: '←x', caret: 1 });
    expect(autoArrow('`a ->', 5)).toBeNull();
    expect(autoArrow('a -', 3)).toBeNull();
  });
});

describe('korean', () => {
  it('formats marks glued to korean words but not inside english words or numbers', () => {
    expect(parseInline('*중요*한 말')).toEqual([{ t: 'b', c: [{ t: 'text', v: '중요' }] }, { t: 'text', v: '한 말' }]);
    expect(parseInline('정말~취소~했어')).toEqual([{ t: 'text', v: '정말' }, { t: 's', c: [{ t: 'text', v: '취소' }] }, { t: 'text', v: '했어' }]);
    expect(parseInline('snake_case_name')).toEqual([{ t: 'text', v: 'snake_case_name' }]);
    expect(parseInline('1~3시 5~6시')).toEqual([{ t: 'text', v: '1~3시 5~6시' }]);
  });
});

describe('toEditorHtml', () => {
  it('turns saved text into editor html with nested lists', () => {
    expect(toEditorHtml('제목\n\n*굵게* `c` <x>')).toBe('<div>제목</div><div><br></div><div><b>굵게</b> <code>c</code> &lt;x&gt;</div>');
    expect(toEditorHtml('• a\n\t◦ b\n\t\t▪ c\n• d')).toBe('<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li><li>d</li></ul>');
    expect(toEditorHtml('1. a\n2. b\n\t• c')).toBe('<ol><li>a</li><li>b<ul><li>c</li></ul></li></ol>');
    expect(toEditorHtml('> 인용\n```\nx\n```')).toBe('<blockquote><div>인용</div></blockquote><pre>x</pre>');
    expect(toEditorHtml('')).toBe('<div><br></div>');
  });
});

describe('escapes', () => {
  it('keeps typed marks as plain characters', () => {
    expect(parseInline('가\\*나\\*다')).toEqual([{ t: 'text', v: '가*나*다' }]);
    expect(parseInline('C:\\path \\\\')).toEqual([{ t: 'text', v: 'C:\\path \\' }]);
    expect(toEditorHtml('\\*별\\*')).toBe('<div>*별*</div>');
  });
});

describe('underline', () => {
  it('reads ++underline++ and keeps a+b or 1++ as text', () => {
    expect(parseInline('정말 ++중요++해')).toEqual([{ t: 'text', v: '정말 ' }, { t: 'u', c: [{ t: 'text', v: '중요' }] }, { t: 'text', v: '해' }]);
    expect(parseInline('c++ 와 a+b')).toEqual([{ t: 'text', v: 'c++ 와 a+b' }]);
    expect(toEditorHtml('++밑줄++')).toBe('<div><u>밑줄</u></div>');
  });
});

describe('todo', () => {
  it('reads [ ] and [x] lines as a checklist', () => {
    expect(parseBlocks('[ ] 우유\n[x] 빵')).toEqual([{ t: 'todo', items: [
      { depth: 0, done: false, c: [{ t: 'text', v: '우유' }] }, { depth: 0, done: true, c: [{ t: 'text', v: '빵' }] }] }]);
    expect(toEditorHtml('[ ] 우유\n\t[x] 빵\n• 기타')).toBe('<ul class="todo"><li>우유<ul class="todo"><li data-done="1">빵</li></ul></li></ul><ul><li>기타</li></ul>');
  });
});
