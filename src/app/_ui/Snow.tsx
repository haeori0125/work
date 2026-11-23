// 시즌 장식: 화면 뒤로 눈이 천천히 내린다(카드 뒤, 클릭 막지 않음). 움직임 줄이기 설정이면 숨김.
const FLAKES = Array.from({ length: 26 }, (_, i) => {
  // 정수 해시라 서버·브라우저에서 같은 값(하이드레이션 일치), 줄지어 보이지 않게 고르게 흩어진다
  const r = (n: number) => {
    let x = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(n + 7, 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d); x ^= x >>> 13;
    return Math.round(((x >>> 0) % 10000) / 10) / 1000;
  };
  return { left: r(1) * 100, size: 4 + r(2) * 6, dur: 12 + r(3) * 14, delay: -r(4) * 26, drift: (r(5) - 0.5) * 60 };
});

export function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {FLAKES.map((f, i) => (
        <i key={i} style={{ left: `${f.left}%`, width: f.size, height: f.size, animationDuration: `${f.dur}s`,
          animationDelay: `${f.delay}s`, ['--drift' as string]: `${f.drift}px` }} />
      ))}
    </div>
  );
}
