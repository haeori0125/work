import { getDb } from '@/db';
import { listActiveMembers } from '@/lib/members';
import { listNotes, listSharedNotes } from '@/lib/notes';
import { requireUser } from '@/server/session';
import { NotesApp } from './NotesApp';

export default async function MemoPage() {
  const user = await requireUser();
  const db = await getDb();
  const [notes, shared, members] = await Promise.all([listNotes(db, user.id), listSharedNotes(db, user.id), listActiveMembers(db)]);
  return (
    <NotesApp
      initial={notes.map((n) => ({ id: n.id, body: n.body, pinned: n.pinned, shared: n.shared, sharedEdit: n.sharedEdit, sharedTo: n.sharedTo, version: n.version, updatedAt: n.updatedAt.toISOString() }))}
      people={members.filter((m) => m.id !== user.id)}
      others={shared.map((n) => ({ id: n.id, body: n.body, updatedAt: n.updatedAt.toISOString(), authorName: n.authorName, sharedEdit: n.sharedEdit, version: n.version }))}
    />
  );
}
