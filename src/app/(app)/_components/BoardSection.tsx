'use client';

import { addBoardPostAction, deleteBoardPostAction, editBoardPostAction } from '@/app/actions/memos';
import type { NoteView } from '@/lib/view';
import { NoteList } from './NoteList';

export function BoardSection({ posts, me }: { posts: NoteView[]; me: { id: number; role: 'member' | 'admin' } }) {
  return (
    <section className="section" aria-label="오늘의 공용 메모">
      <div className="section-head"><h2>오늘의 공용 메모</h2><span className="muted section-sub">모두가 함께 보는 메모</span></div>
      <NoteList notes={posts} me={me} placeholder="인수인계, 공지 등을 남겨 주세요"
        onAdd={addBoardPostAction} onEdit={editBoardPostAction} onDelete={deleteBoardPostAction} />
    </section>
  );
}
