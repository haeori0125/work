// 로그인 화면 아래 시즌 장식: 눈 덮인 작은 숲(뒷줄은 연하게, 앞줄은 진하게)
type Tone = { trunk: string; tiers: [string, string, string] };
const FRONT: Tone = { trunk: '#8b6b57', tiers: ['#4f8a6e', '#5c9a7c', '#69a889'] };
const BACK: Tone = { trunk: '#b39a8a', tiers: ['#94bfa9', '#a1c9b4', '#aed2bf'] };

function Tree({ x, base, s, tone, star = false }: { x: number; base: number; s: number; tone: Tone; star?: boolean }) {
  return (
    <g transform={`translate(${x} ${base - 84 * s}) scale(${s})`}>
      <rect x="-4" y="74" width="8" height="10" rx="1.5" fill={tone.trunk} />
      <path d="M0 30 L32 76 Q0 82 -32 76 Z" fill={tone.tiers[0]} />
      <path d="M0 14 L24 52 Q0 57 -24 52 Z" fill={tone.tiers[1]} />
      <path d="M0 0 L16 30 Q0 34 -16 30 Z" fill={tone.tiers[2]} />
      {/* 가지 위에 쌓인 눈 */}
      <path d="M-15.2 38 L-10.3 30.5 L10.3 30.5 L15.2 38 Q12 36 9 39 Q6 36 3 39 Q0 36 -3 39 Q-6 36 -9 39 Q-12 36 -15.2 38 Z" fill="#fff" />
      <path d="M-22.5 60 L-16 52.6 L16 52.6 L22.5 60 Q18.5 57.5 15 61 Q11 58 7.5 61 Q4 58 0 61 Q-4 58 -7.5 61 Q-11 58 -15 61 Q-18.5 57.5 -22.5 60 Z" fill="#fff" />
      <path d="M0 0 L8.5 16 Q6 14 4 16.8 Q2 14.5 0 17 Q-2 14.5 -4 16.8 Q-6 14 -8.5 16 Z" fill="#fff" />
      {star && <path d="M0 -9 L2.4 -3.6 L8 -3.3 L3.7 0.3 L5.1 5.8 L0 2.8 L-5.1 5.8 L-3.7 0.3 L-8 -3.3 L-2.4 -3.6 Z" fill="#e9b949" />}
    </g>
  );
}

const BACK_ROW = [[-178, 0.42], [-134, 0.52], [-88, 0.46], [-40, 0.56], [38, 0.54], [84, 0.47], [130, 0.55], [176, 0.43]] as const;
const FRONT_ROW = [[-152, 0.5], [-108, 0.7], [-60, 0.58], [52, 0.66], [102, 0.78], [150, 0.54]] as const;

export function XmasTrees() {
  return (
    <svg className="xmas-trees" viewBox="-200 -6 400 112" role="img" aria-label="눈 덮인 크리스마스 트리 숲">
      <path d="M-196 96 Q-100 80 0 86 Q100 80 196 96 Q100 101 0 100 Q-100 101 -196 96 Z" fill="#fff" opacity=".7" />
      {BACK_ROW.map(([x, s]) => <Tree key={x} x={x} base={88} s={s} tone={BACK} />)}
      <path d="M-192 101 Q-100 87 0 92 Q100 87 192 101 Q100 106 0 105 Q-100 106 -192 101 Z" fill="#fff" />
      {FRONT_ROW.map(([x, s]) => <Tree key={x} x={x} base={96} s={s} tone={FRONT} />)}
      <Tree x={0} base={97} s={1} tone={FRONT} star />
      <path d="M-150 103 Q-80 96 0 99 Q80 96 150 103 Q80 106 0 105.5 Q-80 106 -150 103 Z" fill="#fff" />
    </svg>
  );
}
