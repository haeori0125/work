import { getDb } from '@/db';
import { listActiveMembers } from '@/lib/members';
import { monthRange, shiftMonth } from '@/lib/month';
import { getOnsiteDays, listChanges } from '@/lib/onsite';
import { getPrefs } from '@/lib/prefs';
import { addDays, formatDateLabel, kstDate, weekStartOf } from '@/lib/time';
import { requireUser } from '@/server/session';
import { OnsiteView } from './OnsiteView';

const WD = ['월', '화', '수', '목', '금', '토', '일'];

export default async function OnsitePage({ searchParams }: { searchParams: Promise<{ month?: string; view?: string }> }) {
  const user = await requireUser();
  const db = await getDb();
  const sp = await searchParams;
  const today = kstDate(new Date());
  const thisMonth = today.slice(0, 7);
  const month = sp.month && monthRange(sp.month) ? sp.month : thisMonth;
  const range = monthRange(month)!;
  const prefs = await getPrefs(db, user.id);
  const gridStart = weekStartOf(range.from, prefs.weekStart);
  let gridEnd = addDays(gridStart, 34);
  if (gridEnd < range.to) gridEnd = addDays(gridEnd, 7);
  const [days, changes, members] = await Promise.all([
    getOnsiteDays(db, gridStart, gridEnd), listChanges(db, range.from, range.to), listActiveMembers(db),
  ]);
  const weekdays = (prefs.weekStart === 'sun' ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]).map((i) => WD[i]);
  const view = sp.view === 'changes' ? 'changes' : 'cal';

  return (
    <OnsiteView
      me={{ id: user.id, role: user.role }} view={view} today={today}
      month={month} monthTitle={`${month.slice(0, 4)}년 ${Number(month.slice(5))}월`}
      prevMonth={shiftMonth(month, -1)} nextMonth={shiftMonth(month, 1)} isThisMonth={month === thisMonth}
      weekdays={weekdays}
      days={days.map((d) => ({ ...d, inMonth: d.date.slice(0, 7) === month, label: formatDateLabel(d.date) }))}
      changes={changes.map((c) => ({ ...c, label: formatDateLabel(c.date) }))}
      members={members}
    />
  );
}
