'use client';

import { useState, useTransition } from 'react';
import { endShiftAction } from '@/app/actions/attendance';
import { MiniAvatar } from '@/app/_ui/AvatarContext';

/** 조교실(학생 관리) 사이트 */
const STUDENTS_URL = 'https://team-sunduck.vercel.app/admin?tab=students';

type Props = { name: string; dateLabel: string; firstIn: string | null; working: boolean };

export function ShiftBar({ name, dateLabel, firstIn, working }: Props) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const out = () => start(async () => {
    const res = await endShiftAction();
    if (res?.error) { setError(res.error); setAsking(false); }
  });
  return (
    <div className="shift">
      <span className="who"><MiniAvatar name={name} size={26} />{name}</span>
      <span className={working ? 'pill' : 'pill off'}>{working ? '근무 중' : '근무 기록 없음'}</span>
      <span className="st">{dateLabel}{firstIn && <span className="st-in">출근 <b>{firstIn}</b></span>}</span>
      <div className="out-area">
        {error && <span className="badge warn">{error}</span>}
        {asking ? (
          <>
            <span className="out-q">퇴근할까요? 퇴근하면 로그아웃됩니다.</span>
            <button type="button" className="out-btn ghost" onClick={() => setAsking(false)} disabled={pending}>취소</button>
            <button type="button" className="out-btn" onClick={out} disabled={pending}>{pending ? '퇴근 중…' : '퇴근'}</button>
          </>
        ) : (
          <>
            <a className="out-btn link-btn" href={STUDENTS_URL} target="_blank" rel="noopener noreferrer" title="조교실 (새 탭)" aria-label="조교실">
              <span aria-hidden>💻</span>
            </a>
            {working && <button type="button" className="out-btn" onClick={() => setAsking(true)}>퇴근하기</button>}
          </>
        )}
      </div>
    </div>
  );
}
