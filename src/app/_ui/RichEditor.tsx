'use client';

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { MiniAvatar } from './AvatarContext';
import { markFor, toEditorHtml } from '@/lib/mrkdwn';

/**
 * 보이는 그대로 편집하는 메모 칸. 서식은 단축키·아래 버튼으로만 넣는다(* 같은 기호를 직접 치지 않음).
 * 저장은 지금처럼 슬랙식 글(*굵게* • 목록 …)로 해서 목록 미리 보기·검색·다른 화면이 그대로 동작한다.
 */
export type FormatKey = 'b' | 'i' | 'u' | 's' | 'code' | 'ol' | 'ul' | 'todo' | 'q' | 'pre';
export type RichEditorHandle = {
  apply: (key: FormatKey) => void; focus: () => void;
  /** 다른 사람이 고친 글로 바꾸기(내 커서는 같은 줄·같은 자리에 둔다) */
  setText: (text: string) => void;
  /** 내 커서가 있는 줄(편집 칸에 포커스가 없으면 null) */
  caretLine: () => number | null;
};
/** 같이 보고 있는 사람이 있는 줄 */
export type Mark = { key: number; name: string; line: number };
type Props = { id?: string; autoFocus?: boolean; readOnly?: boolean; marks?: Mark[]; initial: string; onChange?: (text: string) => void; onBlur?: () => void; placeholder?: string; ariaLabel?: string };

