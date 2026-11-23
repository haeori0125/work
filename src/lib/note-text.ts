// 메모 제목·미리 보기 규칙 (화면에서도 쓰므로 DB 코드를 가져오지 않는다)
export function noteTitle(body: string): string {
  return body.split('\n')[0].trim() || '새로운 메모';
}

export function notePreview(body: string): string {
  return body.split('\n').slice(1).map((l) => l.trim()).filter(Boolean).join(' ') || '추가 텍스트 없음';
}
