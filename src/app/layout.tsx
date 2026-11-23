import type { Metadata, Viewport } from 'next';
import { getDb } from '@/db';
import { themeVars } from '@/lib/color';
import { DEFAULT_PREFS, getPrefs } from '@/lib/prefs';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/server/session';
import { decodeThemeCookie, THEME_COOKIE } from '@/lib/theme-cookie';
import { kstDate } from '@/lib/time';
import { isXmasSeason } from '@/lib/season';
import { Snow } from './_ui/Snow';
import './globals.css';

export const metadata: Metadata = { title: 'Team Task', description: '함께 쓰는 업무 체크리스트' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // 로그인 전이면 이 기기에서 마지막으로 쓴 테마 색(쿠키), 없으면 기본 색
  const prefs = user ? await getPrefs(await getDb(), user.id)
    : decodeThemeCookie((await cookies()).get(THEME_COOKIE)?.value) ?? DEFAULT_PREFS;
  const xmas = isXmasSeason(kstDate(new Date()));
  return (
    <html lang="ko" data-season={xmas ? 'xmas' : undefined} style={themeVars(prefs) as React.CSSProperties}>
      <head>
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendardvariable-dynamic-subset.css" />
      </head>
      <body>{xmas && <Snow />}{children}</body>
    </html>
  );
}
