import type { AttendanceRow } from '@/lib/attendance';
import { formatDateLabel, formatDuration, formatKstTime } from '@/lib/time';

export function AttendanceTable({ rows, showName = false }: { rows: AttendanceRow[]; showName?: boolean }) {
  if (rows.length === 0) return <p className="empty">기록이 없습니다</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>날짜</th>{showName && <th>이름</th>}<th>출근</th><th>퇴근</th><th>근무 시간</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{formatDateLabel(r.date)}</td>
              {showName && <td>{r.userName}</td>}
              <td>{formatKstTime(r.clockIn)}</td>
              <td>
                {r.state === 'done' && r.clockOut && formatKstTime(r.clockOut)}
                {r.state === 'missing' && <span className="badge warn">퇴근 미기록</span>}
                {r.state === 'working' && <span className="badge doing">근무 중</span>}
              </td>
              <td>
                {r.durationMs !== null ? formatDuration(r.durationMs) : '–'}
                {r.edited && <span className="muted"> (수정됨)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
