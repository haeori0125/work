'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MiniAvatar, Person } from '@/app/_ui/AvatarContext';
import { DeleteTaskButton } from './DeleteTaskButton';
import { DragScroll } from './DragScroll';

export type RegisteredItem = {
  id: number; title: string; date: string; tags: string[]; assignees: string[];
  /** 한 번짜리는 지금 상태, 반복 업무는 'repeat' */
  status: 'todo' | 'doing' | 'done' | 'repeat';
};

const FILTERS = [['all', '전체'], ['todo', '미완료'], ['doing', '진행 중'], ['done', '완료'], ['repeat', '반복']] as const;
const SORTS = [['date', '날짜순'], ['open', '미완료 먼저'], ['recent', '최근 등록순']] as const;
type Filter = (typeof FILTERS)[number][0];
type Sort = (typeof SORTS)[number][0];
const STATUS_TEXT = { todo: '미완료', doing: '진행 중', done: '완료' } as const;
const OPEN_ORDER = { todo: 0, doing: 1, repeat: 2, done: 3 } as const;
const KEY = 'tt_admin_tasks_view';

/** 관리자 '등록된 업무': 상태로 거르고 정렬해서 본다(고른 보기는 이 기기에 기억) */
export function RegisteredTasks({ items }: { items: RegisteredItem[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('date');
  // 이 기기에 기억한 보기는 화면이 뜬 뒤에 읽는다(서버 화면과 어긋나지 않게)
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v && FILTERS.some(([k]) => k === v.filter)) setFilter(v.filter);
      if (v && SORTS.some(([k]) => k === v.sort)) setSort(v.sort);
    } catch { /* 기억 못 해도 기본 보기 */ }
  }, []);
  const remember = (f: Filter, s: Sort) => { try { localStorage.setItem(KEY, JSON.stringify({ filter: f, sort: s })); } catch { /* 무시 */ } };

  const count = (f: Filter) => (f === 'all' ? items.length : items.filter((i) => i.status === f).length);
  const shown = items.filter((i) => filter === 'all' || i.status === filter).sort((x, y) => {
    if (sort === 'recent') return y.id - x.id;
    if (sort === 'open' && OPEN_ORDER[x.status] !== OPEN_ORDER[y.status]) return OPEN_ORDER[x.status] - OPEN_ORDER[y.status];
    return x.date.localeCompare(y.date) || x.id - y.id;
  });

  return (
    <>
      <div className="rt-bar">
        <div className="rt-chips" role="group" aria-label="상태">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => { setFilter(k); remember(k, sort); }}>
              {label}<span>{count(k)}</span>
            </button>
          ))}
        </div>
        <div className="rt-sort" role="group" aria-label="정렬">
          {SORTS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={sort === k} onClick={() => { setSort(k); remember(filter, k); }}>{label}</button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? <p className="empty">{items.length ? '이 조건에 맞는 업무가 없습니다' : '등록된 업무가 없습니다'}</p> : (
        <DragScroll className="scroll-3">
          <ul className="list-card">
            {shown.map((d) => (
              <li key={d.id} className={`task${d.status === 'done' ? ' is-done' : ''}`}>
                <div className="task-top">
                  {d.status !== 'repeat' && <span className={`check small ${d.status}`} aria-label={STATUS_TEXT[d.status]} role="img" />}
                  <span className="task-title">{d.title}</span>
                  <Link className="btn small" href={`/admin/tasks?edit=${d.id}`}>수정</Link>
                  <DeleteTaskButton id={d.id} title={d.title} />
                </div>
                <div className="tags">
                  {d.tags.map((t) => <span key={t} className="tag line">{t}</span>)}
                  {d.assignees.length > 0 && d.assignees.length <= 2 && (
                    <span className="tag line who-tag">담당 {d.assignees.map((n) => <Person key={n} name={n} size={16} />)}</span>
                  )}
                  {/* 3명 이상이면 사진만 겹쳐서(이름은 눌러 두면 보임) */}
                  {d.assignees.length > 2 && (
                    <span className="tag line who-tag" title={`담당 ${d.assignees.join(', ')}`} aria-label={`담당 ${d.assignees.join(', ')}`}>
                      담당
                      <span className="av-stack">{d.assignees.slice(0, 5).map((n) => <MiniAvatar key={n} name={n} size={16} />)}</span>
                      <span className="muted">{d.assignees.length}명</span>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </DragScroll>
      )}
    </>
  );
}
