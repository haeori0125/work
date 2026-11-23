'use client';

import { useState, useTransition } from 'react';
import { editSegmentAction } from '@/app/actions/admin';

type Props = {
  id: number; dateLabel: string; name: string; index: number; count: number;
  clockIn: string; clockOut: string; missing: boolean; working: boolean; edited: boolean;
  dayTotal: string | null;
};

export function SegmentRow(p: Props) {
  const [inT, setIn] = useState(p.clockIn);
  const [outT, setOut] = useState(p.clockOut);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = inT !== p.clockIn || outT !== p.clockOut;
  const label = `${p.name} ${p.dateLabel}${p.count > 1 ? ` ${p.index + 1}번째` : ''}`;
  return (
    <tr>
      <td>{p.index === 0 ? p.dateLabel : ''}</td>
      <td>{p.index === 0 ? p.name : ''}</td>
      <td className="muted">{p.count > 1 ? `${p.index + 1}/${p.count}` : ''}</td>
      <td><input type="time" value={inT} onChange={(e) => setIn(e.target.value)} aria-label={`${label} 출근`} /></td>
      <td>
        <input type="time" value={outT} onChange={(e) => setOut(e.target.value)} aria-label={`${label} 퇴근`} />
        {p.missing && !outT && <> <span className="badge warn">퇴근 미기록</span></>}
        {p.working && !outT && <> <span className="badge accent">근무 중</span></>}
      </td>
      <td>{p.dayTotal ?? ''}{p.edited && <span className="muted"> (수정됨)</span>}</td>
      <td>
        <button className="btn small primary" disabled={!dirty || pending}
          onClick={() => start(async () => {
            const res = await editSegmentAction(p.id, inT, outT);
            setMsg(res?.error ?? res?.ok ?? null);
          })}>저장</button>
        {msg && <span className="muted"> {msg}</span>}
      </td>
    </tr>
  );
}
