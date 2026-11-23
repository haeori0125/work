import { getDb } from '@/db';
import { listNotes, noteTitle } from '@/lib/notes';
import { requireUser } from '@/server/session';

export default async function MemoPage() {
  const user = await requireUser();
  const notes = await listNotes(await getDb(), user.id);
  return (
    <section className="panel">
      <div className="panel-head"><h2>개인 메모</h2></div>
      <ul className="list-card panel-body">
        {notes.map((n) => <li key={n.id}><b>{noteTitle(n.body)}</b><span style={{ whiteSpace: 'pre-wrap' }}>{n.body}</span></li>)}
      </ul>
    </section>
  );
}
