'use client';

import { useState, useTransition } from 'react';
import { editAttendanceAction } from '@/app/actions/admin';

type Props = {
  id: number; date: string; dateLabel: string; name: string; clockIn: string; clockOut: string;
  state: 'working' | 'done' | 'missing'; duration: string; edited: boolean;
};

export function EditRow(p: Props) {
  const [inT, setIn] = useState(p.clockIn);
  const [outT, setOut] = useState(p.clockOut);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = inT !== p.clockIn || outT !== p.clockOut;
  return (
    <tr>
      <td>{p.dateLabel}</td>
      <td>{p.name}</td>
      <td><input type="time" value={inT} onChange={(e) => setIn(e.target.value)} aria-label={`${p.name} ${p.dateLabel} 출근`} /></td>
      <td>
        <input type="time" value={outT} onChange={(e) => setOut(e.target.value)} aria-label={`${p.name} ${p.dateLabel} 퇴근`} />
        {p.state === 'missing' && !outT && <> <span className="badge warn">퇴근 미기록</span></>}
      </td>
      <td>{p.duration}{p.edited && <span className="muted"> (수정됨)</span>}</td>
      <td>
        <button className="btn small primary" disabled={!dirty || pending}
          onClick={() => start(async () => {
            const res = await editAttendanceAction(p.id, p.date, inT, outT);
            setMsg(res?.error ?? res?.ok ?? null);
          })}>저장</button>
        {msg && <span className="muted"> {msg}</span>}
      </td>
    </tr>
  );
}
