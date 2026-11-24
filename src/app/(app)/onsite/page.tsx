import { getDb } from '@/db';
import { listActiveMembers } from '@/lib/members';
import { monthRange, shiftMonth } from '@/lib/month';
import { getBaseTitles, getBaseWeek, getOnsiteDays, listChanges, shiftTerm, termLabel, termOf } from '@/lib/onsite';
import { getPrefs } from '@/lib/prefs';
import { addDays, formatDateLabel, kstDate, weekStartOf } from '@/lib/time';
import { requireUser } from '@/server/session';
import { OnsiteView } from './OnsiteView';

const WD = ['월', '화', '수', '목', '금', '토', '일'];

export default async function OnsitePage({ searchParams }: { searchParams: Promise<{ month?: string; term?: string; view?: string }> }) {
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
  // 기본 스케줄은 고른 기간, 없으면 보고 있는 달의 기간
  const term = sp.term && /^\d{4}-[1-5]$/.test(sp.term) ? sp.term : termOf(range.from);
  const [days, changes, members, base, titles] = await Promise.all([
    getOnsiteDays(db, gridStart, gridEnd), listChanges(db, range.from, range.to), listActiveMembers(db), getBaseWeek(db, term), getBaseTitles(db, term),
  ]);
  // 변동 사항 목록에도 그날 지점명을 붙인다
  const titleOf = new Map(days.flatMap((d) => d.slots.map((s) => [`${d.date}-${s.slot}`, s.title] as const)));
  const weekdays = (prefs.weekStart === 'sun' ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]).map((i) => WD[i]);
  const view = sp.view === 'changes' || sp.view === 'base' ? sp.view : 'cal';

  return (
    <OnsiteView
      me={{ id: user.id, role: user.role }} view={view} today={today}
      month={month} monthTitle={`${month.slice(0, 4)}년 ${Number(month.slice(5))}월`}
      prevMonth={shiftMonth(month, -1)} nextMonth={shiftMonth(month, 1)} isThisMonth={month === thisMonth}
      weekdays={weekdays}
      days={days.map((d) => ({ ...d, inMonth: d.date.slice(0, 7) === month, label: formatDateLabel(d.date) }))}
      changes={changes.map((c) => ({ ...c, label: formatDateLabel(c.date), title: titleOf.get(`${c.date}-${c.slot}`) ?? null }))}
      members={members} term={term} termTitle={termLabel(term)} prevTerm={shiftTerm(term, -1)} nextTerm={shiftTerm(term, 1)}
      prevTermTitle={termLabel(shiftTerm(term, -1))} base={base} titles={titles}
    />
  );
}
