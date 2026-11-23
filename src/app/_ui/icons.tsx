// 글자(+, ✓) 대신 쓰는 작은 아이콘. 글꼴과 상관없이 정확히 가운데에 놓인다.
type P = { size?: number };

export function PlusIcon({ size = 12 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ size = 12 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.2 6.3 4.8 8.8 9.8 3.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
