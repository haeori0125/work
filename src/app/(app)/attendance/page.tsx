import { getDb } from '@/db';
import { listDays } from '@/lib/attendance';
import { monthRange } from '@/lib/month';
import { formatDateLabel, formatDuration, formatKstTime, kstDate } from '@/lib/time';
import { requireUser } from '@/server/session';

export default async function AttendancePage() {
  const user = await requireUser();
  const now = new Date();
  const range = monthRange(kstDate(now).slice(0, 7))!;
  const days = await listDays(await getDb(), { userId: user.id, ...range, now });
  return (
    <section className="panel">
      <div className="panel-head"><h2>내 기록</h2></div>
      <ul className="list-card panel-body">
        {days.map((d) => (
          <li key={d.date}>
            <b>{formatDateLabel(d.date)}</b>
            <span className="muted">{d.segments.map((s) => `${formatKstTime(s.clockIn)}–${s.clockOut ? formatKstTime(s.clockOut) : ''}`).join(' · ')}</span>
            <span>{d.state === 'missing' ? '퇴근 미기록' : formatDuration(d.totalMs)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
