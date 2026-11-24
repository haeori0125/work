import { getDb } from '@/db';
import { listActiveMembers } from '@/lib/members';
import { monthRange, shiftMonth } from '@/lib/month';
import { listLectures } from '@/lib/onsite';
import { formatDateLabel, kstDate } from '@/lib/time';
import { requireAdmin } from '@/server/session';
import { LectureAdmin } from './LectureAdmin';

export default async function AdminOnsitePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const db = await getDb();
  const sp = await searchParams;
  const today = kstDate(new Date());
  const thisMonth = today.slice(0, 7);
  const month = sp.month && monthRange(sp.month) ? sp.month : thisMonth;
  const range = monthRange(month)!;
  const [lectures, members] = await Promise.all([listLectures(db, range.from, range.to), listActiveMembers(db)]);
  return (
    <section className="panel os" aria-label="현장 스케줄">
      <div className="panel-head os-head">
        <h2>현장 스케줄</h2>
        <span className="os-legend">오후 13:30–17:00 · 저녁 18:30–22:00</span>
      </div>
      <LectureAdmin key={month} month={month} monthTitle={`${month.slice(0, 4)}년 ${Number(month.slice(5))}월`}
        prevMonth={shiftMonth(month, -1)} nextMonth={shiftMonth(month, 1)} isThisMonth={month === thisMonth}
        defaultStart={range.from} defaultEnd={range.to} members={members}
        lectures={lectures.map((l) => ({ ...l, range: `${formatDateLabel(l.startDate)} ~ ${formatDateLabel(l.endDate)}` }))} />
    </section>
  );
}
