'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { logoutAction } from '@/app/actions/auth';
import { Avatar } from '@/app/_ui/Avatar';
import { CheckIcon, GearIcon, RefreshIcon } from '@/app/_ui/icons';

export function TopBar({ name, avatar, tabs }: { name: string; isAdmin: boolean; avatar: string | null; tabs: React.ReactNode }) {
  const path = usePathname();
  const [spinning, setSpinning] = useState(false);
  return (
    <header className="topbar">
      <Link href="/" className="brand"><b aria-hidden><CheckIcon size={12} /></b>Team Board</Link>
      {tabs}
      {/* 자주 쓰는 순서: 새로고침 · 설정 · 내 프로필, 실수로 누르기 쉬운 로그아웃은 맨 끝 */}
      <div className="top-right">
        <button type="button" className="icon-btn" aria-label="새로고침" title="새로고침"
          onClick={() => { setSpinning(true); window.location.reload(); }}>
          <RefreshIcon spinning={spinning} />
        </button>
        <Link href="/settings" className="icon-btn" aria-label="설정" title="설정"
          aria-current={path.startsWith('/settings') ? 'page' : undefined}>
          <GearIcon />
        </Link>
        <Link href="/settings#profile" className="avatar-link" aria-label={`${name} 프로필`} title={`${name} · 프로필 사진 바꾸기`}>
          <Avatar name={name} src={avatar} size={30} />
        </Link>
        <form action={logoutAction} className="nav logout"><button>로그아웃</button></form>
      </div>
    </header>
  );
}
