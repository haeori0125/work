'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { loginAction } from '@/app/actions/auth';

type Props = { notice: string | null; stamp: { date: string; day: string }; xmas?: boolean };

export function LoginForm({ notice, stamp, xmas = false }: Props) {
  const [mode, setMode] = useState<'member' | 'admin'>('member');
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <div className="auth-card">
      <h1 className="auth-title">Team Task</h1>
      <p className="auth-date">{stamp.date} {stamp.day}{xmas && <span className="xmas-note"> · Merry Christmas</span>}</p>
      {notice && <p className="msg ok" role="status">{notice}</p>}
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
