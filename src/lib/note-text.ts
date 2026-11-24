// 메모 제목·미리 보기 규칙 (화면에서도 쓰므로 DB 코드를 가져오지 않는다)
import { parseInline, type Inline } from './mrkdwn';

/** 서식 표시(*굵게* `코드` …)는 빼고 글자만 */
const flat = (items: Inline[]): string => items.map((x) => (x.t === 'text' || x.t === 'code' ? x.v : flat(x.c))).join('');
const plain = (line: string) => flat(parseInline(line.replace(/^(\s*)> ?/, '$1').replace(/^\s*```/, '')));
export function noteTitle(body: string): string {
  return plain(body.split('\n')[0]).trim() || '새로운 메모';
}

export function notePreview(body: string): string {
  return body.split('\n').slice(1).map((l) => plain(l).trim()).filter(Boolean).join(' ') || '추가 텍스트 없음';
}
