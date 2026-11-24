'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { reorderPartsAction, setPartStatusAction } from '@/app/actions/tasks';
import { Person } from '@/app/_ui/AvatarContext';
import { StatusMark } from '@/app/_ui/icons';
import type { PartView } from '@/lib/view';
import { CheckCircle, NEXT_STATUS } from './CheckCircle';

type Drag = { id: number; from: number; to: number; startY: number; dy: number; tops: number[]; heights: number[] };
const HOLD_MS = 350;

/**
 * 업무 아래 파트 목록. 파트마다 체크 원이 따로 있다.
 * 줄을 꾹 누른 채 끌면(PC는 오른쪽 손잡이를 바로 끌어도 됨) 순서가 바뀌고 저장된다.
 */
export function PartList({ parts, taskId, occurrenceKey }: { parts: PartView[]; taskId: number; occurrenceKey: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState(() => parts.map((p) => p.id));
  const [drag, setDrag] = useState<Drag | null>(null);
  const press = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const rows = useRef(new Map<number, HTMLLIElement>());
  useEffect(() => { dragRef.current = drag; }, [drag]);

  // 서버에서 파트가 바뀌면(추가·삭제·다른 사람이 순서 변경) 따라간다
  const key = parts.map((p) => p.id).join(',');
  const [seen, setSeen] = useState(key);
  if (key !== seen && !drag) { setSeen(key); setOrder(parts.map((p) => p.id)); }
  const byId = new Map(parts.map((p) => [p.id, p]));
  const list = order.map((id) => byId.get(id)).filter((p): p is PartView => !!p);

  // 손가락으로 끌 때는 터치 이벤트로 따라간다(브라우저가 포인터를 취소해도 터치는 계속 온다).
  // 끄는 동안에는 화면이 같이 스크롤되지 않게 막는다.
  const viaTouch = useRef(false);
  const handlers = useRef<{ move: (y: number) => void; finish: () => void } | null>(null);
  useEffect(() => {
    const move = (e: TouchEvent) => {
      if (!dragRef.current || !viaTouch.current) return;
      if (e.cancelable) e.preventDefault();
      handlers.current?.move(e.touches[0].clientY);
    };
    const end = () => { if (dragRef.current && viaTouch.current) handlers.current?.finish(); };
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);
    return () => {
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', end);
    };
  }, []);

  const cycle = (p: PartView) => start(async () => {
    const res = await setPartStatusAction(p.id, occurrenceKey, NEXT_STATUS[p.status]);
    setError(res?.error ?? null);
  });

  const begin = (id: number, el: HTMLLIElement, pointerId: number, y: number, touch: boolean) => {
    viaTouch.current = touch;
    const ids = list.map((p) => p.id);
    const rects = ids.map((i) => rows.current.get(i)!.getBoundingClientRect());
    const from = ids.indexOf(id);
    if (!touch) { try { el.setPointerCapture(pointerId); } catch { /* 이미 뗀 경우 */ } }
    navigator.vibrate?.(10);
    const d = { id, from, to: from, startY: y, dy: 0, tops: rects.map((r) => r.top), heights: rects.map((r) => r.height) };
    dragRef.current = d;
    setDrag(d);
  };
  const cancelPress = () => { if (press.current) { clearTimeout(press.current.t); press.current = null; } };

  const onDown = (e: React.PointerEvent<HTMLLIElement>, id: number) => {
    if (e.button !== 0 || list.length < 2 || (e.target as HTMLElement).closest('button')) return;
    const el = e.currentTarget, pid = e.pointerId, y = e.clientY;
    if (e.pointerType === 'mouse' && (e.target as HTMLElement).closest('.part-grip')) { e.preventDefault(); begin(id, el, pid, y, false); return; }
    cancelPress();
    const touch = e.pointerType === 'touch';
    press.current = { x: e.clientX, y, t: setTimeout(() => { press.current = null; begin(id, el, pid, y, touch); }, HOLD_MS) };
  };
  const moveTo = (y: number) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = y - d.startY;
    const center = d.tops[d.from] + d.heights[d.from] / 2 + dy;
    let to = 0;
    d.tops.forEach((top, i) => { if (i !== d.from && top + d.heights[i] / 2 < center) to += 1; });
    const next = { ...d, dy, to };
    dragRef.current = next;
    setDrag(next);
  };
  const onMove = (e: React.PointerEvent) => {
    if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) cancelPress();
    if (!viaTouch.current) moveTo(e.clientY);
  };
  const finish = () => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setDrag(null);
    if (d.to === d.from) return;
    const prev = list.map((p) => p.id);
    const next = [...prev];
    next.splice(d.to, 0, next.splice(d.from, 1)[0]);
    setOrder(next);
    start(async () => {
      const res = await reorderPartsAction(taskId, next);
      if (res?.error) { setOrder(prev); setError(res.error); } else setError(null);
    });
  };
  const onUp = () => {
    cancelPress();
    if (!viaTouch.current) finish(); // 손가락으로 끄는 중이면 touchend에서 끝낸다
  };
  useEffect(() => { handlers.current = { move: moveTo, finish }; });

  // 끄는 줄은 손가락을 따라가고, 사이에 있는 줄은 한 칸씩 비켜 준다
  const shift = (i: number) => {
    if (!drag) return 0;
    if (i === drag.from) return drag.dy;
    const h = drag.heights[drag.from];
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -h;
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return h;
    return 0;
  };

  return (
    <div className={`parts${drag ? ' sorting' : ''}`}>
      <ul aria-label="파트">
        {list.map((p, i) => (
          <li key={p.id} ref={(el) => { if (el) rows.current.set(p.id, el); else rows.current.delete(p.id); }}
            className={`part ${p.status}${drag?.id === p.id ? ' lifted' : ''}`}
            style={drag ? { transform: `translateY(${shift(i)}px)` } : undefined}
            onPointerDown={(e) => onDown(e, p.id)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            onContextMenu={(e) => { if (press.current || drag) e.preventDefault(); }}>
            <CheckCircle status={p.status} title={p.title} size="sm" onCycle={() => cycle(p)} disabled={pending} />
            <div className="part-main">
              <span className="part-title">{p.title}</span>
              {(p.assignee || p.by) && (
                <span className="part-meta">
                  {p.assignee ? <Person name={p.assignee} size={16} /> : <span className="muted">담당 없음</span>}
                  {p.status !== 'todo' && p.by && (
                    <span className={`part-st ${p.status}`}><StatusMark status={p.status} />{p.by === p.assignee ? '' : `${p.by} `}{p.at}</span>
                  )}
                </span>
              )}
            </div>
            {list.length > 1 && (
              <span className="part-grip" aria-hidden title="꾹 눌러서 끌면 순서가 바뀌어요">
                <svg width="10" height="14" viewBox="0 0 10 14"><g fill="currentColor">
                  <circle cx="3" cy="3" r="1.3" /><circle cx="7" cy="3" r="1.3" /><circle cx="3" cy="7" r="1.3" />
                  <circle cx="7" cy="7" r="1.3" /><circle cx="3" cy="11" r="1.3" /><circle cx="7" cy="11" r="1.3" />
                </g></svg>
              </span>
            )}
          </li>
        ))}
      </ul>
      {list.length > 1 && <p className="parts-hint">꾹 눌러서 끌면 순서를 바꿀 수 있어요</p>}
      {error && <p className="err">{error}</p>}
    </div>
  );
}
