'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { loginAction } from '@/app/actions/auth';

type Props = { notice: string | null; stamp: { date: string; day: string } };

/** 다이어리 표지 모양 로그인: 오른쪽 인덱스 탭으로 멤버/관리자를 고른다 */
export function LoginForm({ notice, stamp }: Props) {
  const [mode, setMode] = useState<'member' | 'admin'>('member');
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <div className="diary">
      <div className="cover">
        <span className="spine" aria-hidden />
        <div className="cover-top">
          <div className="label">
            <h1 className="auth-title">Team Task</h1>
            <p>함께 쓰는 업무 다이어리</p>
          </div>
          <div className="stamp" aria-label={`오늘 ${stamp.date} ${stamp.day}`}>
            <b>{stamp.date}</b><span>{stamp.day}</span>
          </div>
        </div>

        <div className="paper">
          {notice && <p className="msg ok" role="status">{notice}</p>}
          <form action={action} className="stack">
            <input type="hidden" name="mode" value={mode} />
            <label className="field">이름<input name="name" required autoComplete="username" /></label>
            <label className="field">비밀번호<input name="password" type="password" required autoComplete="current-password" /></label>
            {state?.error && <p className="msg error" role="alert">{state.error}</p>}
            <button className="btn primary" disabled={pending}>
              {pending ? '로그인 중…' : mode === 'admin' ? '관리자로 열기' : '다이어리 열기'}
            </button>
          </form>
          <p className="muted center">처음이신가요? <Link href="/signup">가입 신청</Link></p>
        </div>
      </div>

      <div className="cover-tabs" role="tablist" aria-label="로그인 종류">
        <button type="button" role="tab" aria-selected={mode === 'member'} className="ctab" onClick={() => setMode('member')}>멤버</button>
        <button type="button" role="tab" aria-selected={mode === 'admin'} className="ctab" onClick={() => setMode('admin')}>관리자</button>
      </div>
    </div>
  );
}
