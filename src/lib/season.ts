/** 크리스마스 시즌(11월 20일 ~ 12월 26일, 한국 날짜)에만 장식을 켠다. 매년 자동으로 켜지고 꺼진다. */
export function isXmasSeason(kstDateStr: string): boolean {
  const md = kstDateStr.slice(5); // MM-DD
  return (md >= '11-20' && md <= '12-26');
}
