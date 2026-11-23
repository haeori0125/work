// 설명 글 속 링크를 찾아낸다(화면에서 눌러 열 수 있게). http/https만 링크로 본다.

export type Segment = { type: 'text'; text: string } | { type: 'link'; url: string };

const URL_RE = /https?:\/\/[^\s<>"'`]+/g;
const TRAILING = /[.,;:!?)\]}'"…]+$/;

export function splitLinks(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    const trail = url.match(TRAILING)?.[0] ?? '';
    if (trail) url = url.slice(0, -trail.length);
    const start = m.index!;
    if (start > last) out.push({ type: 'text', text: text.slice(last, start) });
    out.push({ type: 'link', url });
    last = start + url.length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  // 이웃한 글자 조각은 합친다
  return out.reduce<Segment[]>((acc, s) => {
    const prev = acc[acc.length - 1];
    if (s.type === 'text' && prev?.type === 'text') prev.text += s.text;
    else acc.push({ ...s });
    return acc;
  }, []);
}

/** 슬랙 링크면 워크스페이스와 종류(메시지/채널/링크), 아니면 null */
export function describeSlackLink(url: string): { workspace: string | null; kind: '메시지' | '채널' | '링크' } | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase();
  if (host !== 'slack.com' && !host.endsWith('.slack.com')) return null;
  const sub = host.endsWith('.slack.com') ? host.slice(0, -'.slack.com'.length) : '';
  const workspace = sub && sub !== 'app' && !sub.includes('.') ? sub : null;
  const m = u.pathname.match(/^\/archives\/[A-Z0-9]+(\/p\d+)?/);
  return { workspace, kind: m ? (m[1] ? '메시지' : '채널') : '링크' };
}
