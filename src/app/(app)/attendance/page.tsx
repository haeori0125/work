import Link from 'next/link';
import { getDb } from '@/db';
import { listAttendance } from '@/lib/attendance';
import { monthRange, shiftMonth } from '@/lib/month';
import { formatDuration, kstDate } from '@/lib/time';
import { requireUser } from '@/server/session';
import { AttendanceTable } from './AttendanceTable';

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const now = new Date();
  const current = kstDate(now).slice(0, 7);
  const requested = (await searchParams).month ?? current;
  const month = monthRange(requested) ? requested : current;
  const range = monthRange(month)!;
  const rows = await listAttendance(await getDb(), { userId: user.id, ...range, now });
  const total = rows.reduce((sum, r) => sum + (r.durationMs ?? 0), 0);
  const [y, m] = month.split('-');
  return (
    <main className="page">
      <section className="section">
        <div className="section-head">
          <h2>내 기록</h2>
          <span className="spacer" />
          <span className="muted">합계 {formatDuration(total)}</span>
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <Link className="btn small" href={`/attendance?month=${shiftMonth(month, -1)}`}>◀ 이전 달</Link>
          <strong>{y}년 {Number(m)}월</strong>
          {month < current && <Link className="btn small" href={`/attendance?month=${shiftMonth(month, 1)}`}>다음 달 ▶</Link>}
        </div>
        <AttendanceTable rows={rows} />
        <p className="muted">출근은 그날 첫 로그인 시간입니다. 자정까지 퇴근을 누르지 않으면 &lsquo;퇴근 미기록&rsquo;으로 남고, 관리자가 고칠 수 있습니다.</p>
      </section>
    </main>
  );
}
