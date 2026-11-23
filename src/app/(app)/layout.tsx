import { getDb } from '@/db';
import { getToday } from '@/lib/attendance';
import { getAvatarMap, getPrefs } from '@/lib/prefs';
import { AvatarProvider } from '@/app/_ui/AvatarContext';
import { formatKstTime, kstDate } from '@/lib/time';
import { requireUser } from '@/server/session';
import { RefreshOnFocus } from './_components/RefreshOnFocus';
import { ShiftBar } from './_components/ShiftBar';
import { IndexTabs } from './_components/IndexTabs';
import { TopBar } from './_components/TopBar';
import { isXmasSeason } from '@/lib/season';
import { RememberTheme } from './_components/RememberTheme';
import { encodeThemeCookie } from '@/lib/theme-cookie';

const WD = ['일', '월', '화', '수', '목', '금', '토'];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const now = new Date();
  const db = await getDb();
  const [today, prefs, avatars] = await Promise.all([getToday(db, user.id, now), getPrefs(db, user.id), getAvatarMap(db)]);
  const d = kstDate(now);
  const dateLabel = `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일 (${WD[new Date(`${d}T00:00:00Z`).getUTCDay()]})`;
  return (
    <AvatarProvider map={avatars}>
    <div className="shell">
      <ShiftBar
        name={user.name}
        dateLabel={dateLabel}
        firstIn={today ? formatKstTime(today.firstIn) : null}
        working={today?.state === 'working'}
      />
      <div className="frame">
        <TopBar name={user.name} isAdmin={user.role === 'admin'} avatar={prefs.avatar} xmas={isXmasSeason(kstDate(new Date()))}
          tabs={<IndexTabs isAdmin={user.role === 'admin'} />} />
        <div className="content">{children}</div>
      </div>
      <RefreshOnFocus />
      <RememberTheme value={encodeThemeCookie(prefs)} />
    </div>
    </AvatarProvider>
  );
}
