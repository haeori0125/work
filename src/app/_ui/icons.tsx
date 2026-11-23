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

export function GearIcon({ size = 18 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

export function RefreshIcon({ size = 18, spinning = false }: P & { spinning?: boolean }) {
  return (
    <svg className={spinning ? 'spin' : undefined} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0-2.34 5.66" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

/** 상태 태그 앞 아이콘: 완료 ✓, 진행 중 반쪽 원 */
export function StatusMark({ status }: { status: 'todo' | 'doing' | 'done' }) {
  if (status === 'done') return <CheckIcon size={10} />;
  if (status === 'doing') {
    return (
      <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true">
        <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 1a4 4 0 0 1 0 8Z" fill="currentColor" />
      </svg>
    );
  }
  return null;
}

/** 위클리 담당 표시용 작은 ▶ */
export function ArrowIcon({ size = 8 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" aria-hidden="true">
      <path d="M1.5 0.8 7 4 1.5 7.2Z" fill="currentColor" />
    </svg>
  );
}

export function FilterIcon({ size = 16 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h18l-7 8.5V19l-4 2v-7.5Z" />
    </svg>
  );
}

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function HomeIcon({ size = 20 }: P) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...line}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></svg>;
}
export function ClockIcon({ size = 20 }: P) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...line}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}
export function NoteIcon({ size = 20 }: P) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...line}><path d="M6 3h9l4 4v14H6Z" /><path d="M14 3v5h5" /><path d="M9 13h7M9 17h5" /></svg>;
}
export function ShieldIcon({ size = 20 }: P) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...line}><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z" /><path d="m9 12 2 2 4-4" /></svg>;
}

/** 시즌 장식용 작은 트리 */
export function TreeIcon({ size = 14 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 1.2 10 5.4H8.6L11.2 9H8V12H6V9H2.8L5.4 5.4H4Z" fill="currentColor" />
    </svg>
  );
}
