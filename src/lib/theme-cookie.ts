// 기기에 마지막으로 쓴 테마 색을 쿠키로 기억해 로그인 화면에서도 그 색을 보여 준다.
// 형식: "색상.채도.밝기.진행중색.완료색" (색이 없으면 '-')
import { DEFAULT_PREFS, type Prefs } from './prefs-shared';

export const THEME_COOKIE = 'tt_theme';

export function encodeThemeCookie(p: Prefs): string {
  return [p.themeH, p.themeS, p.themeL, p.doingHex ?? '-', p.doneHex ?? '-'].join('.');
}

const RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,2})\.([0-9A-F]{6}|-)\.([0-9A-F]{6}|-)$/;

export function decodeThemeCookie(raw: string | undefined): Prefs | null {
  const m = raw ? RE.exec(raw) : null;
  if (!m) return null;
  const [h, s, l] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (h > 359 || s > 100 || l < 25 || l > 90) return null;
  return { ...DEFAULT_PREFS, themeH: h, themeS: s, themeL: l, doingHex: m[4] === '-' ? null : m[4], doneHex: m[5] === '-' ? null : m[5] };
}
