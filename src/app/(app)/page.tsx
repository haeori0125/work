import { getDb } from '@/db';
import { listBoardPosts } from '@/lib/memos';
import { getPrefs } from '@/lib/prefs';
import { listActiveMembers } from '@/lib/members';
import { listMyRequests } from '@/lib/requests';
import { getPastOccurrences, getTodayOccurrences, getWeekView, getWeeklyOccurrences } from '@/lib/tasks';
import { addDays, formatDateLabel, kstDate, kstWeekday, weekStartOf } from '@/lib/time';
import { toNoteView, toOccurrenceView } from '@/lib/view';
import { requireUser } from '@/server/session';
import { MemoPanel } from './_components/MemoPanel';
import { MonthPanel } from './_components/MonthPanel';
import { monthRange, shiftMonth } from '@/lib/month';
import { getOnsiteDays } from '@/lib/onsite';
import { TodayPanel } from './_components/TodayPanel';
import { WeekPanel } from './_components/WeekPanel';

const WD = ['월', '화', '수', '목', '금', '토', '일'];
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;

export default async function Home({ searchParams }: { searchParams: Promise<{ week?: string; month?: string }> }) {
  const user = await requireUser();
  const me = { id: user.id, role: user.role };
  const db = await getDb();
  const today = kstDate(new Date());
  const prefs = await getPrefs(db, user.id);
  // ?week=날짜 로 다른 주를 넘겨 볼 수 있다(형식이 틀리면 이번 주)
  const sp = await searchParams;
  const wanted = sp.week;
  const base = wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted) && !Number.isNaN(Date.parse(wanted)) ? wanted : today;
  const start = weekStartOf(base, prefs.weekStart);
  const thisStart = weekStartOf(today, prefs.weekStart);
  // 이번 주 업무는 월요일 기준 주로 묶이므로, 보고 있는 칸들 안의 월요일 주를 쓴다
  const goalsWeek = prefs.weekStart === 'sun' ? addDays(start, 1) : start;
  // 전체 업무 달력: ?month=YYYY-MM (틀리면 이번 달). 위클리와 같은 시작 요일로 줄을 나눈다
  const thisMonth = today.slice(0, 7);
  const month = sp.month && monthRange(sp.month) ? sp.month : thisMonth;
  const range = monthRange(month)!;
  const gridStart = weekStartOf(range.from, prefs.weekStart);
  const gridWeeks: string[] = [];
  for (let w = gridStart; w <= range.to; w = addDays(w, 7)) gridWeeks.push(w);
  const gridLast = addDays(gridWeeks.at(-1)!, 6);
  const [onsite, past, day, weekly, week, posts, members, mine, ...monthWeeks] = await Promise.all([
    getOnsiteDays(db, gridStart, gridLast),
    getPastOccurrences(db, today),
    getTodayOccurrences(db, today),
    getWeeklyOccurrences(db, goalsWeek),
    getWeekView(db, start),
    listBoardPosts(db, today),
    listActiveMembers(db),
    user.role === 'admin' ? Promise.resolve([]) : listMyRequests(db, user.id),
    ...gridWeeks.map((w) => getWeekView(db, w)),
  ]);
  const v = (list: typeof day) => list.map((o) => toOccurrenceView(o, today));
  const days = Object.entries(week).map(([date, items]) => ({
    date, dayNum: Number(date.slice(8)), weekday: WD[kstWeekday(date)],
    isToday: date === today, isPast: date < today, isSun: kstWeekday(date) === 6, items: v(items),
  }));
  const end = addDays(start, 6);
  const endLabel = start.slice(5, 7) === end.slice(5, 7) ? `${Number(end.slice(8))}일` : md(end);
  const rangeLabel = `${md(start)} – ${endLabel}`;
  // 폰에서 한 줄에 들어가게 짧게: 11.22–28, 11.29–12.5
  const dot = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8))}`;
  const rangeShort = `${dot(start)}–${start.slice(5, 7) === end.slice(5, 7) ? Number(end.slice(8)) : dot(end)}`;
  const q = (week: string | null, m: string | null) => {
    const p = new URLSearchParams();
    if (week) p.set('week', week);
    if (m) p.set('month', m);
    return p.size ? `/?${p}` : '/';
  };
  const keepWeek = start === thisStart ? null : start;
  const keepMonth = month === thisMonth ? null : month;
  const monthDays = monthWeeks.flatMap((wk) => Object.entries(wk)).map(([date, items]) => ({
    date, dayNum: Number(date.slice(8)), inMonth: date.slice(0, 7) === month, isToday: date === today,
    isSun: kstWeekday(date) === 6, isSat: kstWeekday(date) === 5, items: v(items),
    // 현장 강의 출근도 같은 달력에
    onsite: onsite.find((o) => o.date === date)?.lectures ?? [],
  }));
  const weekdayNames = (prefs.weekStart === 'sun' ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]).map((i) => WD[i]);
  const dateLabel = `${md(today)} ${WD[kstWeekday(today)]}요일`;

  return (
    <div className="home">
      <TodayPanel dateLabel={dateLabel} past={v(past)} today={v(day)} me={me} todayDate={today} members={members.map((m) => ({ id: m.id, name: m.name }))}
        myRequests={mine.map((r) => ({ id: r.id, title: r.title, status: r.status, wantedLabel: r.wantedDate ? formatDateLabel(r.wantedDate) : null }))} />
      <div className="home-right">
        <WeekPanel rangeLabel={rangeLabel} rangeShort={rangeShort} prevWeek={addDays(start, -7)} nextWeek={addDays(start, 7)} isThisWeek={start === thisStart} monthQuery={keepMonth ? `&month=${keepMonth}` : ''} days={days} goals={v(weekly)} me={me} members={members.map((m) => m.name)} savedFilter={prefs.weekFilter} />
        <MemoPanel posts={posts.map((p) => toNoteView(p, today))} me={me} />
      </div>
      <MonthPanel title={`${month.slice(0, 4)}년 ${Number(month.slice(5))}월`}
        titleShort={month.slice(0, 4) === today.slice(0, 4) ? `${Number(month.slice(5))}월` : `${month.slice(2, 4)}년 ${Number(month.slice(5))}월`} today={today}
        prevHref={q(keepWeek, shiftMonth(month, -1) === thisMonth ? null : shiftMonth(month, -1))}
        nextHref={q(keepWeek, shiftMonth(month, 1) === thisMonth ? null : shiftMonth(month, 1))}
        thisHref={keepMonth ? q(keepWeek, null) : null} weekdays={weekdayNames} days={monthDays}
        me={me} members={members.map((m) => m.name)} savedFilter={prefs.weekFilter} />
    </div>
  );
}
