import { getDb } from '@/db';
import { listBoardPosts } from '@/lib/memos';
import { getPrefs } from '@/lib/prefs';
import { listActiveMembers } from '@/lib/members';
import { listMyRequests } from '@/lib/requests';
import { getDayOccurrences, getPastOccurrences, getWeekView, getWeeklyOccurrences } from '@/lib/tasks';
import { addDays, formatDateLabel, kstDate, kstWeekday, weekStartOf } from '@/lib/time';
import { toNoteView, toOccurrenceView } from '@/lib/view';
import { requireUser } from '@/server/session';
import { MemoPanel } from './_components/MemoPanel';
import { TodayPanel } from './_components/TodayPanel';
import { WeekPanel } from './_components/WeekPanel';

const WD = ['월', '화', '수', '목', '금', '토', '일'];
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;

export default async function Home({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requireUser();
  const me = { id: user.id, role: user.role };
  const db = await getDb();
  const today = kstDate(new Date());
  const prefs = await getPrefs(db, user.id);
  // ?week=날짜 로 다른 주를 넘겨 볼 수 있다(형식이 틀리면 이번 주)
  const wanted = (await searchParams).week;
  const base = wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted) && !Number.isNaN(Date.parse(wanted)) ? wanted : today;
  const start = weekStartOf(base, prefs.weekStart);
  const thisStart = weekStartOf(today, prefs.weekStart);
  // 이번 주 업무는 월요일 기준 주로 묶이므로, 보고 있는 칸들 안의 월요일 주를 쓴다
  const goalsWeek = prefs.weekStart === 'sun' ? addDays(start, 1) : start;
  const [past, day, weekly, week, posts, members, mine] = await Promise.all([
    getPastOccurrences(db, today),
    getDayOccurrences(db, today),
    getWeeklyOccurrences(db, goalsWeek),
    getWeekView(db, start),
    listBoardPosts(db, today),
    listActiveMembers(db),
    user.role === 'admin' ? Promise.resolve([]) : listMyRequests(db, user.id),
  ]);
  const v = (list: typeof day) => list.map((o) => toOccurrenceView(o, today));
  const days = Object.entries(week).map(([date, items]) => ({
    date, dayNum: Number(date.slice(8)), weekday: WD[kstWeekday(date)],
    isToday: date === today, isPast: date < today, isSun: kstWeekday(date) === 6, items: v(items),
  }));
  const end = addDays(start, 6);
  const endLabel = start.slice(5, 7) === end.slice(5, 7) ? `${Number(end.slice(8))}일` : md(end);
  const rangeLabel = `${md(start)} – ${endLabel}`;
  const dateLabel = `${md(today)} ${WD[kstWeekday(today)]}요일`;

  return (
    <div className="home">
      <TodayPanel dateLabel={dateLabel} past={v(past)} today={v(day)} me={me} todayDate={today} members={members.map((m) => ({ id: m.id, name: m.name }))}
        myRequests={mine.map((r) => ({ id: r.id, title: r.title, status: r.status, wantedLabel: r.wantedDate ? formatDateLabel(r.wantedDate) : null }))} />
      <div className="home-right">
        <WeekPanel rangeLabel={rangeLabel} prevWeek={addDays(start, -7)} nextWeek={addDays(start, 7)} isThisWeek={start === thisStart} days={days} goals={v(weekly)} me={me} members={members.map((m) => m.name)} savedFilter={prefs.weekFilter} />
        <MemoPanel posts={posts.map((p) => toNoteView(p, today))} me={me} />
      </div>
    </div>
  );
}
