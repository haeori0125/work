// 슬랙처럼 쓰는 글 서식: *굵게* _기울임_ ~취소선~ `코드` ```코드 블록``` > 인용, 글머리표(• - *), 번호 목록(1.)
// 화면과 상관없는 순수 함수라 서버·브라우저·테스트에서 같이 쓴다.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'b' | 'i' | 's'; c: Inline[] };

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'quote'; lines: Inline[][] }
  | { t: 'pre'; v: string }
  | { t: 'ul'; items: { depth: number; c: Inline[] }[] }
  | { t: 'ol'; items: { depth: number; n: number; c: Inline[] }[] }
  | { t: 'gap' };

const MARKS: [string, 'b' | 'i' | 's'][] = [['*', 'b'], ['_', 'i'], ['~', 's']];

/** 한 줄 안의 서식. 코드(`)가 먼저이고, 그 밖에서 * _ ~ 를 찾는다(앞뒤가 글자에 붙은 기호는 서식이 아님) */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const push = (v: string) => {
    if (!v) return;
    const last = out[out.length - 1];
    if (last?.t === 'text') last.v += v; else out.push({ t: 'text', v });
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i + 1) { out.push({ t: 'code', v: src.slice(i + 1, end) }); i = end + 1; continue; }
    }
    const mark = MARKS.find(([m]) => m === ch);
    if (mark) {
      const before = i === 0 ? ' ' : src[i - 1];
      const end = src.indexOf(ch, i + 1);
      const inner = end > i + 1 ? src.slice(i + 1, end) : '';
      const after = end >= 0 && end + 1 < src.length ? src[end + 1] : ' ';
      const ok = inner && !/\s/.test(inner[0]) && !/\s/.test(inner[inner.length - 1])
        && !/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after);
      if (ok) { out.push({ t: mark[1], c: parseInline(inner) }); i = end + 1; continue; }
    }
    push(ch);
    i += 1;
  }
  return out;
}

const BULLET = /^(\s*)(?:[•\-*])\s+(.*)$/;
const NUMBER = /^(\s*)(\d+)[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const depthOf = (indent: string) => Math.min(4, Math.floor(indent.replace(/\t/g, '  ').length / 2));

export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      // 코드 블록: 닫는 ``` 까지(없으면 끝까지)
      const first = line.trimStart().slice(3);
      const body: string[] = [];
      let j = i + 1;
      const sameLineEnd = first.endsWith('```') && first.length >= 3;
      if (sameLineEnd) { out.push({ t: 'pre', v: first.slice(0, -3) }); i += 1; continue; }
      if (first) body.push(first);
      while (j < lines.length && !lines[j].trimEnd().endsWith('```')) body.push(lines[j++]);
      if (j < lines.length) { const tail = lines[j].trimEnd().slice(0, -3); if (tail) body.push(tail); j += 1; }
      out.push({ t: 'pre', v: body.join('\n') });
      i = j;
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(QUOTE))) {
      const q: Inline[][] = [];
      while (i < lines.length && (m = lines[i].match(QUOTE))) { q.push(parseInline(m[1])); i += 1; }
      out.push({ t: 'quote', lines: q });
      continue;
    }
    if (BULLET.test(line)) {
      const items: { depth: number; c: Inline[] }[] = [];
      while (i < lines.length && (m = lines[i].match(BULLET))) { items.push({ depth: depthOf(m[1]), c: parseInline(m[2]) }); i += 1; }
      out.push({ t: 'ul', items });
      continue;
    }
    if (NUMBER.test(line)) {
      const items: { depth: number; n: number; c: Inline[] }[] = [];
      while (i < lines.length && (m = lines[i].match(NUMBER))) { items.push({ depth: depthOf(m[1]), n: Number(m[2]), c: parseInline(m[3]) }); i += 1; }
      out.push({ t: 'ol', items });
      continue;
    }
    if (!line.trim()) { out.push({ t: 'gap' }); i += 1; continue; }
    out.push({ t: 'p', c: parseInline(line) });
    i += 1;
  }
  return out;
}

/**
 * 메모 칸에서 슬랙처럼 쓰기: 줄 맨 앞 "* "·"- " → "• ", Enter는 같은 목록을 이어 가고
 * 빈 항목에서 Enter면 목록을 끝낸다. 결과는 새 글과 커서 위치(바뀔 게 없으면 null).
 */
export function autoBullet(value: string, caret: number): { value: string; caret: number } | null {
  const start = value.lastIndexOf('\n', caret - 1) + 1;
  const head = value.slice(start, caret);
  const m = head.match(/^(\s*)[*-] $/);
  if (!m) return null;
  const next = value.slice(0, start) + `${m[1]}• ` + value.slice(caret);
  return { value: next, caret: start + m[1].length + 2 };
}

export function continueList(value: string, caret: number): { value: string; caret: number } | null {
  const start = value.lastIndexOf('\n', caret - 1) + 1;
  const line = value.slice(start, caret);
  const m = line.match(/^(\s*)(• |\d+[.)] |> )(.*)$/);
  if (!m) return null;
  const [, indent, mark, rest] = m;
  if (!rest.trim()) {
    // 빈 항목에서 Enter: 목록 끝내기(표시 지우기)
    return { value: value.slice(0, start) + value.slice(caret), caret: start };
  }
  const num = mark.match(/^(\d+)([.)]) $/);
  const nextMark = num ? `${Number(num[1]) + 1}${num[2]} ` : mark;
  const insert = `\n${indent}${nextMark}`;
  return { value: value.slice(0, caret) + insert + value.slice(caret), caret: caret + insert.length };
}

/** Tab / Shift+Tab: 목록 줄을 한 단계 들여쓰기·내어쓰기 */
export function indentLine(value: string, caret: number, out: boolean): { value: string; caret: number } | null {
  const start = value.lastIndexOf('\n', caret - 1) + 1;
  const endIdx = value.indexOf('\n', caret);
  const line = value.slice(start, endIdx < 0 ? value.length : endIdx);
  if (!/^\s*(• |\d+[.)] )/.test(line)) return null;
  if (out) {
    const cut = line.startsWith('  ') ? 2 : line.startsWith('\t') ? 1 : 0;
    if (!cut) return null;
    return { value: value.slice(0, start) + line.slice(cut) + value.slice(start + line.length), caret: Math.max(start, caret - cut) };
  }
  return { value: value.slice(0, start) + '  ' + value.slice(start), caret: caret + 2 };
}
