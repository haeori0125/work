import { getDb } from '@/db';
import { getToday } from '@/lib/attendance';
import { listPendingRequests } from '@/lib/requests';
import { getAvatarMap, getPrefs } from '@/lib/prefs';
import { AvatarProvider } from '@/app/_ui/AvatarContext';
import { formatKstTime, kstDate } from '@/lib/time';
import { cookies } from 'next/headers';
import { getPastOccurrences } from '@/lib/tasks';
import { toOccurrenceView } from '@/lib/view';
import { PAST_ALERT_COOKIE, requireUser } from '@/server/session';
import { PastAlert } from './_components/PastAlert';
import { RefreshOnFocus } from './_components/RefreshOnFocus';
import { ShiftBar } from './_components/ShiftBar';
import { IndexTabs } from './_components/IndexTabs';
import { TopBar } from './_components/TopBar';
import { RememberTheme } from './_components/RememberTheme';
import { encodeThemeCookie } from '@/lib/theme-cookie';

const WD = ['일', '월', '화', '수', '목', '금', '토'];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const now = new Date();
  const db = await getDb();
  // 로그인 직후면 내가 맡은 지난 업무(담당이거나, 아직 안 끝난 파트를 맡은 것)
  const justIn = (await cookies()).get(PAST_ALERT_COOKIE)?.value === '1';
  const pastMine = justIn
    ? (await getPastOccurrences(db, kstDate(now))).map((o) => toOccurrenceView(o, kstDate(now)))
      .filter((o) => o.assignees.includes(user.name) || o.parts.some((p) => p.assignee === user.name && p.status !== 'done'))
    : [];
  const [today, prefs, avatars, requests] = await Promise.all([
    getToday(db, user.id, now), getPrefs(db, user.id), getAvatarMap(db),
    user.role === 'admin' ? listPendingRequests(db) : Promise.resolve([]),
  ]);
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
        <TopBar name={user.name} isAdmin={user.role === 'admin'} avatar={prefs.avatar} working={today?.state === 'working'}
          tabs={<IndexTabs isAdmin={user.role === 'admin'} pendingRequests={requests.length} />} />
        <div className="content">{children}</div>
      </div>
      {justIn && <PastAlert items={pastMine} me={{ id: user.id, role: user.role }} />}
      <RefreshOnFocus />
      <RememberTheme value={encodeThemeCookie(prefs)} />
    </div>
    </AvatarProvider>
  );
}
