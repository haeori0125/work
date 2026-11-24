'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { markFor, toEditorHtml } from '@/lib/mrkdwn';

/**
 * 보이는 그대로 편집하는 메모 칸. 서식은 단축키·아래 버튼으로만 넣는다(* 같은 기호를 직접 치지 않음).
 * 저장은 지금처럼 슬랙식 글(*굵게* • 목록 …)로 해서 목록 미리 보기·검색·다른 화면이 그대로 동작한다.
 */
export type FormatKey = 'b' | 'i' | 's' | 'code' | 'ol' | 'ul' | 'q' | 'pre';
export type RichEditorHandle = { apply: (key: FormatKey) => void; focus: () => void };
type Props = { id?: string; initial: string; onChange: (text: string) => void; onBlur?: () => void; placeholder?: string; ariaLabel?: string };

const BLOCK = new Set(['DIV', 'P', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

const clean = (s: string) => s.replace(/​/g, '').replace(/ /g, ' ');
function wrap(mark: string, inner: string): string {
  if (!inner.trim()) return inner;
  const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
}
function inline(n: Node): string {
  if (n.nodeType === Node.TEXT_NODE) return clean((n as Text).data);
  if (n.nodeType !== Node.ELEMENT_NODE) return '';
  const el = n as HTMLElement;
  const kids = () => Array.from(el.childNodes).map(inline).join('');
  switch (el.nodeName) {
    case 'BR': return ' ';
    case 'B': case 'STRONG': return wrap('*', kids());
    case 'I': case 'EM': return wrap('_', kids());
    case 'S': case 'STRIKE': case 'DEL': return wrap('~', kids());
    case 'CODE': { const t = clean(el.textContent ?? ''); return t ? `\`${t}\`` : ''; }
    case 'UL': case 'OL': return '';
    default: {
      // 브라우저가 span 스타일로 서식을 남길 때도 있다
      let t = kids();
      const st = el.style;
      if (st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) t = wrap('*', t);
      if (st.fontStyle === 'italic') t = wrap('_', t);
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
    const mark = list.nodeName === 'UL' ? `${markFor(depth)} ` : `${n++}. `;
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

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
/** 슬랙과 같은 단축키 */
export const SHORTCUTS: { key: FormatKey; code: string; shift?: boolean; alt?: boolean }[] = [
  { key: 'b', code: 'KeyB' }, { key: 'i', code: 'KeyI' }, { key: 's', code: 'KeyX', shift: true },
  { key: 'code', code: 'KeyC', shift: true }, { key: 'pre', code: 'KeyC', shift: true, alt: true },
  { key: 'ol', code: 'Digit7', shift: true }, { key: 'ul', code: 'Digit8', shift: true }, { key: 'q', code: 'Digit9', shift: true },
];

export const RichEditor = forwardRef<RichEditorHandle, Props>(function RichEditor({ id, initial, onChange, onBlur, placeholder, ariaLabel }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const emit = () => {
    const el = box.current;
    if (!el) return;
    const text = fromEditor(el);
    el.classList.toggle('empty', !text);
    onChange(text);
  };

  // 처음 한 번만 내용을 채운다(입력 중에 다시 그리면 커서가 튄다). 메모가 바뀌면 key로 새로 만든다.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerHTML = toEditorHtml(initial);
    el.classList.toggle('empty', !initial.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closest = (tag: string) => {
    const n = getSelection()?.anchorNode ?? null;
    const el = n && (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement);
    const hit = el?.closest(tag);
    return hit && box.current?.contains(hit) ? (hit as HTMLElement) : null;
  };

  const apply = (key: FormatKey) => {
    const el = box.current;
    if (!el) return;
    if (document.activeElement !== el) el.focus();
    document.execCommand('defaultParagraphSeparator', false, 'div');
    switch (key) {
      case 'b': document.execCommand('bold'); break;
      case 'i': document.execCommand('italic'); break;
      case 's': document.execCommand('strikeThrough'); break;
      case 'ul': document.execCommand('insertUnorderedList'); break;
      case 'ol': document.execCommand('insertOrderedList'); break;
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

  useImperativeHandle(ref, () => ({ apply, focus: () => box.current?.focus() }));

  return (
    <div ref={box} id={id} className="rich-ed" contentEditable suppressContentEditableWarning role="textbox" aria-multiline
      aria-label={ariaLabel} data-ph={placeholder} spellCheck={false}
      onInput={(e) => {
        const ne = e.nativeEvent as InputEvent;
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
          if (e.code === 'KeyU' && !e.shiftKey) { e.preventDefault(); return; } // 밑줄은 저장할 수 없어서 막는다
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
  );
});
