'use client';

import { useActionState } from 'react';
import { savePersonalMemoAction } from '@/app/actions/personal';

export function MemoForm({ body, lastSaved }: { body: string; lastSaved: string | null }) {
  const [state, action, pending] = useActionState(savePersonalMemoAction, null);
  return (
    <form action={action} className="stack">
      <textarea name="body" defaultValue={body} rows={14} maxLength={20000} aria-label="개인 메모" placeholder="나만 보는 메모입니다" />
      <div className="row">
        <span className="muted">{state?.ok ?? (lastSaved ? `마지막 저장 ${lastSaved}` : '아직 저장하지 않았습니다')}</span>
        <span className="spacer" />
        <button className="btn primary" disabled={pending}>{pending ? '저장 중…' : '저장'}</button>
      </div>
      {state?.error && <p className="msg error">{state.error}</p>}
    </form>
  );
}
