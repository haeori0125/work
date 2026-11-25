// 글 보여 주기: 슬랙식 서식 + 링크는 눌러 열 수 있게, 슬랙 링크는 카드로
import { describeSlackLink, splitLinks } from '@/lib/links';
import { parseBlocks, parseInline, type Inline } from '@/lib/mrkdwn';

function ChatIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const rest = u.pathname + u.search;
    return u.host + (rest.length > 24 ? `${rest.slice(0, 22)}…` : rest === '/' ? '' : rest);
  } catch { return url; }
}

function Links({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <>
      {splitLinks(text).map((s, i) => {
        if (s.type === 'text') return <span key={i}>{s.text}</span>;
        const slack = describeSlackLink(s.url);
        if (slack && compact) {
          // 목록에서는 카드 대신 한 줄 링크
          return (
            <a key={i} className="ext-link slack-inline" href={s.url} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}><ChatIcon />Slack {slack.kind}</a>
          );
        }
        if (slack) {
          return (
            <a key={i} className="slack-card" href={s.url} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}>
              <span className="slack-ic"><ChatIcon /></span>
              <span className="slack-txt">
                <b>Slack {slack.kind}</b>
                <small>{slack.workspace ? `${slack.workspace}.slack.com` : 'slack.com'} · 눌러서 열기</small>
              </span>
            </a>
          );
        }
        return (
          <a key={i} className="ext-link" href={s.url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}>{shortUrl(s.url)}</a>
        );
      })}
    </>
  );
}

function Inlines({ items, compact }: { items: Inline[]; compact?: boolean }) {
  return (
    <>
      {items.map((x, i) => {
        if (x.t === 'text') return <Links key={i} text={x.v} compact={compact} />;
        if (x.t === 'code') return <code key={i} className="rt-code">{x.v}</code>;
        const Tag = x.t === 'b' ? 'strong' : x.t === 'i' ? 'em' : x.t === 'u' ? 'u' : 's';
        return <Tag key={i}><Inlines items={x.c} compact={compact} /></Tag>;
      })}
    </>
  );
}

/** 슬랙처럼 쓴 글을 보여 준다: 굵게·기울임·취소선·코드·코드 블록·인용·글머리표·번호 목록 + 링크(슬랙 링크는 카드) */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`rt${className ? ` ${className}` : ''}`}>
      {parseBlocks(text).map((b, i) => {
        switch (b.t) {
          case 'p': return <p key={i}><Inlines items={b.c} /></p>;
          case 'gap': return <div key={i} className="rt-gap" />;
          case 'pre': return <pre key={i} className="rt-pre"><code>{b.v}</code></pre>;
          case 'quote': return <blockquote key={i}>{b.lines.map((l, j) => <p key={j}><Inlines items={l} /></p>)}</blockquote>;
          case 'ul': return (
            <ul key={i}>{b.items.map((it, j) => <li key={j} className={`d${it.depth % 3}`} style={{ marginLeft: it.depth * 24 }}><Inlines items={it.c} /></li>)}</ul>
          );
          case 'todo': return (
            <ul key={i} className="rt-todo">{b.items.map((it, j) => (
              <li key={j} className={it.done ? 'done' : undefined} style={{ marginLeft: it.depth * 24 }}>
                <span className="rt-box" aria-label={it.done ? '완료' : '할 일'} role="img">{it.done ? '✓' : ''}</span><Inlines items={it.c} />
              </li>
            ))}</ul>
          );
          case 'ol': return (
            <ol key={i}>{b.items.map((it, j) => <li key={j} value={it.n} style={{ marginLeft: it.depth * 24 }}><Inlines items={it.c} /></li>)}</ol>
          );
        }
      })}
    </div>
  );
}

/** 목록용: 글의 첫 줄만 한 줄로(넘치면 …), 슬랙 링크는 작은 링크로 */
export function RichLine({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n').filter((l) => l.trim());
  if (!lines.length) return null;
  const first = lines[0].replace(/^\s*(?:[•◦▪*-]|\d+[.)]|>|\[[ xX]\])\s+/, '').replace(/^\s*```/, '');
  return (
    <div className={`rt-line${className ? ` ${className}` : ''}`}>
      <Inlines items={parseInline(first)} compact />{lines.length > 1 && <span className="rt-more"> …</span>}
    </div>
  );
}
