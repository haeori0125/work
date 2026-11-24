import { getDb } from '@/db';
import { listNotes, listSharedNotes } from '@/lib/notes';
import { requireUser } from '@/server/session';
import { NotesApp } from './NotesApp';

export default async function MemoPage() {
  const user = await requireUser();
  const db = await getDb();
  const [notes, shared] = await Promise.all([listNotes(db, user.id), listSharedNotes(db, user.id)]);
  return (
    <NotesApp
      initial={notes.map((n) => ({ id: n.id, body: n.body, pinned: n.pinned, shared: n.shared, updatedAt: n.updatedAt.toISOString() }))}
      others={shared.map((n) => ({ id: n.id, body: n.body, updatedAt: n.updatedAt.toISOString(), authorName: n.authorName }))}
    />
  );
}
