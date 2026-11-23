'use client';

import { useTransition } from 'react';
import { deleteTaskAction } from '@/app/actions/admin';

export function DeleteTaskButton({ id, title }: { id: number; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn small danger" disabled={pending}
      onClick={() => { if (confirm(`'${title}' 업무를 삭제할까요?\n삭제해도 지난 기록은 남습니다.`)) start(async () => { await deleteTaskAction(id); }); }}>
      삭제
    </button>
  );
}
