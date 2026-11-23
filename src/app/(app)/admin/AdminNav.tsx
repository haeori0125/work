'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin/tasks', label: '업무 관리' },
  { href: '/admin/members', label: '멤버 관리' },
  { href: '/admin/attendance', label: '출퇴근 기록' },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="subnav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? 'btn small primary' : 'btn small'}>{l.label}</Link>
      ))}
    </nav>
  );
}
