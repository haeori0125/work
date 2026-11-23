import Link from 'next/link';
import { getDb } from '@/db';
import { listDays } from '@/lib/attendance';
import { monthRange, shiftMonth } from '@/lib/month';
import { addDays, formatDuration, formatKstTime, kstDate, kstWeekday } from '@/lib/time';
import { pctOfDay } from '@/lib/view';
import { requireUser } from '@/server/session';

const WD = ['월', '화', '수', '목', '금', '토', '일'];
const TICKS = [6, 9, 12, 15, 18, 21, 24];

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const now = new Date();
  const today = kstDate(now);
  const current = today.slice(0, 7);
  const requested = (await searchParams).month ?? current;
  const month = monthRange(requested) && requested <= current ? requested : current;
  const range = monthRange(month)!;
  const days = await listDays(await getDb(), { userId: user.id, ...range, now });

  // 끝난 구간은 모두 더한다(열린·미기록 구간은 totalMs에 들어 있지 않음)
  const total = days.reduce((s, d) => s + d.totalMs, 0);
  const missing = days.filter((d) => d.state === 'missing').length;
  const avgIn = days.length
    ? Math.round(days.reduce((s, d) => s + ((d.firstIn.getTime() / 60e3 + 9 * 60) % 1440), 0) / days.length) : null;
  const byDate = new Map(days.map((d) => [d.date, d]));
  const [y, m] = month.split('-').map(Number);

  // 달력: 일요일 시작
  const lead = (kstWeekday(range.from) + 1) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null)];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) cells.push(d);

  return (
    <div className="records">
      <div className="rec-side">
        <section className="panel" aria-label="이번 달 요약">
          <div className="panel-head">
            <h2>내 기록</h2>
            <div className="arrows">
              <Link className="arrow" href={`/attendance?month=${shiftMonth(month, -1)}`} aria-label="이전 달">‹</Link>
              {month < current
                ? <Link className="arrow" href={`/attendance?month=${shiftMonth(month, 1)}`} aria-label="다음 달">›</Link>
                : <span className="arrow off" aria-hidden>›</span>}
            </div>
          </div>
          <p className="month-label">{y}년 {m}월</p>
          <div className="stat-grid">
            <div className="stat"><span className="k">근무한 날</span><span className="v">{days.length}<small>일</small></span></div>
            <div className="stat"><span className="k">총 근무 시간</span><span className="v">{Math.floor(total / 3600e3)}<small>시간</small> {Math.floor(total / 60e3) % 60}<small>분</small></span></div>
            <div className="stat"><span className="k">평균 출근</span><span className="v">{avgIn === null ? '–' : `${String(Math.floor(avgIn / 60)).padStart(2, '0')}:${String(avgIn % 60).padStart(2, '0')}`}</span></div>
            <div className="stat warn"><span className="k">퇴근 미기록</span><span className="v">{missing}<small>건</small></span></div>
          </div>
        </section>
        <section className="panel" aria-label="달력">
          <div className="panel-head"><h2 style={{ fontSize: 16 }}>{m}월</h2></div>
          <div className="cal">
            {['일', '월', '화', '수', '목', '금', '토'].map((w) => <span key={w} className={w === '일' ? 'wd sun' : 'wd'}>{w}</span>)}
            {cells.map((d, i) => d === null ? <span key={`e${i}`} /> : (
              <span key={d} className={`c ${byDate.get(d)?.state === 'missing' ? 'missing' : byDate.has(d) ? 'worked' : ''}${d === today ? ' today' : ''}`}>
                {Number(d.slice(8))}
              </span>
            ))}
          </div>
          <div className="cal-legend">
            <span><i style={{ background: 'var(--soft)' }} />근무</span>
            <span><i style={{ background: 'var(--red-soft)' }} />퇴근 미기록</span>
            <span><i style={{ boxShadow: 'inset 0 0 0 1.5px var(--accent)' }} />오늘</span>
          </div>
        </section>
      </div>

      <section className="panel" aria-label="날짜별 출퇴근">
        <div className="panel-head"><h2 style={{ fontSize: 18 }}>날짜별 출퇴근</h2><span className="sub" style={{ marginLeft: 'auto' }}>막대는 출근부터 퇴근까지</span></div>
        <div className="rec-scale"><span /><div className="ticks">{TICKS.map((h) => <span key={h} style={{ left: `${((h - 6) / 18) * 100}%` }}>{h}</span>)}</div><span /></div>
        {days.length === 0 ? <p className="empty">이 달에는 기록이 없습니다</p> : (
          <ul className="rec-list">
            {days.map((d) => {
              const w = WD[kstWeekday(d.date)];
              const working = d.state === 'working';
              const shown = d.totalMs + (working ? d.segments.filter((s) => !s.clockOut).reduce((s, x) => s + (now.getTime() - x.clockIn.getTime()), 0) : 0);
              return (
                <li key={d.date} className="rec">
                  <span className={`date${w === '일' ? ' sun' : ''}`}>{Number(d.date.slice(5, 7))}/{Number(d.date.slice(8))}<small>{w}요일</small></span>
                  <div className="tl">
                    <div className="track">
                      {d.segments.map((s) => {
                        const end = s.clockOut ?? (working ? now : new Date(Math.min(s.clockIn.getTime() + 9 * 3600e3, Date.parse(`${addDays(d.date, 1)}T00:00:00+09:00`))));
                        const left = pctOfDay(s.clockIn, d.date);
                        return <span key={s.id} className={`bar${s.clockOut ? '' : working ? ' open' : ' missing'}`}
                          style={{ left: `${left}%`, width: `${Math.max(0.8, pctOfDay(end, d.date) - left)}%` }} />;
                      })}
                    </div>
                    <div className="seg-times">
                      {d.segments.map((s) => (
                        <span key={s.id}>{formatKstTime(s.clockIn)}{s.clockOut ? `–${formatKstTime(s.clockOut)}` : working ? ' →' : ' 출근'}</span>
                      ))}
                    </div>
                  </div>
                  <span className="dur">
                    {d.state === 'missing'
                      ? <><span className="badge warn">퇴근 미기록</span>{d.totalMs > 0 && <small>확인된 {formatDuration(d.totalMs)}</small>}</>
                      : <>{formatDuration(shown)}{working && <small>근무 중</small>}</>}
                    {d.segments.length > 1 && <small>{d.segments.length}회 합산</small>}
                    {d.edited && <small>수정됨</small>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="rec-foot">로그인하면 출근, 퇴근하기를 누르면 그 구간이 끝나고 로그아웃됩니다. 하루에 여러 번 반복하면 모든 구간을 더해 근무 시간을 계산합니다. 자정까지 퇴근을 누르지 않은 구간은 &lsquo;퇴근 미기록&rsquo;으로 남고, 관리자가 고칠 수 있습니다.</p>
      </section>
    </div>
  );
}
