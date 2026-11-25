'use client';

import { useEffect, useState, useTransition } from 'react';
import { deleteSegmentAction, editSegmentAction } from '@/app/actions/admin';
import { Person } from '@/app/_ui/AvatarContext';
import { useToast } from '@/app/_ui/Toast';

type Props = {
  id: number; dateLabel: string; name: string; index: number; count: number;
  /** 그 사람·그 날의 첫 줄(날짜·이름·합계를 보여 줌) */
  lead: boolean;
  clockIn: string; clockOut: string; missing: boolean; working: boolean; edited: boolean;
  dayTotal: string | null;
  /** 펼쳤을 때 보이는 나머지 구간 줄 */
  sub?: boolean;
  /** 첫 줄: 나머지 구간 펼치기/접기 */
  toggle?: { open: boolean; onToggle: () => void };
};

export function SegmentRow(p: Props) {
  const [inT, setIn] = useState(p.clockIn);
  const [outT, setOut] = useState(p.clockOut);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const toast = useToast();
  // 삭제 확인은 3초 뒤 저절로 풀린다(아이폰은 다른 곳을 눌러도 버튼 포커스가 안 빠져서)
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  const dirty = inT !== p.clockIn || outT !== p.clockOut;
  const label = `${p.name} ${p.dateLabel}${p.count > 1 ? ` ${p.index + 1}번째` : ''}`;
  return (
    <tr className={p.lead ? 'seg-first' : p.sub ? 'seg-sub' : undefined}>
      <td className="c-date">{p.lead ? p.dateLabel : ''}</td>
      <td className="c-name">{p.lead ? <Person name={p.name} size={20} /> : ''}</td>
      <td className="c-seg muted">
        {p.toggle ? (
          <button type="button" className="seg-toggle" aria-expanded={p.toggle.open} onClick={p.toggle.onToggle}
            aria-label={`${p.name} ${p.dateLabel} 구간 ${p.count}개 ${p.toggle.open ? '접기' : '펼치기'}`}>
            <span className="seg-chev" aria-hidden>›</span>구간 {p.count}개
          </button>
        ) : p.count > 1 ? `${p.index + 1}/${p.count}` : ''}
      </td>
      <td className="c-in"><input type="time" value={inT} onChange={(e) => setIn(e.target.value)} aria-label={`${label} 출근`} /></td>
      <td className="c-out">
        <input type="time" value={outT} onChange={(e) => setOut(e.target.value)} aria-label={`${label} 퇴근`} />
        {p.missing && !outT && <> <span className="badge warn">퇴근 미기록</span></>}
        {p.working && !outT && <> <span className="badge accent">근무 중</span></>}
      </td>
      <td className="c-total">{p.dayTotal ?? ''}{p.edited && <span className="muted"> (수정됨)</span>}</td>
      <td className="c-act">
        <button className="btn small primary" disabled={!dirty || pending}
          onClick={() => start(async () => {
            const res = await editSegmentAction(p.id, inT, outT);
            setMsg(res?.error ?? null);
            if (!res?.error) toast('저장되었습니다');
          })}>저장</button>
        <button className="btn small danger" disabled={pending} style={{ marginLeft: 6 }}
          onClick={() => {
            if (!armed) { setArmed(true); setMsg(null); return; }
            start(async () => {
              const res = await deleteSegmentAction(p.id);
              setArmed(false);
              setMsg(res?.error ?? null);
              if (!res?.error) toast('삭제되었습니다');
            });
          }}
          onBlur={() => setArmed(false)}>
          {armed ? '정말 삭제' : '삭제'}
        </button>
        {msg && <span className="muted"> {msg}</span>}
      </td>
    </tr>
  );
}
