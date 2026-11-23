import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: '팀 투두', description: '함께 쓰는 업무 체크리스트' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
