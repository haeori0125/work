// 설명 글: 링크는 눌러 열 수 있게, 슬랙 링크는 카드로 보여 준다
import { describeSlackLink, splitLinks } from '@/lib/links';

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

export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={className}>
      {splitLinks(text).map((s, i) => {
        if (s.type === 'text') return <span key={i}>{s.text}</span>;
        const slack = describeSlackLink(s.url);
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
    </p>
  );
}
