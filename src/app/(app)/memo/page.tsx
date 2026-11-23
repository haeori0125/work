import { getDb } from '@/db';
import { listNotes } from '@/lib/notes';
import { requireUser } from '@/server/session';
import { NotesApp } from './NotesApp';

export default async function MemoPage() {
  const user = await requireUser();
  const notes = await listNotes(await getDb(), user.id);
  return <NotesApp initial={notes.map((n) => ({ id: n.id, body: n.body, pinned: n.pinned, updatedAt: n.updatedAt.toISOString() }))} />;
}
