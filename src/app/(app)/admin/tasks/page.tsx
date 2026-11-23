import Link from 'next/link';
import { getDb } from '@/db';
import { requireAdmin } from '@/server/session';
import { listActiveMembers } from '@/lib/members';
import { listTaskDefinitions } from '@/lib/tasks';
import { formatDateLabel, kstDate } from '@/lib/time';
import { describeRepeat } from '@/lib/view';
import { DeleteTaskButton } from './DeleteTaskButton';
import { TaskForm } from './TaskForm';

export default async function AdminTasksPage({ searchParams }: { searchParams: Promise<{ edit?: string; saved?: string }> }) {
  await requireAdmin();
  const db = await getDb();
  const sp = await searchParams;
  const [defs, members] = await Promise.all([listTaskDefinitions(db), listActiveMembers(db)]);
  const editing = sp.edit ? defs.find((d) => d.id === Number(sp.edit)) ?? null : null;
  const nameOf = (id: number) => members.find((m) => m.id === id)?.name ?? '(비활성)';
  const period = (d: (typeof defs)[number]) =>
    d.repeat === 'none' ? formatDateLabel(d.startDate)
      : `${formatDateLabel(d.startDate)} ~ ${d.endDate ? formatDateLabel(d.endDate) : ''}`;

  return (
    <>
      <section className="panel admin-card">
        <div className="panel-head"><h2>{editing ? '업무 수정' : '업무 추가'}</h2></div>
        {sp.saved && !editing && <p className="msg ok" style={{ marginBottom: 10 }}>저장했습니다</p>}
        <TaskForm task={editing} members={members} today={kstDate(new Date())} />
      </section>
      <section className="panel admin-card">
        <div className="panel-head"><h2>등록된 업무</h2><span className="spacer" /><span className="muted">{defs.length}개</span></div>
        {defs.length === 0 ? <p className="empty">등록된 업무가 없습니다</p> : (
          <ul className="list-card">
            {defs.map((d) => (
              <li key={d.id} className="task">
                <div className="task-top">
                  <span className="task-title">{d.title}</span>
                  <Link className="btn small" href={`/admin/tasks?edit=${d.id}`}>수정</Link>
                  <DeleteTaskButton id={d.id} title={d.title} />
                </div>
                <div className="tags">
                  <span className="tag line">{d.repeat === 'none' ? '' : '↻ '}{describeRepeat(d)}</span>
                  <span className="tag line">{period(d)}</span>
                  {d.dueWeekday !== null && <span className="tag line">~{['월', '화', '수', '목', '금', '토', '일'][d.dueWeekday]}</span>}
                  {d.dueDate && <span className="tag line">~{formatDateLabel(d.dueDate)}</span>}
                  {d.assigneeIds.length > 0 && <span className="tag line">담당 {d.assigneeIds.map(nameOf).join(', ')}</span>}
                  {d.parts.length > 0 && <span className="tag line">파트 {d.parts.length}개</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
