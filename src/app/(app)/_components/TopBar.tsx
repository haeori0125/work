'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';

export function TopBar({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const path = usePathname();
  const links = [
    { href: '/', label: '홈' },
    { href: '/attendance', label: '내 기록' },
    { href: '/memo', label: '개인 메모' },
    { href: '/settings', label: '설정' },
    ...(isAdmin ? [{ href: '/admin/tasks', label: '관리' }] : []),
  ];
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href.split('/').slice(0, 2).join('/')));
  return (
    <header className="topbar">
      <Link href="/" className="brand"><b aria-hidden>✓</b>팀 투두</Link>
      <nav className="nav" aria-label="메뉴">
        {links.map((l) => (
          <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined}>{l.label}</Link>
        ))}
      </nav>
      <div className="top-right">
        <form action={logoutAction} className="nav"><button>로그아웃</button></form>
        <span className="avatar" title={name}>{name.slice(-2)}</span>
      </div>
    </header>
  );
}
