'use client';

import Link from 'next/link';
import { useState } from 'react';
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
        <RefreshButton />
        <form action={logoutAction} className="nav"><button>로그아웃</button></form>
        <span className="avatar" title={name}>{name.slice(-2)}</span>
      </div>
    </header>
  );
}

/** 페이지 전체를 다시 불러온다(새 배포 화면 + 다른 사람이 바꾼 내용) */
function RefreshButton() {
  const [spinning, setSpinning] = useState(false);
  return (
    <button
      type="button" className="icon-btn" aria-label="새로고침" title="새로고침"
      onClick={() => { setSpinning(true); window.location.reload(); }}
    >
      <svg className={spinning ? 'spin' : undefined} width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 11a8 8 0 1 0-2.34 5.66" />
        <path d="M20 4v7h-7" />
      </svg>
    </button>
  );
}
