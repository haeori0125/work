import { getDb } from '@/db';
import { getTodayAttendance } from '@/lib/attendance';
import { formatDateLabel, formatKstTime, kstDate } from '@/lib/time';
import { requireUser } from '@/server/session';
import { ClockBar } from './_components/ClockBar';
import { NavLinks } from './_components/NavLinks';
import { RefreshOnFocus } from './_components/RefreshOnFocus';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const now = new Date();
  const att = await getTodayAttendance(await getDb(), user.id, now);
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="who">
            <strong>{user.name}</strong>
            {user.role === 'admin' && <span className="badge doing">관리자</span>}
            <span className="muted">{formatDateLabel(kstDate(now))}</span>
            <ClockBar
              clockIn={att ? formatKstTime(att.clockIn) : null}
              clockOut={att?.clockOut ? formatKstTime(att.clockOut) : null}
            />
          </div>
          <NavLinks isAdmin={user.role === 'admin'} />
        </div>
      </header>
      <RefreshOnFocus />
      {children}
    </>
  );
}
