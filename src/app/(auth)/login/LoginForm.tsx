'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { loginAction } from '@/app/actions/auth';
import { useToast } from '@/app/_ui/Toast';

type Props = { notice: string | null; stamp: { date: string; day: string } };

export function LoginForm({ notice, stamp }: Props) {
  const [mode, setMode] = useState<'member' | 'admin'>('member');
  const [state, action, pending] = useActionState(loginAction, null);
  const toast = useToast();
  // 퇴근 안내는 잠깐 떴다 사라지게. 새로고침해도 다시 안 뜨게 주소의 ?out=1 도 지운다
  useEffect(() => {
    if (!notice) return;
    toast(notice);
    const url = new URL(window.location.href);
    url.searchParams.delete('out');
    window.history.replaceState(null, '', url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="auth-card">
      <h1 className="auth-title">Team Task</h1>
      <p className="auth-date">{stamp.date} {stamp.day}</p>
      <div className="tabs" role="tablist" aria-label="로그인 종류">
        <button type="button" role="tab" aria-selected={mode === 'member'} className={`tab${mode === 'member' ? ' active' : ''}`} onClick={() => setMode('member')}>멤버</button>
        <button type="button" role="tab" aria-selected={mode === 'admin'} className={`tab${mode === 'admin' ? ' active' : ''}`} onClick={() => setMode('admin')}>관리자</button>
      </div>
      <form action={action} className="stack">
        <input type="hidden" name="mode" value={mode} />
        <label className="field">이름<input name="name" required autoComplete="username" /></label>
        <label className="field">비밀번호<input name="password" type="password" required autoComplete="current-password" /></label>
        {state?.error && <p className="msg error" role="alert">{state.error}</p>}
        <button className="btn primary" disabled={pending}>{pending ? '로그인 중…' : mode === 'admin' ? '관리자 로그인' : '로그인'}</button>
      </form>
      <p className="muted center">처음이신가요? <Link href="/signup">가입 신청</Link></p>
    </div>
  );
}
