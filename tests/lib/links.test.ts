import { describe, expect, it } from 'vitest';
import { describeSlackLink, splitLinks } from '@/lib/links';

describe('splitLinks', () => {
  it('splits text into plain text and http(s) links', () => {
    expect(splitLinks('참고: https://example.com/a?b=1 확인')).toEqual([
      { type: 'text', text: '참고: ' },
      { type: 'link', url: 'https://example.com/a?b=1' },
      { type: 'text', text: ' 확인' },
    ]);
  });
  it('drops trailing punctuation and ignores non-http schemes', () => {
    expect(splitLinks('(https://a.slack.com/archives/C1/p1.)')).toEqual([
      { type: 'text', text: '(' },
      { type: 'link', url: 'https://a.slack.com/archives/C1/p1' },
      { type: 'text', text: '.)' },
    ]);
    expect(splitLinks('javascript:alert(1)')).toEqual([{ type: 'text', text: 'javascript:alert(1)' }]);
  });
});

describe('describeSlackLink', () => {
  it('recognises Slack message and channel links', () => {
    expect(describeSlackLink('https://myteam.slack.com/archives/C024BE91L/p1700000000123456')).toEqual({ workspace: 'myteam', kind: '메시지' });
    expect(describeSlackLink('https://myteam.slack.com/archives/C024BE91L')).toEqual({ workspace: 'myteam', kind: '채널' });
    expect(describeSlackLink('https://app.slack.com/client/T1/C2')).toEqual({ workspace: null, kind: '링크' });
    expect(describeSlackLink('https://example.com/slack.com')).toBeNull();
  });
});
