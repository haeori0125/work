// 로그인 화면 맨 아래를 가로로 가득 채우는 눈 덮인 숲.
// 나무가 커서 밑동은 화면 밖으로 잘리고 잎 부분부터 보인다. 뒷줄은 연하고 높게, 앞줄은 진하고 낮게.
type Tone = [string, string, string];
const ROWS: { tone: Tone; step: number; s: [number, number]; top: [number, number] }[] = [
  { tone: ['#9cc5b0', '#a8cdb9', '#b4d6c4'], step: 64, s: [1.5, 1.9], top: [18, 46] },
  { tone: ['#6ca387', '#79ad92', '#86b89e'], step: 82, s: [1.9, 2.3], top: [58, 82] },
  { tone: ['#4a8468', '#559276', '#61a083'], step: 104, s: [2.4, 2.9], top: [100, 124] },
];
const W = 3200; // 어떤 화면보다 넓게: 높이에 맞춰 그리고 양옆은 잘라 낸다

// 정수 해시: 서버·브라우저 같은 값, 고르게 흩어짐
function rand(i: number, n: number) {
  let x = Math.imul(i + 11, 0x9e3779b1) ^ Math.imul(n + 3, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d); x ^= x >>> 13;
  return ((x >>> 0) % 1000) / 1000;
}
const lerp = ([a, b]: [number, number], t: number) => Math.round((a + (b - a) * t) * 100) / 100;

const TREES = ROWS.flatMap((row, r) => {
  const out = [];
  for (let k = 0, x = -row.step + (r * 29) % row.step; x < W + row.step * 1.5; k++, x += row.step) {
    const id = r * 100 + k;
    out.push({ id, row: r, x: Math.round(x + (rand(id, 1) - 0.5) * row.step * 0.4), s: lerp(row.s, rand(id, 2)), top: lerp(row.top, rand(id, 3)) });
  }
  return out;
});

// 나무 모양 하나를 줄마다 색만 바꿔 정의해 두고 <use>로 여러 번 쓴다
function TreeSymbol({ id, tone }: { id: string; tone: Tone }) {
  return (
    <symbol id={id} overflow="visible">
      <path d="M0 30 L32 76 Q0 82 -32 76 Z" fill={tone[0]} />
      <path d="M0 14 L24 52 Q0 57 -24 52 Z" fill={tone[1]} />
      <path d="M0 0 L16 30 Q0 34 -16 30 Z" fill={tone[2]} />
      <path d="M-15.2 38 L-10.3 30.5 L10.3 30.5 L15.2 38 Q12 36 9 39 Q6 36 3 39 Q0 36 -3 39 Q-6 36 -9 39 Q-12 36 -15.2 38 Z" fill="#fff" />
      <path d="M-22.5 60 L-16 52.6 L16 52.6 L22.5 60 Q18.5 57.5 15 61 Q11 58 7.5 61 Q4 58 0 61 Q-4 58 -7.5 61 Q-11 58 -15 61 Q-18.5 57.5 -22.5 60 Z" fill="#fff" />
      <path d="M0 0 L8.5 16 Q6 14 4 16.8 Q2 14.5 0 17 Q-2 14.5 -4 16.8 Q-6 14 -8.5 16 Z" fill="#fff" />
    </symbol>
  );
}

export function XmasTrees() {
  return (
    <svg className="xmas-forest" viewBox={`0 0 ${W} 220`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>{ROWS.map((row, r) => <TreeSymbol key={r} id={`xt${r}`} tone={row.tone} />)}</defs>
      {TREES.map((t) => <use key={t.id} href={`#xt${t.row}`} transform={`translate(${t.x} ${t.top}) scale(${t.s})`} />)}
    </svg>
  );
}
