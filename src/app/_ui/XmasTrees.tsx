// 로그인 화면 아래 시즌 장식: 눈 덮인 트리 세 그루
function Tree({ x, s, star = false }: { x: number; s: number; star?: boolean }) {
  return (
    <g transform={`translate(${x} ${92 - 84 * s}) scale(${s})`}>
      <rect x="-4" y="74" width="8" height="10" rx="1.5" fill="#8b6b57" />
      <path d="M0 30 L32 76 Q0 82 -32 76 Z" fill="#4f8a6e" />
      <path d="M0 14 L24 52 Q0 57 -24 52 Z" fill="#5c9a7c" />
      <path d="M0 0 L16 30 Q0 34 -16 30 Z" fill="#69a889" />
      {/* 가지 위에 쌓인 눈 */}
      <path d="M-15.2 38 L-10.3 30.5 L10.3 30.5 L15.2 38 Q12 36 9 39 Q6 36 3 39 Q0 36 -3 39 Q-6 36 -9 39 Q-12 36 -15.2 38 Z" fill="#fff" />
      <path d="M-22.5 60 L-16 52.6 L16 52.6 L22.5 60 Q18.5 57.5 15 61 Q11 58 7.5 61 Q4 58 0 61 Q-4 58 -7.5 61 Q-11 58 -15 61 Q-18.5 57.5 -22.5 60 Z" fill="#fff" />
      <path d="M0 0 L8.5 16 Q6 14 4 16.8 Q2 14.5 0 17 Q-2 14.5 -4 16.8 Q-6 14 -8.5 16 Z" fill="#fff" />
      {star && <path d="M0 -9 L2.4 -3.6 L8 -3.3 L3.7 0.3 L5.1 5.8 L0 2.8 L-5.1 5.8 L-3.7 0.3 L-8 -3.3 L-2.4 -3.6 Z" fill="#e9b949" />}
    </g>
  );
}

export function XmasTrees() {
  return (
    <svg className="xmas-trees" viewBox="-130 -6 260 112" role="img" aria-label="눈 덮인 크리스마스 트리">
      <path d="M-118 100 Q-70 84 0 90 Q70 84 118 100 Q60 106 0 105 Q-60 106 -118 100 Z" fill="#fff" />
      <Tree x={-62} s={0.62} />
      <Tree x={0} s={1} star />
      <Tree x={56} s={0.72} />
      <path d="M-96 100 Q-50 92 0 96 Q50 92 96 100 Q50 104 0 103.5 Q-50 104 -96 100 Z" fill="#fff" />
    </svg>
  );
}
