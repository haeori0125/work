'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Person } from '@/app/_ui/AvatarContext';
import { FilterIcon } from '@/app/_ui/icons';

/** 출퇴근 기록 멤버 필터(위클리 담당 필터와 같은 모양). 고른 이름은 주소(?who=)에 실린다 */
export function MemberFilter({ members, selected }: { members: string[]; selected: string[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  const go = (names: string[]) => {
    const q = new URLSearchParams(sp);
    if (names.length) q.set('who', names.join(',')); else q.delete('who');
    router.replace(q.size ? `${path}?${q}` : path, { scroll: false });
  };
  const toggle = (n: string) => go(selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n]);
  const count = selected.length;

  return (
    <div className="wf" ref={box}>
      <button type="button" className={`wf-btn${count ? ' on' : ''}`} aria-expanded={open} aria-label={count ? `멤버 필터 ${count}명` : '멤버 필터'}
        title="멤버 필터" onClick={() => setOpen(!open)}>
        <FilterIcon />{count > 0 && <span className="wf-count">{count}</span>}
      </button>
      {open && (
        <div className="wf-pop" role="dialog" aria-label="멤버 필터">
          <div className="wf-head"><b>멤버 필터</b><span className="muted">고른 사람의 기록만 보여요</span></div>
          <div className="wf-opts">
            <button type="button" className="wf-opt" aria-pressed={count === 0} onClick={() => go([])}>전체</button>
            {members.map((n) => (
              <button key={n} type="button" className="wf-opt" aria-pressed={selected.includes(n)} onClick={() => toggle(n)}>
                <Person name={n} size={18} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
