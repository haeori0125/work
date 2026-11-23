'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const links = [
    { href: '/', label: '홈' },
    { href: '/attendance', label: '내 기록' },
    { href: '/memo', label: '개인 메모' },
    ...(isAdmin ? [{ href: '/admin/tasks', label: '관리' }] : []),
  ];
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href.split('/').slice(0, 2).join('/')));
  return (
    <nav className="nav">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={isActive(l.href) ? 'active' : undefined}>{l.label}</Link>
      ))}
      <span className="spacer" />
      <form action={logoutAction}><button>로그아웃</button></form>
    </nav>
  );
}
