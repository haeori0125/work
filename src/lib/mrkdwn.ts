// 슬랙처럼 쓰는 글 서식: *굵게* _기울임_ ~취소선~ `코드` ```코드 블록``` > 인용, 글머리표(• - *), 번호 목록(1.)
// 화면과 상관없는 순수 함수라 서버·브라우저·테스트에서 같이 쓴다.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'b' | 'i' | 's' | 'u'; c: Inline[] };

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'quote'; lines: Inline[][] }
  | { t: 'pre'; v: string }
  | { t: 'ul'; items: { depth: number; c: Inline[] }[] }
  | { t: 'ol'; items: { depth: number; n: number; c: Inline[] }[] }
  | { t: 'todo'; items: { depth: number; done: boolean; c: Inline[] }[] }
  | { t: 'gap' };

const MARKS: [string, 'b' | 'i' | 's'][] = [['*', 'b'], ['_', 'i'], ['~', 's']];

// 기호 앞뒤가 영문·숫자에 붙어 있으면 서식이 아님(snake_case, 1~3 같은 것).
// 한글은 조사가 바로 붙으니(*중요*한) 붙어 있어도 서식으로 본다.
const WORDY = /[A-Za-z0-9]/;

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
    // \* 처럼 앞에 \ 를 붙인 기호는 글자 그대로
    if (ch === '\\' && i + 1 < src.length && '\\*_~`+'.includes(src[i + 1])) { push(src[i + 1]); i += 2; continue; }
    if (ch === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i + 1) { out.push({ t: 'code', v: src.slice(i + 1, end) }); i = end + 1; continue; }
    }
    // 밑줄: ++글자++ (슬랙에는 없어서 따로 정함)
    if (ch === '+' && src[i + 1] === '+') {
      const end = src.indexOf('++', i + 2);
      const inner = end > i + 2 ? src.slice(i + 2, end) : '';
      const before = i === 0 ? ' ' : src[i - 1];
      const after = end >= 0 && end + 2 < src.length ? src[end + 2] : ' ';
      if (inner && !/\s/.test(inner[0]) && !/\s/.test(inner[inner.length - 1]) && !WORDY.test(before) && !WORDY.test(after)) {
        out.push({ t: 'u', c: parseInline(inner) }); i = end + 2; continue;
      }
    }
    const mark = MARKS.find(([m]) => m === ch);
    if (mark) {
      const before = i === 0 ? ' ' : src[i - 1];
      const end = src.indexOf(ch, i + 1);
      const inner = end > i + 1 ? src.slice(i + 1, end) : '';
      const after = end >= 0 && end + 1 < src.length ? src[end + 1] : ' ';
      const ok = inner && !/\s/.test(inner[0]) && !/\s/.test(inner[inner.length - 1])
        && !WORDY.test(before) && !WORDY.test(after);
      if (ok) { out.push({ t: mark[1], c: parseInline(inner) }); i = end + 1; continue; }
    }
    push(ch);
    i += 1;
  }
  return out;
}

const BULLET = /^(\s*)(?:[•◦▪\-*])\s+(.*)$/;
/** 들여쓴 단계마다 노션처럼 다른 글머리표 */
export const BULLETS = ['•', '◦', '▪'] as const;
export const markFor = (depth: number) => BULLETS[depth % BULLETS.length];
const NUMBER = /^(\s*)(\d+)[.)]\s+(.*)$/;
/** 체크리스트: [ ] 할 일 / [x] 한 일 */
const TODO = /^(\s*)\[( |x|X)\]\s+(.*)$/;
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
    if (TODO.test(line)) {
      const items: { depth: number; done: boolean; c: Inline[] }[] = [];
      while (i < lines.length && (m = lines[i].match(TODO))) { items.push({ depth: depthOf(m[1]), done: m[2] !== ' ', c: parseInline(m[3]) }); i += 1; }
      out.push({ t: 'todo', items });
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
  const next = value.slice(0, start) + `${m[1]}${markFor(depthOf(m[1]))} ` + value.slice(caret);
  return { value: next, caret: start + m[1].length + 2 };
}

