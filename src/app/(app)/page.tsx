import { getDb } from '@/db';
import { listBoardPosts } from '@/lib/memos';
import {
  getDayOccurrences, getPastOccurrences, getWeekView, getWeeklyOccurrences,
} from '@/lib/tasks';
import { formatDateLabel, kstDate, kstWeekday, weekStartOf, weekdayLabel } from '@/lib/time';
import { toNoteView, toOccurrenceView } from '@/lib/view';
import { requireUser } from '@/server/session';
import { BoardSection } from './_components/BoardSection';
import { TaskSection } from './_components/TaskSection';
import { WeekView } from './_components/WeekView';

export default async function Home() {
  const user = await requireUser();
  const me = { id: user.id, role: user.role };
  const db = await getDb();
  const today = kstDate(new Date());
  const weekStart = weekStartOf(today);
  const [past, day, weekly, week, posts] = await Promise.all([
    getPastOccurrences(db, today),
    getDayOccurrences(db, today),
    getWeeklyOccurrences(db, weekStart),
    getWeekView(db, weekStart),
    listBoardPosts(db, today),
  ]);
  const v = (list: typeof day) => list.map((o) => toOccurrenceView(o, today));
  const days = Object.entries(week).map(([date, items]) => ({
    date, dayLabel: weekdayLabel(kstWeekday(date)), dateNum: String(Number(date.slice(8))), items: v(items),
  }));

  return (
    <main className="page">
      {past.length > 0 && (
        <TaskSection title="지난 업무" sub="기간이 지났지만 아직 완료되지 않은 업무" items={v(past)} me={me}
          empty="" showDate className="past" />
      )}
      <TaskSection title="오늘 업무" sub={formatDateLabel(today)} items={v(day)} me={me} empty="오늘 업무가 없습니다" />
      <TaskSection title="이번 주 업무" sub="이번 주 안에 끝내면 되는 업무" items={v(weekly)} me={me}
        empty="이번 주 업무가 없습니다" />
      <WeekView days={days} today={today} />
      <BoardSection posts={posts.map((p) => toNoteView(p, today))} me={me} />
    </main>
  );
}
