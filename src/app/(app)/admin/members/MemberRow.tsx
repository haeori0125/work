'use client';

import { useState, useTransition } from 'react';
import {
  approveAction, rejectAction, resetPasswordAction, setDisabledAction, setRoleAction,
} from '@/app/actions/admin';
import type { ActionResult } from '@/app/actions/result';
import type { Member } from '@/lib/members';
import { Person } from '@/app/_ui/AvatarContext';
import { useToast } from '@/app/_ui/Toast';

export function MemberRow({ m, isMe }: { m: Member; isMe: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult>(null);
  const [pw, setPw] = useState('');
  const [pwOpen, setPwOpen] = useState(false);
  const toast = useToast();
  const run = (fn: () => Promise<ActionResult>, okText = '저장되었습니다') => start(async () => {
    const res = await fn();
    setMsg(res?.error ? res : null);
    if (!res?.error) toast(okText);
  });

  return (
    <li className="task">
      <div className="task-top">
        <span className="task-title who-line"><Person name={m.name} size={24} />{isMe && <span className="muted">(나)</span>}</span>
        {m.role === 'admin' && <span className="badge doing">관리자</span>}
        {m.status === 'pending' && <span className="badge todo">승인 대기</span>}
        {m.status === 'disabled' && <span className="badge warn">사용 중지</span>}
      </div>
      <div className="row">
        {m.status === 'pending' ? (
          <>
            <button className="btn small primary" disabled={pending} onClick={() => run(() => approveAction(m.id), '승인되었습니다')}>승인</button>
            <button className="btn small danger" disabled={pending}
              onClick={() => { if (confirm(`${m.name}님의 가입 신청을 거절할까요?`)) run(() => rejectAction(m.id), '거절했습니다'); }}>거절</button>
          </>
        ) : (
          <>
            <button className="btn small" disabled={pending}
              onClick={() => run(() => setRoleAction(m.id, m.role === 'admin' ? 'member' : 'admin'))}>
              {m.role === 'admin' ? '관리자 해제' : '관리자 지정'}
            </button>
            {!isMe && (
              <button className="btn small" disabled={pending}
                onClick={() => run(() => setDisabledAction(m.id, m.status !== 'disabled'))}>
                {m.status === 'disabled' ? '사용 재개' : '사용 중지'}
              </button>
            )}
            {pwOpen ? (
              <form className="row" onSubmit={(e) => { e.preventDefault(); run(() => resetPasswordAction(m.id, pw), '비밀번호를 바꿨습니다'); setPw(''); setPwOpen(false); }}>
                <input className="input-small" type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="새 비밀번호 (4자 이상)"
                  aria-label={`${m.name} 새 비밀번호`} minLength={4} required autoFocus />
                <button className="btn small primary" disabled={pending}>바꾸기</button>
                <button type="button" className="btn small" onClick={() => { setPw(''); setPwOpen(false); }}>취소</button>
              </form>
            ) : (
              <button type="button" className="btn small" onClick={() => setPwOpen(true)}>비밀번호 재설정</button>
            )}
          </>
        )}
      </div>
      {msg?.error && <p className="msg error">{msg.error}</p>}
    </li>
  );
}
