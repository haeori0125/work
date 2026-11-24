import { getDb } from '@/db';
import { DateField } from '@/app/_ui/DateField';
import { listDays } from '@/lib/attendance';
import { addDays, formatDateLabel, formatDuration, formatKstTime, kstDate } from '@/lib/time';
import { requireAdmin } from '@/server/session';
import { listActiveMembers } from '@/lib/members';
import { getPrefs } from '@/lib/prefs';
import { MemberFilter } from './MemberFilter';
import { SegmentRow } from './SegmentRow';

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function AdminAttendancePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; who?: string }> }) {
  const admin = await requireAdmin();
  const now = new Date();
  const sp = await searchParams;
  const today = kstDate(now);
  const from = isDate(sp.from) ? sp.from! : addDays(today, -6);
  const to = isDate(sp.to) ? sp.to! : today;
  const db = await getDb();
  const [all, members, prefs] = await Promise.all([listDays(db, { from, to, now }), listActiveMembers(db), getPrefs(db, admin.id)]);
  // 주소에 who가 없으면 계정에 저장한 필터, 있으면(빈 값 = 전체) 그대로
  const who = sp.who === undefined ? prefs.attendanceFilter ?? [] : sp.who.split(',').map((s) => s.trim()).filter(Boolean);
  // 최근 것이 위로: 날짜 내림차순, 같은 날은 마지막 출근이 늦은 사람부터, 구간도 늦은 것부터
  const last = (d: (typeof all)[number]) => Math.max(...d.segments.map((s) => s.clockIn.getTime()));
  const days = all.filter((d) => !who.length || who.includes(d.userName))
    .sort((a, b) => b.date.localeCompare(a.date) || last(b) - last(a));
  const names = [...new Set([...members.map((m) => m.name), ...all.map((d) => d.userName)])];
  return (
    <section className="panel">
      <div className="panel-head"><h2>출퇴근 기록</h2><span className="count" style={{ fontSize: 14 }}>{days.length}건</span><MemberFilter members={names} selected={who} saved={prefs.attendanceFilter ?? []} /></div>
      <div className="panel-body stack">
        <form className="row">
          <DateField name="from" defaultValue={from} aria-label="시작일" />
          <span>~</span>
          <DateField name="to" defaultValue={to} aria-label="종료일" />
          {sp.who !== undefined && <input type="hidden" name="who" value={who.join(',')} />}
          <button className="btn small">조회</button>
        </form>
        {days.length === 0 ? <p className="muted">기록이 없습니다</p> : (
          <div className="table-wrap">
            <table className="seg-table">
              <thead><tr><th>날짜</th><th>이름</th><th>구간</th><th>출근</th><th>퇴근</th><th>하루 합계</th><th></th></tr></thead>
              <tbody>
                {days.flatMap((d) => d.segments.map((s, i) => ({ s, i })).reverse().map(({ s, i }, row) => (
                  <SegmentRow
                    key={`${s.id}-${s.clockIn.getTime()}-${s.clockOut?.getTime() ?? 0}`}
                    id={s.id} dateLabel={formatDateLabel(d.date)} name={d.userName} index={i} lead={row === 0} count={d.segments.length}
                    clockIn={formatKstTime(s.clockIn)} clockOut={s.clockOut ? formatKstTime(s.clockOut) : ''}
                    missing={d.state === 'missing'} working={d.state === 'working'} edited={s.edited}
                    dayTotal={row === 0 ? (d.state === 'missing' ? '퇴근 미기록' : formatDuration(d.totalMs)) : null}
                  />
                )))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">하루에 여러 번 출퇴근한 경우 구간별로 나옵니다. 퇴근 칸을 비우고 저장하면 퇴근 기록이 지워집니다. 수정하면 이전 값이 기록으로 남고, 삭제하면 그 구간과 수정 기록이 함께 지워집니다.</p>
      </div>
    </section>
  );
}
