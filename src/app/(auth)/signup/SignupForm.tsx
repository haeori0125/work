'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signupAction } from '@/app/actions/auth';

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, null);
  if (state?.ok) {
    return (
      <div className="auth-card">
        <h1 className="auth-title">가입 신청</h1>
        <p className="msg ok" role="status">{state.ok}</p>
        <Link className="btn primary" href="/login">로그인 화면으로</Link>
      </div>
    );
  }
  return (
    <div className="auth-card">
      <h1 className="auth-title">가입 신청</h1>
      <form action={action} className="stack">
        <label className="field">이름<input name="name" required maxLength={30} autoComplete="username" /></label>
        <label className="field">비밀번호 (4자 이상)<input name="password" type="password" required minLength={4} autoComplete="new-password" /></label>
        <label className="field">비밀번호 확인<input name="password2" type="password" required minLength={4} autoComplete="new-password" /></label>
        {state?.error && <p className="msg error" role="alert">{state.error}</p>}
        <button className="btn primary" disabled={pending}>{pending ? '신청 중…' : '가입 신청'}</button>
      </form>
      <p className="muted center"><Link href="/login">로그인으로 돌아가기</Link></p>
    </div>
  );
}
