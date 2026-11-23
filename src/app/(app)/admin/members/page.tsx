import { getDb } from '@/db';
import { listMembers } from '@/lib/members';
import { requireAdmin } from '@/server/session';
import { MemberRow } from './MemberRow';

export default async function AdminMembersPage() {
  const me = await requireAdmin();
  const members = await listMembers(await getDb());
  const pending = members.filter((m) => m.status === 'pending');
  const others = members.filter((m) => m.status !== 'pending');
  return (
    <>
      <section className="panel admin-card">
        <div className="panel-head"><h2>가입 신청</h2><span className="spacer" /><span className="muted">{pending.length}건</span></div>
        {pending.length === 0 ? <p className="empty">대기 중인 신청이 없습니다</p> : (
          <ul className="list-card">{pending.map((m) => <MemberRow key={m.id} m={m} isMe={false} />)}</ul>
        )}
      </section>
      <section className="panel admin-card">
        <div className="panel-head"><h2>멤버 관리</h2><span className="spacer" /><span className="muted">{others.length}명</span></div>
        <ul className="list-card">{others.map((m) => <MemberRow key={m.id} m={m} isMe={m.id === me.id} />)}</ul>
      </section>
    </>
  );
}
