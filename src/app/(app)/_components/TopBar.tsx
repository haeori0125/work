'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { endShiftAction } from '@/app/actions/attendance';
import { logoutAction } from '@/app/actions/auth';
import { Avatar } from '@/app/_ui/Avatar';
import { CheckIcon, GearIcon, RefreshIcon } from '@/app/_ui/icons';

export function TopBar({ name, avatar, tabs, working }: { name: string; isAdmin: boolean; avatar: string | null; tabs: React.ReactNode; working: boolean }) {
  const path = usePathname();
  const [spinning, setSpinning] = useState(false);
  // 근무 중에 로그아웃을 누르면 퇴근도 할지 물어본다(퇴근 미기록이 남지 않게)
  const ask = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const outAndLogout = () => start(async () => {
    const res = await endShiftAction();
    if (res?.error) setError(res.error);
  });
  return (
    <header className="topbar">
      <Link href="/" className="brand"><b aria-hidden><CheckIcon size={12} /></b>Team Task</Link>
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
        <form action={logoutAction} className="nav logout"
          onSubmit={(e) => { if (working) { e.preventDefault(); setError(null); ask.current?.showModal(); } }}>
          <button>로그아웃</button>
        </form>
        <dialog ref={ask} className="task-dialog logout-ask" aria-labelledby="logout-ask-t"
          onClick={(e) => { if (e.target === e.currentTarget) ask.current?.close(); }}>
          <div className="dlg-body">
            <h2 id="logout-ask-t">퇴근도 할까요?</h2>
            <p className="muted" style={{ margin: 0 }}>지금 근무 중이에요. 로그아웃만 하면 출퇴근 기록은 근무 중으로 남아요.</p>
            {error && <p className="msg error">{error}</p>}
            <div className="logout-btns">
              <button type="button" className="btn primary" onClick={outAndLogout} disabled={pending}>{pending ? '퇴근 중…' : '퇴근하고 로그아웃'}</button>
              <form action={logoutAction}><button className="btn" disabled={pending}>로그아웃만</button></form>
              <button type="button" className="btn ghost-btn" onClick={() => ask.current?.close()} disabled={pending}>취소</button>
            </div>
          </div>
        </dialog>
      </div>
    </header>
  );
}
