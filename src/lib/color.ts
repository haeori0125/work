import type { Prefs } from './prefs';

/** "#a3b1f0" → "A3B1F0", 형식이 틀리면 null */
export function parseHex(input: string): string | null {
  const x = input.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(x) ? x.toUpperCase() : null;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const n = parseInt(hex, 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h: Math.round(h) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sf = s / 100, lf = l / 100;
  const k = (n: number) => (n + h / 30) % 12, a = sf * Math.min(lf, 1 - lf);
  const f = (n: number) => Math.round(255 * (lf - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))
    .toString(16).padStart(2, '0');
  return (f(0) + f(8) + f(4)).toUpperCase();
}

/** 이 색 위에 올릴 글자색: 밝으면 진한 글자, 어두우면 흰 글자 */
export function inkOn(h: number, l: number): string {
  return l >= 60 ? `hsl(${h} 30% 14%)` : '#ffffff';
}

/** 사용자 설정 → <html>에 넣을 CSS 변수 */
export function themeVars(p: Prefs): Record<string, string> {
  const v: Record<string, string> = {
    '--h': String(p.themeH), '--s': String(p.themeS), '--l': String(p.themeL),
    '--on-accent': inkOn(p.themeH, p.themeL),
    '--on-done': inkOn(p.themeH, p.themeL),
  };
  if (p.doingHex) {
    const c = hexToHsl(p.doingHex);
    Object.assign(v, { '--dh': String(c.h), '--ds': String(c.s), '--dl': String(c.l) });
  }
  if (p.doneHex) {
    const c = hexToHsl(p.doneHex);
    Object.assign(v, { '--oh': String(c.h), '--os': String(c.s), '--ol': String(c.l), '--on-done': inkOn(c.h, c.l) });
  }
  return v;
}
