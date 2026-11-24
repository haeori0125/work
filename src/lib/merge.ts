// 여러 사람이 같은 메모를 동시에 고칠 때, 줄 단위로 합친다(3-way merge).
// base: 둘이 마지막으로 같이 본 글, mine: 지금 저장하려는 글, theirs: 그사이 저장된 글.

function lcsMap(a: string[], b: string[]): number[] {
  // a[i]가 b의 몇 번째 줄과 짝인지(-1은 짝 없음). 가장 긴 공통 부분 수열 기준
  const n = a.length, m = b.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const map = new Array<number>(n).fill(-1);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { map[i] = j; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return map;
}

/** 한 줄을 둘 다 고쳤을 때: 고친 자리가 겹치지 않으면 글자 단위로 둘 다 살린다 */
export function mergeLine(b: string, m: string, t: string): string {
  if (m === b || m === t) return t === b ? m : t;
  if (t === b) return m;
  const edit = (x: string) => {
    let p = 0;
    while (p < b.length && p < x.length && b[p] === x[p]) p++;
    let q = 0;
    while (q < b.length - p && q < x.length - p && b[b.length - 1 - q] === x[x.length - 1 - q]) q++;
    return { from: p, to: b.length - q, text: x.slice(p, x.length - q) };
  };
  const em = edit(m), et = edit(t);
  if (em.to <= et.from) return b.slice(0, em.from) + em.text + b.slice(em.to, et.from) + et.text + b.slice(et.to);
  if (et.to <= em.from) return b.slice(0, et.from) + et.text + b.slice(et.to, em.from) + em.text + b.slice(em.to);
  return m; // 같은 글자를 둘 다 고쳤으면 지금 저장하는 쪽
}

const same = (x: string[], y: string[]) => x.length === y.length && x.every((v, k) => v === y[k]);

export function merge3(base: string, mine: string, theirs: string): string {
  if (mine === theirs || theirs === base) return mine;
  if (mine === base) return theirs;
  const B = base.split('\n'), M = mine.split('\n'), T = theirs.split('\n');
  const toM = lcsMap(B, M), toT = lcsMap(B, T);
  const out: string[] = [];
  let i = 0, a = 0, b = 0;
  const chunk = (i0: number, a0: number, b0: number) => {
    const bc = B.slice(i, i0), mc = M.slice(a, a0), tc = T.slice(b, b0);
    if (same(mc, bc)) out.push(...tc);
    else if (same(tc, bc) || same(mc, tc)) out.push(...mc);
    else if (bc.length === 0) out.push(...tc, ...mc); // 둘 다 같은 자리에 새 줄을 넣었으면 둘 다 남긴다
    else if (mc.length === bc.length && tc.length === bc.length) out.push(...bc.map((x, k) => mergeLine(x, mc[k], tc[k]))); // 줄마다
    else out.push(...mc); // 줄 수까지 서로 다르게 바꿨으면 지금 저장하는 쪽
  };
  for (let k = 0; k < B.length; k++) {
    if (k < i || toM[k] < a || toT[k] < b || toM[k] === -1 || toT[k] === -1) continue;
    chunk(k, toM[k], toT[k]);
    out.push(B[k]);
    i = k + 1; a = toM[k] + 1; b = toT[k] + 1;
  }
  chunk(B.length, M.length, T.length);
  return out.join('\n');
}
