'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { rejectRequestAction } from '@/app/actions/requests';
import { Person } from '@/app/_ui/AvatarContext';

type Props = { id: number; title: string; description: string | null; requester: string; wantedLabel: string | null; createdLabel: string; selected: boolean };

/** 관리자용 요청 한 줄: 승인(업무 추가 폼에 채워 넣기) · 거절 */
export function RequestRow({ id, title, description, requester, wantedLabel, createdLabel, selected }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className={`task${selected ? ' selected' : ''}`}>
      <div className="task-top">
        <span className="task-title">{title}</span>
        <Link className="btn small primary" href={`/admin/tasks?from=${id}`} scroll>{selected ? '작성 중' : '승인'}</Link>
        <button type="button" className="btn small danger" disabled={pending}
          onClick={() => { if (confirm(`'${title}' 요청을 거절할까요?`)) start(async () => setError((await rejectRequestAction(id))?.error ?? null)); }}>
          거절
        </button>
      </div>
      {description && <p className="req-desc">{description}</p>}
      <div className="tags">
        <span className="tag line"><Person name={requester} /></span>
        {wantedLabel && <span className="tag line">희망 {wantedLabel}</span>}
        <span className="muted">{createdLabel} 요청</span>
      </div>
      {error && <p className="msg error">{error}</p>}
    </li>
  );
}
