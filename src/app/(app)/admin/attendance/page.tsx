import { getDb } from '@/db';
import { listAttendance } from '@/lib/attendance';
import { addDays, formatDateLabel, formatDuration, formatKstTime, kstDate } from '@/lib/time';
import { EditRow } from './EditRow';

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function AdminAttendancePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const now = new Date();
  const sp = await searchParams;
  const today = kstDate(now);
  const from = isDate(sp.from) ? sp.from! : addDays(today, -6);
  const to = isDate(sp.to) ? sp.to! : today;
  const rows = await listAttendance(await getDb(), { from, to, now });
  return (
    <section className="section">
      <div className="section-head"><h2>출퇴근 기록</h2><span className="spacer" /><span className="muted">{rows.length}건</span></div>
      <form className="row" style={{ marginBottom: 10 }}>
        <input type="date" name="from" defaultValue={from} style={{ width: 'auto' }} aria-label="시작일" />
        <span>~</span>
        <input type="date" name="to" defaultValue={to} style={{ width: 'auto' }} aria-label="종료일" />
        <button className="btn small">조회</button>
      </form>
      {rows.length === 0 ? <p className="empty">기록이 없습니다</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>날짜</th><th>이름</th><th>출근</th><th>퇴근</th><th>근무 시간</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <EditRow key={`${r.id}-${r.clockIn.getTime()}-${r.clockOut?.getTime() ?? 0}`}
                  id={r.id} date={r.date} dateLabel={formatDateLabel(r.date)} name={r.userName}
                  clockIn={formatKstTime(r.clockIn)} clockOut={r.clockOut ? formatKstTime(r.clockOut) : ''}
                  state={r.state} duration={r.durationMs !== null ? formatDuration(r.durationMs) : '–'} edited={r.edited} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">퇴근 칸을 비우고 저장하면 퇴근 기록이 지워집니다. 수정하면 이전 값이 기록으로 남습니다.</p>
    </section>
  );
}