export function continueList(value: string, caret: number): { value: string; caret: number } | null {
  const start = value.lastIndexOf('\n', caret - 1) + 1;
  const line = value.slice(start, caret);
  const m = line.match(/^(\s*)([•◦▪] |\d+[.)] |> )(.*)$/);
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

/** Tab / Shift+Tab: 목록 줄을 한 단계 들여쓰기·내어쓰기(탭 한 칸). 글머리표는 단계에 맞게 •→◦→▪ */
export function indentLine(value: string, caret: number, out: boolean): { value: string; caret: number } | null {
  const start = value.lastIndexOf('\n', caret - 1) + 1;
  const endIdx = value.indexOf('\n', caret);
  const end = endIdx < 0 ? value.length : endIdx;
  const line = value.slice(start, end);
  const m = line.match(/^(\s*)([•◦▪] |\d+[.)] )/);
  if (!m) return null;
  const depth = depthOf(m[1]);
  const next = out ? depth - 1 : depth + 1;
  if (next < 0 || next > 4) return null;
  const num = m[2].match(/^\d+([.)]) $/);
  // 한 단계 들어간 번호는 1부터 다시
  const mark = num ? (out ? m[2] : `1${num[1]} `) : `${markFor(next)} `;
  const head = '\t'.repeat(next) + mark;
  const shift = head.length - m[0].length;
  return { value: value.slice(0, start) + head + line.slice(m[0].length) + value.slice(end), caret: Math.max(start + head.length, caret + shift) };
}

export type Edit = { value: string; start: number; end: number };

/** 고른 글자를 *·_·~·` 로 감싸거나(이미 감싸져 있으면 풀기), 고른 게 없으면 표시 한 쌍을 넣고 그 사이에 커서 */
export function wrapInline(value: string, s: number, e: number, mark: string): Edit {
  const n = mark.length;
  if (s >= n && value.slice(s - n, s) === mark && value.slice(e, e + n) === mark) {
    return { value: value.slice(0, s - n) + value.slice(s, e) + value.slice(e + n), start: s - n, end: e - n };
  }
  const sel = value.slice(s, e);
  if (sel.length > 2 * n && sel.startsWith(mark) && sel.endsWith(mark)) {
    const inner = sel.slice(n, -n);
    return { value: value.slice(0, s) + inner + value.slice(e), start: s, end: s + inner.length };
  }
  return { value: value.slice(0, s) + mark + sel + mark + value.slice(e), start: s + n, end: e + n };
}

/** ``` 코드 블록: 고른 글자를 블록으로 감싸거나, 빈 블록을 넣는다 */
export function wrapCodeBlock(value: string, s: number, e: number): Edit {
  const before = value.slice(0, s), sel = value.slice(s, e), after = value.slice(e);
  const pre = before && !before.endsWith('\n') ? '\n' : '';
  const post = after && !after.startsWith('\n') ? '\n' : '';
  const open = `${pre}\`\`\`\n`;
  return { value: `${before}${open}${sel}\n\`\`\`${post}${after}`, start: s + open.length, end: s + open.length + sel.length };
}

const PREFIX = /^(\s*)([•◦▪] |[-*] |\d+[.)] |> )/;

/** 고른 줄들을 글머리표·번호·인용으로 바꾸거나, 모두 이미 그렇다면 풀기 */
export function toggleLines(value: string, s: number, e: number, kind: 'ul' | 'ol' | 'quote'): Edit {
  const from = value.lastIndexOf('\n', s - 1) + 1;
  const endIdx = value.indexOf('\n', Math.max(e - (e > s && value[e - 1] === '\n' ? 1 : 0), s));
  const to = endIdx < 0 ? value.length : endIdx;
  const lines = value.slice(from, to).split('\n');
  const is = (l: string) => kind === 'ul' ? /^\s*[•◦▪] /.test(l) : kind === 'ol' ? /^\s*\d+[.)] /.test(l) : /^\s*> /.test(l);
  const filled = lines.filter((l) => l.trim());
  const remove = filled.length > 0 && filled.every(is);
  let k = 0;
  const out = lines.map((l) => {
    if (remove) return l.replace(PREFIX, '$1');
    if (!l.trim() && lines.length > 1) return l;
    const m = l.match(PREFIX);
    const indent = m ? m[1] : '';
    const rest = m ? l.slice(m[0].length) : l;
    k += 1;
    return indent + (kind === 'ul' ? `${markFor(depthOf(indent))} ` : kind === 'ol' ? `${k}. ` : '> ') + rest;
  }).join('\n');
  return { value: value.slice(0, from) + out + value.slice(to), start: lines.length === 1 && !remove ? from + out.length : from, end: from + out.length };
}