const BLOCK = new Set(['DIV', 'P', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

const clean = (s: string) => s.replace(/\u200b/g, '').replace(/\u00a0/g, ' ');
// 글자로 친 * _ ~ ` \ 는 서식이 아니므로 \ 를 붙여 저장한다
const escText = (s: string) => clean(s).replace(/[\\*_~`]|\+(?=\+)/g, (c) => `\\${c}`);
function wrap(mark: string, inner: string): string {
  if (!inner.trim()) return inner;
  const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
}
function inline(n: Node): string {
  if (n.nodeType === Node.TEXT_NODE) return escText((n as Text).data);
  if (n.nodeType !== Node.ELEMENT_NODE) return '';
  const el = n as HTMLElement;
  const kids = () => Array.from(el.childNodes).map(inline).join('');
  switch (el.nodeName) {
    case 'BR': return ' ';
    case 'B': case 'STRONG': return wrap('*', kids());
    case 'I': case 'EM': return wrap('_', kids());
    case 'S': case 'STRIKE': case 'DEL': return wrap('~', kids());
    case 'U': case 'INS': return wrap('++', kids());
    case 'CODE': { const t = clean(el.textContent ?? ''); return t ? `\`${t}\`` : ''; }
    case 'UL': case 'OL': return '';
    default: {
      // 브라우저가 span 스타일로 서식을 남길 때도 있다
      let t = kids();
      const st = el.style;
      if (st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) t = wrap('*', t);
      if (st.fontStyle === 'italic') t = wrap('_', t);
      if (st.textDecoration.includes('underline') || st.textDecorationLine?.includes('underline')) t = wrap('++', t);
      if (st.textDecoration.includes('line-through') || st.textDecorationLine?.includes('line-through')) t = wrap('~', t);
      return t;
    }
  }
}
function listLines(list: HTMLElement, depth: number): string[] {
  const out: string[] = [];
  let n = 1;
  for (const c of Array.from(list.children)) {
    if (c.nodeName === 'UL' || c.nodeName === 'OL') { out.push(...listLines(c as HTMLElement, depth + 1)); continue; }
    if (c.nodeName !== 'LI') continue;
    const text = Array.from(c.childNodes).filter((x) => x.nodeName !== 'UL' && x.nodeName !== 'OL').map(inline).join('').trim();
    const mark = list.classList.contains('todo') ? ((c as HTMLElement).dataset.done ? '[x] ' : '[ ] ')
      : list.nodeName === 'UL' ? `${markFor(depth)} ` : `${n++}. `;
    out.push('\t'.repeat(depth) + mark + text);
    for (const sub of Array.from(c.children)) if (sub.nodeName === 'UL' || sub.nodeName === 'OL') out.push(...listLines(sub as HTMLElement, depth + 1));
  }
  return out;
}
function blockLines(el: HTMLElement): string[] {
  const out: string[] = [];
  let cur: string | null = null;
  const end = () => { if (cur !== null) { out.push(cur); cur = null; } };
  for (const n of Array.from(el.childNodes)) {
    const tag = n.nodeName;
    if (BLOCK.has(tag)) {
      end();
      const b = n as HTMLElement;
      if (tag === 'UL' || tag === 'OL') out.push(...listLines(b, 0));
      else if (tag === 'BLOCKQUOTE') out.push(...blockLines(b).map((l) => `> ${l}`));
      else if (tag === 'PRE') out.push('```', ...clean(b.innerText).replace(/\n$/, '').split('\n'), '```');
      else { const inner = blockLines(b); out.push(...(inner.length ? inner : [''])); }
    } else if (tag === 'BR') { out.push(cur ?? ''); cur = null; }
    else cur = (cur ?? '') + inline(n);
  }
  end();
  return out;
}
/** 편집기 내용 → 저장할 글 */
export function fromEditor(root: HTMLElement): string {
  const lines = blockLines(root);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join('\n');
}

/**
 * 편집 칸의 '줄'(한 줄로 저장되는 칸) 목록: 맨 위 줄, 목록 항목 하나하나, 인용 안의 줄, 코드 블록.
 * 같이 보는 사람의 커서 줄을 주고받을 때 이 순서를 쓴다.
 */
function lineNodes(root: Node): Node[] {
  const out: Node[] = [];
  let run = false; // 블록 밖에 바로 있는 글자 묶음은 한 줄
  for (const n of Array.from(root.childNodes)) {
    const tag = n.nodeName;
    if (BLOCK.has(tag)) {
      run = false;
      if (tag === 'UL' || tag === 'OL') out.push(...Array.from((n as Element).querySelectorAll('li')));
      else if (tag === 'PRE') out.push(n);
      else if (Array.from(n.childNodes).some((c) => BLOCK.has(c.nodeName))) out.push(...lineNodes(n));
      else out.push(n);
    } else if (tag === 'BR') run = false;
    else if (!run) { out.push(n); run = true; }
  }
  return out;
}
/** 줄 안의 글자들(아래 단계 목록은 빼고) */
function textNodes(node: Node): Text[] {
  if (node.nodeType === Node.TEXT_NODE) return [node as Text];
  const out: Text[] = [];
  for (const c of Array.from(node.childNodes)) if (c.nodeName !== 'UL' && c.nodeName !== 'OL') out.push(...textNodes(c));
  return out;
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
/** 슬랙과 같은 단축키 */
export const SHORTCUTS: { key: FormatKey; code: string; shift?: boolean; alt?: boolean }[] = [
  { key: 'b', code: 'KeyB' }, { key: 'i', code: 'KeyI' }, { key: 'u', code: 'KeyU' }, { key: 's', code: 'KeyX', shift: true },
  { key: 'code', code: 'KeyC', shift: true }, { key: 'pre', code: 'KeyC', shift: true, alt: true },
  { key: 'ol', code: 'Digit7', shift: true }, { key: 'ul', code: 'Digit8', shift: true }, { key: 'q', code: 'Digit9', shift: true },
];

export const RichEditor = forwardRef<RichEditorHandle, Props>(function RichEditor({ id, autoFocus, readOnly, marks = [], initial, onChange, onBlur, placeholder, ariaLabel }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [tops, setTops] = useState<Map<number, { top: number; h: number }>>(new Map());
  // 같이 보는 사람 표시 위치(그 줄의 높이)를 잰다
  const measure = () => {
    const el = box.current;
    if (!el) return;
    const lines = lineNodes(el);
    const base = el.getBoundingClientRect().top;
    const next = new Map<number, { top: number; h: number }>();
    for (const m of marks) {
      const n = lines[Math.min(m.line, lines.length - 1)];
      if (!n) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      const rect = r.getClientRects()[0] ?? (n instanceof Element ? n.getBoundingClientRect() : null);
      if (rect) next.set(m.key, { top: rect.top - base, h: Math.max(rect.height, 22) });
    }
    setTops(next);
  };
  const marksKey = marks.map((m) => `${m.key}:${m.line}`).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => measure(), [marksKey]);
  useEffect(() => {
    const on = () => measure();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  });
  const emit = () => {
    const el = box.current;
    if (!el) return;
    const text = fromEditor(el);
    el.classList.toggle('empty', !text);
    onChange?.(text);
    if (marks.length) measure();
  };

  const caretLine = (): number | null => {
    const el = box.current, sel = getSelection();
    if (!el || !sel?.anchorNode || document.activeElement !== el || !el.contains(sel.anchorNode)) return null;
    let hit = -1;
    lineNodes(el).forEach((n, i) => { if (n === sel.anchorNode || n.contains(sel.anchorNode)) hit = i; });
    return hit < 0 ? 0 : hit;
  };

  const setText = (text: string) => {
    const el = box.current;
    if (!el) return;
    // 지금 커서: 몇 번째 줄의 몇 번째 글자
    const sel = getSelection();
    const line = caretLine();
    let offset = 0;
    if (line !== null && sel?.anchorNode) {
      for (const t of textNodes(lineNodes(el)[line])) {
        if (t === sel.anchorNode) { offset += sel.anchorOffset; break; }
        if (t.compareDocumentPosition(sel.anchorNode) & Node.DOCUMENT_POSITION_FOLLOWING) offset += t.data.length; else break;
      }
    }
    el.innerHTML = toEditorHtml(text);
    el.classList.toggle('empty', !text.trim());
    if (line !== null && sel) {
      const lines = lineNodes(el);
      const n = lines[Math.min(line, lines.length - 1)];
      if (n) {
        const r = document.createRange();
        let left = offset, placed = false;
        for (const t of textNodes(n)) {
          if (left <= t.data.length) { r.setStart(t, left); placed = true; break; }
          left -= t.data.length;
        }
        if (!placed) { r.selectNodeContents(n); r.collapse(false); }
        r.collapse(true);
        sel.removeAllRanges(); sel.addRange(r);
      }
    }
    measure();
  };

  // 처음 한 번만 내용을 채운다(입력 중에 다시 그리면 커서가 튄다). 메모가 바뀌면 key로 새로 만든다.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerHTML = toEditorHtml(initial);
    el.classList.toggle('empty', !initial.trim());
    if (autoFocus && !readOnly) el.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closest = (tag: string) => {
    const n = getSelection()?.anchorNode ?? null;
    const el = n && (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement);
    const hit = el?.closest(tag);
    return hit && box.current?.contains(hit) ? (hit as HTMLElement) : null;
  };

  /** 커서가 있는 줄 하나를 목록으로(브라우저 명령은 옆 목록과 멋대로 합쳐서 직접 만든다) */
  const makeList = (kind: 'ul' | 'ol' | 'todo') => {
    const el = box.current, sel = getSelection();
    if (!el || !sel?.anchorNode) return;
    let line = lineNodes(el).find((n) => n === sel.anchorNode || n.contains(sel.anchorNode)) ?? null;
    if (!line) return;
    if (line.nodeType === Node.TEXT_NODE || !BLOCK.has(line.nodeName)) {
      // 맨 위에 그냥 있는 글자 묶음 → 줄(div)로 감싼다
      const d = document.createElement('div');
      let n: ChildNode | null = line as ChildNode;
      line.parentNode!.insertBefore(d, line);
      while (n && !BLOCK.has(n.nodeName) && n.nodeName !== 'BR') { const next: ChildNode | null = n.nextSibling; d.appendChild(n); n = next; }
      if (n?.nodeName === 'BR') n.remove();
      line = d;
    }
    const blk = line as HTMLElement;
    const list = document.createElement(kind === 'ol' ? 'ol' : 'ul');
    if (kind === 'todo') list.className = 'todo';
    const li = document.createElement('li');
    li.append(...Array.from(blk.childNodes));
    if (!clean(li.textContent ?? '') && !li.querySelector('br')) li.appendChild(document.createElement('br'));
    list.appendChild(li);
    blk.replaceWith(list);
    // 바로 위·아래가 같은 종류 목록이면 이어 붙인다
    const sameKind = (x: Element | null) => !!x && x.nodeName === list.nodeName && x.classList.contains('todo') === (kind === 'todo');
    const prev = list.previousElementSibling, next = list.nextElementSibling;
    if (sameKind(prev)) { prev!.append(...Array.from(list.childNodes)); list.remove(); if (sameKind(next)) { prev!.append(...Array.from(next!.childNodes)); next!.remove(); } }
    else if (sameKind(next)) { next!.prepend(...Array.from(list.childNodes)); list.remove(); }
    const r = document.createRange(); r.selectNodeContents(li); r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
  };

  /** 커서가 있는 줄의 서식을 한 단계 푼다. 풀었으면 true */
  const unformat = (how: 'enter' | 'back'): boolean => {
    const el = box.current, sel = getSelection();
    if (!el || !sel?.rangeCount || !sel.isCollapsed) return false;
    const li = closest('li'), quote = closest('blockquote'), pre = closest('pre');
    const lines = lineNodes(el);
    const line = lines.find((n, i) => (n === sel.anchorNode || n.contains(sel.anchorNode)) && !lines.slice(i + 1).some((m) => m.contains(sel.anchorNode)));
    if (!line) return false;
    const before = document.createRange(); before.selectNodeContents(line); before.setEnd(sel.anchorNode!, sel.anchorOffset);
    const atStart = !clean(before.toString());
    const empty = !textNodes(line).some((t) => clean(t.data).trim());
    const caretTo = (n: Node) => { const r = document.createRange(); r.selectNodeContents(n); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); };
    const newLineAfter = (blockEl: Element) => {
      const d = document.createElement('div'); d.appendChild(document.createElement('br'));
      blockEl.after(d); caretTo(d);
    };
    if (li) {
      // 빈 항목에서 Enter, 항목 맨 앞에서 Backspace → 한 단계 밖으로(맨 바깥이면 보통 줄)
      if (!((how === 'enter' && empty) || (how === 'back' && atStart))) return false;
      const list = li.parentElement!;
      if (list.parentElement?.closest('li')) { document.execCommand('outdent'); return true; }
      // 맨 바깥 항목: 목록을 둘로 나누고 그 사이에 보통 줄로 (브라우저 명령은 스타일 span을 남겨서 직접)
      const d = document.createElement('div');
      const nested: Element[] = [];
      for (const c of Array.from(li.childNodes)) {
        if (c.nodeName === 'UL' || c.nodeName === 'OL') nested.push(c as Element); else d.appendChild(c);
      }
      if (!clean(d.textContent ?? '') && !d.querySelector('br')) d.appendChild(document.createElement('br'));
      const rest = Array.from(list.children).slice(Array.from(list.children).indexOf(li) + 1);
      list.after(d);
      let tail: Element = d;
      for (const n of nested) { tail.after(n); tail = n; }
      if (rest.length) { const l2 = list.cloneNode(false) as HTMLElement; l2.append(...rest); tail.after(l2); }
      li.remove();
      if (!list.children.length) list.remove();
      caretTo(d);
      return true;
    }
    if (quote && ((how === 'enter' && empty) || (how === 'back' && atStart))) {
      if (how === 'enter') {
        // 빈 줄을 지우고 인용 밖 다음 줄로
        if (line !== quote && line.parentNode === quote) line.parentNode.removeChild(line);
        if (!clean(quote.textContent ?? '').trim()) { const d = document.createElement('div'); d.appendChild(document.createElement('br')); quote.replaceWith(d); caretTo(d); }
        else newLineAfter(quote);
      } else {
        // 이 줄만 인용 밖으로(앞뒤 인용은 그대로)
        const d = document.createElement('div');
        if (line === quote) { d.append(...Array.from(quote.childNodes)); quote.replaceWith(d); }
        else {
          d.append(...Array.from(line.childNodes));
          const rest = Array.from(quote.childNodes).slice(Array.from(quote.childNodes).indexOf(line as ChildNode) + 1);
          quote.after(d);
          if (rest.length) { const q2 = document.createElement('blockquote'); q2.append(...rest); d.after(q2); }
          line.parentNode?.removeChild(line);
          if (!quote.childNodes.length) quote.remove();
        }
        if (!d.childNodes.length) d.appendChild(document.createElement('br'));
        caretTo(d);
      }
      return true;
    }
    if (pre) {
      const text = pre.innerText;
      const after = document.createRange(); after.selectNodeContents(pre); after.setStart(sel.anchorNode!, sel.anchorOffset);
      const atEnd = !clean(after.toString());
      // 코드 블록 끝의 빈 줄에서 Enter → 블록 밖으로 (브라우저는 줄바꿈을 <br>로 넣기도 한다)
      if (how === 'enter' && atEnd && (text.endsWith('\n') || !clean(text).trim())) {
        while (pre.lastChild && (pre.lastChild.nodeName === 'BR' || (pre.lastChild.nodeType === Node.TEXT_NODE && !clean((pre.lastChild as Text).data).replace(/\n/g, '')))) pre.lastChild.remove();
        if (pre.lastChild?.nodeType === Node.TEXT_NODE) (pre.lastChild as Text).data = (pre.lastChild as Text).data.replace(/\n+$/, '');
        if (!clean(pre.textContent ?? '').trim()) { const d = document.createElement('div'); d.appendChild(document.createElement('br')); pre.replaceWith(d); caretTo(d); }
        else newLineAfter(pre);
        return true;
      }
      if (how === 'back' && atStart) { document.execCommand('formatBlock', false, 'div'); return true; }
    }
    return false;
  };

  const apply = (key: FormatKey) => {
    const el = box.current;
    if (!el) return;
    if (document.activeElement !== el) el.focus();
    document.execCommand('defaultParagraphSeparator', false, 'div');
    switch (key) {
      case 'b': document.execCommand('bold'); break;
      case 'i': document.execCommand('italic'); break;
      case 'u': document.execCommand('underline'); break;
      case 's': document.execCommand('strikeThrough'); break;
      case 'ul': case 'todo': {
        const todo = closest('ul.todo'), ul = closest('ul'), ol = closest('ol');
        const collapsed = getSelection()?.isCollapsed ?? true;
        if (key === 'ul' && todo) { todo.classList.remove('todo'); break; } // 체크리스트 → 글머리표
        if (key === 'todo' && ul && !todo && !ol) { ul.classList.add('todo'); break; } // 글머리표 → 체크리스트
        if ((key === 'todo' && todo) || (key === 'ul' && ul) || ol) { document.execCommand(ol && !ul ? 'insertOrderedList' : 'insertUnorderedList'); if (!ol) break; }
        if (collapsed && !closest('li')) makeList(key);
        else if (!closest('li')) { document.execCommand('insertUnorderedList'); if (key === 'todo') closest('ul')?.classList.add('todo'); }
        break;
      }
      case 'ol': {
        if (closest('ol')) { document.execCommand('insertOrderedList'); break; }
        if ((getSelection()?.isCollapsed ?? true) && !closest('li')) makeList('ol'); else document.execCommand('insertOrderedList');
        break;
      }
      case 'q': document.execCommand('formatBlock', false, closest('blockquote') ? 'div' : 'blockquote'); break;
      case 'pre': document.execCommand('formatBlock', false, closest('pre') ? 'div' : 'pre'); break;
      case 'code': {
        const sel = getSelection();
        if (!sel || !sel.rangeCount) break;
        const at = (node: Node, off: number) => { const r = document.createRange(); r.setStart(node, off); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); };
        const code = closest('code');
        if (code) {
          const tail = document.createRange(); tail.selectNodeContents(code);
          tail.setStart(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
          if (sel.isCollapsed && !clean(tail.toString())) {
            // 코드 끝에서 다시 누르면 코드 밖으로 나가서 이어 쓰기
            const after = document.createTextNode('\u200b');
            code.after(after); at(after, 1);
          } else {
            const t = document.createTextNode(clean(code.textContent ?? ''));
            code.replaceWith(t); at(t, t.data.length);
          }
          break;
        }
        // 브라우저 명령(insertHTML)은 <code>를 스타일 span으로 바꿔 버려서 직접 넣는다
        const range = sel.getRangeAt(0);
        const text = range.toString();
        const made = document.createElement('code');
        made.textContent = text || '\u200b';
        range.deleteContents();
        range.insertNode(made);
        const r = document.createRange(); r.selectNodeContents(made); if (!text) r.collapse(false);
        sel.removeAllRanges(); sel.addRange(r);
        if (text) { r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
        break;
      }
    }
    emit();
  };

  useImperativeHandle(ref, () => ({ apply, focus: () => box.current?.focus(), setText, caretLine }));

  return (
    <div className="rich-wrap">
    {marks.map((m) => {
      const at = tops.get(m.key);
      return at && (
        // 그 사람이 있는 줄 오른쪽 끝에 작은 프로필
        <span key={m.key} className="rich-mark" style={{ top: at.top, height: at.h }} title={`${m.name} 님이 여기를 편집 중`}>
          <MiniAvatar name={m.name} size={16} />
        </span>
      );
    })}
    <div ref={box} id={id} className={`rich-ed${readOnly ? ' readonly' : ''}`} contentEditable={!readOnly} suppressContentEditableWarning
      role="textbox" aria-multiline aria-readonly={readOnly || undefined}
      aria-label={ariaLabel} data-ph={placeholder} spellCheck={false}
      onMouseDown={(e) => {
        // 체크리스트: 줄 앞 네모를 누르면 체크/해제
        if (readOnly) return;
        const t = e.target as HTMLElement;
        // 네모는 항목 왼쪽(목록 여백)에 있어서, 목록을 눌렀으면 높이로 항목을 찾는다
        const li = t.nodeName === 'UL' && t.classList.contains('todo')
          ? (Array.from(t.children).find((c) => { const r = c.getBoundingClientRect(); return c.nodeName === 'LI' && e.clientY >= r.top && e.clientY < r.top + 26; }) as HTMLElement | undefined) ?? null
          : t.closest('li');
        if (!li || li.parentElement?.classList.contains('todo') !== true) return;
        const r = li.getBoundingClientRect();
        if (e.clientX > r.left + 2) return; // 네모는 항목 왼쪽 바깥에 그려진다
        e.preventDefault();
        if (li.dataset.done) delete li.dataset.done; else li.dataset.done = '1';
        emit();
      }}
      onInput={(e) => {
        const ne = e.nativeEvent as InputEvent;
        // 새로 생긴 체크 항목은 체크 안 된 채로
        if (ne.inputType === 'insertParagraph') {
          const li = closest('li');
          if (li?.dataset.done && !clean(li.textContent ?? '').trim()) delete li.dataset.done;
        }
        // 줄 맨 앞에서 "* "·"- " → 글머리표, "1. " → 번호, "[] " → 체크리스트 (노션처럼)
        if (ne.inputType === 'insertText' && ne.data === ' ' && !closest('li') && !closest('pre') && !closest('code')) {
          const sel = getSelection(), el = box.current;
          const line = el && sel?.anchorNode ? lineNodes(el).find((n) => n === sel.anchorNode || n.contains(sel.anchorNode)) : null;
          if (sel && line) {
            const head = document.createRange(); head.selectNodeContents(line); head.setEnd(sel.anchorNode!, sel.anchorOffset);
            const typed = clean(head.toString());
            const kind = typed === '* ' || typed === '- ' ? 'ul' : typed === '1. ' ? 'ol' : typed === '[] ' || typed === '[ ] ' ? 'todo' : null;
            if (kind) {
              head.deleteContents();
              makeList(kind);
            }
          }
        }
        // 노션처럼 -> 는 →, <- 는 ← (코드 안에서는 그대로)
        if (ne.inputType === 'insertText' && (ne.data === '>' || ne.data === '-')) {
          const sel = getSelection();
          const node = sel?.anchorNode;
          if (sel && node && node.nodeType === Node.TEXT_NODE && !closest('code') && !closest('pre')) {
            const off = sel.anchorOffset;
            const two = (node as Text).data.slice(off - 2, off);
            const arrow = two === '->' ? '→' : two === '<-' ? '←' : null;
            if (arrow) {
              const r = document.createRange(); r.setStart(node, off - 2); r.setEnd(node, off);
              sel.removeAllRanges(); sel.addRange(r);
              document.execCommand('insertText', false, arrow);
            }
          }
        }
        emit();
      }}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        const mod = isMac() ? e.metaKey : e.ctrlKey;
        if (mod) {
          const hit = SHORTCUTS.find((s) => s.code === e.code && !!s.shift === e.shiftKey && !!s.alt === e.altKey);
          if (hit) { e.preventDefault(); apply(hit.key); return; }
        }
        // 노션·슬랙처럼: 빈 줄에서 Enter, 줄 맨 앞에서 Backspace 하면 목록·인용·코드 블록이 풀린다
        if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Backspace') {
          if (unformat(e.key === 'Enter' ? 'enter' : 'back')) { e.preventDefault(); emit(); return; }
        }
        if (e.key === 'Tab' && closest('li')) {
          e.preventDefault();
          document.execCommand(e.shiftKey ? 'outdent' : 'indent');
          emit();
        }
      }}
      onPaste={(e) => {
        // 다른 곳의 서식·색은 빼고 글자만 붙인다
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      }}
      onBlur={onBlur} />
    </div>
  );
});
