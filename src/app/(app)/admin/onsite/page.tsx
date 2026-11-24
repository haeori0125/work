import { getDb } from '@/db';
import { listActiveMembers } from '@/lib/members';
import { getBaseTitles, getBaseWeek, listPeriods, periodFor } from '@/lib/onsite';
import { formatDateLabel, kstDate } from '@/lib/time';
import { requireAdmin } from '@/server/session';
import { BaseSchedule } from './BaseSchedule';

export default async function AdminOnsitePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const db = await getDb();
  const sp = await searchParams;
  const today = kstDate(new Date());
  const [periods, members] = await Promise.all([listPeriods(db), listActiveMembers(db)]);
  // 고른 기간 → 오늘이 속한 기간 → 다가올 첫 기간 → 맨 마지막 기간
  const picked = periods.find((p) => p.id === Number(sp.period))
    ?? periodFor(periods, today) ?? periods.find((p) => p.startDate > today) ?? periods.at(-1) ?? null;
  const [base, titles] = picked ? await Promise.all([getBaseWeek(db, picked.id), getBaseTitles(db, picked.id)]) : [null, null];
  return (
    <section className="panel os" aria-label="현장 기본 스케줄">
      <div className="panel-head os-head">
        <h2>현장 기본 스케줄</h2>
        <span className="os-legend">오후 13:30–17:00 · 저녁 18:30–22:00</span>
      </div>
      <BaseSchedule key={picked?.id ?? 0} today={today} members={members}
        periods={periods.map((p) => ({ ...p, range: `${formatDateLabel(p.startDate)} ~ ${formatDateLabel(p.endDate)}`, current: p.id === periodFor(periods, today)?.id }))}
        picked={picked} base={base} titles={titles} />
    </section>
  );
}
