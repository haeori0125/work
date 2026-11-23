'use client';

import { useState, useTransition } from 'react';
import { cancelClockOutAction, clockOutAction } from '@/app/actions/attendance';

export function ClockBar({ clockIn, clockOut }: { clockIn: string | null; clockOut: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: typeof clockOutAction) => start(async () => {
    const res = await fn();
    setError(res?.error ?? null);
  });
  return (
    <>
      <span className="muted">{clockIn ? `출근 ${clockIn}` : '출근 기록 없음'}</span>
      {clockIn && (clockOut ? (
        <>
          <span className="muted">· 퇴근 {clockOut}</span>
          <button className="btn small" disabled={pending} onClick={() => run(cancelClockOutAction)}>퇴근 취소</button>
        </>
      ) : (
        <button className="btn small primary" disabled={pending}
          onClick={() => { if (confirm('퇴근을 기록할까요?')) run(clockOutAction); }}>퇴근</button>
      ))}
      {error && <span className="badge warn">{error}</span>}
    </>
  );
}
