import { getDb } from '@/db';
import { getPersonalMemoRecord } from '@/lib/memos';
import { formatWhen } from '@/lib/view';
import { kstDate } from '@/lib/time';
import { requireUser } from '@/server/session';
import { MemoForm } from './MemoForm';

export default async function MemoPage() {
  const user = await requireUser();
  const memo = await getPersonalMemoRecord(await getDb(), user.id);
  return (
    <main className="page">
      <section className="section">
        <div className="section-head"><h2>개인 메모</h2><span className="muted section-sub">나만 볼 수 있습니다</span></div>
        <MemoForm body={memo.body} lastSaved={memo.updatedAt ? formatWhen(memo.updatedAt, kstDate(new Date())) : null} />
      </section>
    </main>
  );
}
