import { getDb } from '@/db';
import { listDays } from '@/lib/attendance';
import { addDays, formatDateLabel, formatDuration, formatKstTime, kstDate } from '@/lib/time';
import { requireAdmin } from '@/server/session';
import { SegmentRow } from './SegmentRow';

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function AdminAttendancePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireAdmin();
  const now = new Date();
  const sp = await searchParams;
  const today = kstDate(now);
  const from = isDate(sp.from) ? sp.from! : addDays(today, -6);
  const to = isDate(sp.to) ? sp.to! : today;
  const days = await listDays(await getDb(), { from, to, now });
  return (
    <section className="panel">
      <div className="panel-head"><h2>출퇴근 기록</h2><span className="count" style={{ fontSize: 14 }}>{days.length}건</span></div>
      <div className="panel-body stack">
        <form className="row">
          <input type="date" name="from" defaultValue={from} style={{ width: 'auto' }} aria-label="시작일" />
          <span>~</span>
          <input type="date" name="to" defaultValue={to} style={{ width: 'auto' }} aria-label="종료일" />
          <button className="btn small">조회</button>
        </form>
        {days.length === 0 ? <p className="muted">기록이 없습니다</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>날짜</th><th>이름</th><th>구간</th><th>출근</th><th>퇴근</th><th>하루 합계</th><th></th></tr></thead>
              <tbody>
                {days.flatMap((d) => d.segments.map((s, i) => (
                  <SegmentRow
                    key={`${s.id}-${s.clockIn.getTime()}-${s.clockOut?.getTime() ?? 0}`}
                    id={s.id} dateLabel={formatDateLabel(d.date)} name={d.userName} index={i} count={d.segments.length}
                    clockIn={formatKstTime(s.clockIn)} clockOut={s.clockOut ? formatKstTime(s.clockOut) : ''}
                    missing={d.state === 'missing'} working={d.state === 'working'} edited={s.edited}
                    dayTotal={i === 0 ? (d.state === 'missing' ? '퇴근 미기록' : formatDuration(d.totalMs)) : null}
                  />
                )))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">하루에 여러 번 출퇴근한 경우 구간별로 나옵니다. 퇴근 칸을 비우고 저장하면 퇴근 기록이 지워집니다. 수정하면 이전 값이 기록으로 남습니다.</p>
      </div>
    </section>
  );
}
