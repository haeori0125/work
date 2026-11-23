'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClockIcon, HomeIcon, NoteIcon, ShieldIcon } from '@/app/_ui/icons';

/** 다이어리 인덱스처럼 페이지 옆에 튀어나온 탭 (폰에서는 위쪽) */
export function IndexTabs({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const tabs = [
    { href: '/', label: '홈', Icon: HomeIcon },
    { href: '/attendance', label: '내 기록', Icon: ClockIcon },
    { href: '/memo', label: '개인 메모', Icon: NoteIcon },
    ...(isAdmin ? [{ href: '/admin/tasks', label: '관리', Icon: ShieldIcon }] : []),
  ];
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href.split('/').slice(0, 2).join('/')));
  return (
    <nav className="index-tabs" aria-label="메뉴">
      {tabs.map(({ href, label, Icon }, i) => (
        <Link key={href} href={href} className={`itab itab-${i}`} aria-current={active(href) ? 'page' : undefined}
          aria-label={label} title={label}>
          <Icon />
          <span className="itab-label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
