import type { Metadata, Viewport } from 'next';
import { getDb } from '@/db';
import { themeVars } from '@/lib/color';
import { DEFAULT_PREFS, getPrefs } from '@/lib/prefs';
import { getCurrentUser } from '@/server/session';
import './globals.css';

export const metadata: Metadata = { title: '팀 투두', description: '함께 쓰는 업무 체크리스트' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const prefs = user ? await getPrefs(await getDb(), user.id) : DEFAULT_PREFS;
  return (
    <html lang="ko" style={themeVars(prefs) as React.CSSProperties}>
      <head>
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendardvariable-dynamic-subset.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