/** 노션처럼 "->" 를 치면 →, "<-" 는 ← (코드 `...` 안에서는 그대로) */
export function autoArrow(value: string, caret: number): { value: string; caret: number } | null {
  const two = value.slice(caret - 2, caret);
  const arrow = two === '->' ? '→' : two === '<-' ? '←' : null;
  if (!arrow) return null;
  const line = value.slice(value.lastIndexOf('\n', caret - 1) + 1, caret);
  if ((line.match(/`/g)?.length ?? 0) % 2 === 1) return null;
  if (/^\s*```/.test(line)) return null;
  return { value: value.slice(0, caret - 2) + arrow + value.slice(caret), caret: caret - 1 };
}

// ── 메모 편집기(보이는 그대로 편집)용: 저장된 글 → 편집기 HTML ──
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TAG = { b: 'b', i: 'i', s: 's', u: 'u' } as const;
function inlineHtml(items: Inline[]): string {
  return items.map((x) => x.t === 'text' ? esc(x.v) : x.t === 'code' ? `<code>${esc(x.v)}</code>` : `<${TAG[x.t]}>${inlineHtml(x.c)}</${TAG[x.t]}>`).join('');
}
const lineHtml = (items: Inline[]) => inlineHtml(items) || '<br>';

/** 저장된 글(슬랙식 표시)을 편집기에 넣을 HTML로. 목록은 단계대로 중첩한다 */
export function toEditorHtml(text: string): string {
  const blocks = parseBlocks(text);
  let html = '';
  let k = 0;
  while (k < blocks.length) {
    const b = blocks[k];
    if (b.t === 'ul' || b.t === 'ol' || b.t === 'todo') {
      // 이어지는 목록(글머리표·번호·체크 섞여도)을 한 덩어리로 중첩
      type Kind = 'ul' | 'ol' | 'todo';
      const items: { kind: Kind; depth: number; done: boolean; c: Inline[] }[] = [];
      while (k < blocks.length && (blocks[k].t === 'ul' || blocks[k].t === 'ol' || blocks[k].t === 'todo')) {
        const lb = blocks[k] as Extract<Block, { t: Kind }>;
        for (const it of lb.items) items.push({ kind: lb.t, depth: it.depth, done: 'done' in it && it.done, c: it.c });
        k += 1;
      }
      const open = (kind: Kind) => (kind === 'todo' ? '<ul class="todo">' : `<${kind}>`);
      const close = (kind: Kind) => `</li></${kind === 'todo' ? 'ul' : kind}>`;
      const li = (it: { done: boolean }) => (it.done ? '<li data-done="1">' : '<li>');
      const stack: Kind[] = [];
      for (const it of items) {
        const d = Math.min(it.depth, stack.length);
        while (stack.length > d + 1) html += close(stack.pop()!);
        if (stack.length === d + 1 && stack[d] !== it.kind) html += close(stack.pop()!);
        if (stack.length === d + 1) html += `</li>${li(it)}`;
        else { html += open(it.kind) + li(it); stack.push(it.kind); }
        html += lineHtml(it.c);
      }
      while (stack.length) html += close(stack.pop()!);
      continue;
    }
    if (b.t === 'p') html += `<div>${lineHtml(b.c)}</div>`;
    else if (b.t === 'gap') html += '<div><br></div>';
    else if (b.t === 'pre') html += `<pre>${esc(b.v) || '<br>'}</pre>`;
    else if (b.t === 'quote') html += `<blockquote>${b.lines.map((l) => `<div>${lineHtml(l)}</div>`).join('')}</blockquote>`;
    k += 1;
  }
  return html || '<div><br></div>';
}
