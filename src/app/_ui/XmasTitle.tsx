// 시즌 장식: 맨 위 가운데 필기체 "Merry Christmas" + 반짝임
const SPARKS = [
  { left: '4%', top: '18%', size: 14, delay: '0s' },
  { left: '22%', top: '-6%', size: 9, delay: '1.1s' },
  { left: '58%', top: '-10%', size: 12, delay: '2.2s' },
  { left: '93%', top: '10%', size: 15, delay: '0.6s' },
  { left: '80%', top: '78%', size: 9, delay: '1.7s' },
  { left: '12%', top: '82%', size: 8, delay: '2.8s' },
];

export function XmasTitle() {
  return (
    <div className="xmas-title">
      <span className="xmas-text">Merry Christmas</span>
      {SPARKS.map((s, i) => (
        <svg key={i} className="spark" viewBox="0 0 20 20" aria-hidden="true"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }}>
          <path d="M10 0 C10.8 6.5 13.5 9.2 20 10 C13.5 10.8 10.8 13.5 10 20 C9.2 13.5 6.5 10.8 0 10 C6.5 9.2 9.2 6.5 10 0 Z" fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}
