import { getDb } from '@/db';
import { listBoardPosts } from '@/lib/memos';
import { getPrefs } from '@/lib/prefs';
import { getDayOccurrences, getPastOccurrences, getWeekView, getWeeklyOccurrences } from '@/lib/tasks';
import { addDays, kstDate, kstWeekday, weekStartOf } from '@/lib/time';
import { toNoteView, toOccurrenceView } from '@/lib/view';
import { requireUser } from '@/server/session';
import { MemoPanel } from './_components/MemoPanel';
import { TodayPanel } from './_components/TodayPanel';
import { WeekPanel } from './_components/WeekPanel';

const WD = ['월', '화', '수', '목', '금', '토', '일'];
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;

export default async function Home() {
  const user = await requireUser();
  const me = { id: user.id, role: user.role };
  const db = await getDb();
  const today = kstDate(new Date());
  const prefs = await getPrefs(db, user.id);
  const start = weekStartOf(today, prefs.weekStart);
  const [past, day, weekly, week, posts] = await Promise.all([
    getPastOccurrences(db, today),
    getDayOccurrences(db, today),
    getWeeklyOccurrences(db, weekStartOf(today)),
    getWeekView(db, start),
    listBoardPosts(db, today),
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
      <TodayPanel dateLabel={dateLabel} past={v(past)} today={v(day)} me={me} />
      <div className="home-right">
        <WeekPanel rangeLabel={rangeLabel} days={days} goals={v(weekly)} me={me} />
        <MemoPanel posts={posts.map((p) => toNoteView(p, today))} me={me} />
      </div>
    </div>
  );
}
