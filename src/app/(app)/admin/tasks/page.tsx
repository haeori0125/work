import { getDb } from '@/db';
import { requireAdmin } from '@/server/session';
import { listActiveMembers } from '@/lib/members';
import { listPendingRequests } from '@/lib/requests';
import { getOneOffStatuses, listTaskDefinitions } from '@/lib/tasks';
import { formatDateLabel, formatKstTime, kstDate } from '@/lib/time';
import { describeRepeat } from '@/lib/view';
import { FlashToast } from '@/app/_ui/Toast';
import { RegisteredTasks } from './RegisteredTasks';
import { RequestRow } from './RequestRow';
import { TaskForm } from './TaskForm';

export default async function AdminTasksPage({ searchParams }: { searchParams: Promise<{ edit?: string; saved?: string; from?: string }> }) {
  await requireAdmin();
  const db = await getDb();
  const sp = await searchParams;
  const [defs, members, requests, statuses] = await Promise.all([
    listTaskDefinitions(db), listActiveMembers(db), listPendingRequests(db), getOneOffStatuses(db),
  ]);
  const editing = sp.edit ? defs.find((d) => d.id === Number(sp.edit)) ?? null : null;
  const from = editing ? null : requests.find((r) => r.id === Number(sp.from)) ?? null;
  const fromRequest = from && {
    id: from.id, requesterName: from.requesterName,
    spec: from.spec ?? {
      title: from.title, description: from.description, kind: 'dated' as const, repeat: 'none' as const, weekdays: [],
      startDate: from.wantedDate ?? kstDate(new Date()), endDate: null, assigneeIds: [from.requesterId],
    },
  };
  const nameOf = (id: number) => members.find((m) => m.id === id)?.name ?? '(비활성)';
  const registered = defs.map((d) => {
    // 업무 담당자 + 파트 담당자(중복 제외)
    const ids = [...new Set([...d.assigneeIds, ...d.parts.map((p) => p.assigneeId).filter((x): x is number => x !== null)])];
    return {
      id: d.id, title: d.title, date: d.startDate, assignees: ids.map(nameOf),
      status: d.repeat === 'none' ? statuses.get(d.id) ?? 'todo' : ('repeat' as const),
      tags: [
        `${d.repeat === 'none' ? '' : '↻ '}${describeRepeat(d)}`, period(d),
        ...(d.dueDate ? [`~${formatDateLabel(d.dueDate)}`] : []),
        ...(d.parts.length ? [`파트 ${d.parts.length}개`] : []),
      ],
    };
  });
  function period(d: (typeof defs)[number]) {
    return d.repeat === 'none' ? formatDateLabel(d.startDate)
      : `${formatDateLabel(d.startDate)} ~ ${d.endDate ? formatDateLabel(d.endDate) : ''}`;
  }

  return (
    <>
      <section className="panel admin-card">
        <div className="panel-head"><h2>{editing ? '업무 수정' : from ? '요청 승인' : '업무 추가'}</h2></div>
        <FlashToast param="saved" value={sp.saved} messages={{ new: '등록되었습니다', edit: '저장되었습니다', approved: '승인되었습니다' }} />
        <TaskForm key={editing ? `edit-${editing.id}` : from ? `req-${from.id}` : `new-${sp.saved ?? ''}-${defs.length}`} task={editing} fromRequest={fromRequest}
          members={members} today={kstDate(new Date())} />
      </section>
      <section className="panel admin-card" aria-label="업무 승인">
        <div className="panel-head"><h2>업무 승인</h2><span className="spacer" /><span className="muted">대기 {requests.length}개</span></div>
        {requests.length === 0 ? <p className="empty">멤버가 요청한 업무가 없습니다</p> : (
          <ul className="list-card">
            {requests.map((r) => (
              <RequestRow key={r.id} id={r.id} title={r.title} description={r.description} requester={r.requesterName}
                wantedLabel={r.wantedDate ? formatDateLabel(r.wantedDate) : null} selected={r.id === from?.id}
                createdLabel={`${formatDateLabel(kstDate(r.createdAt))} ${formatKstTime(r.createdAt)}`} />
            ))}
          </ul>
        )}
      </section>
      <section className="panel admin-card">
        <div className="panel-head"><h2>등록된 업무</h2><span className="spacer" /><span className="muted">{defs.length}개</span></div>
        <RegisteredTasks items={registered} />
      </section>
    </>
  );
}
