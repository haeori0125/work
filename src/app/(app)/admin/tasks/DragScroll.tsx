'use client';

import { useRef } from 'react';

/** 높이가 정해진 목록 상자. 휠·터치 스크롤에 더해 마우스로 끌어서도 넘겨 볼 수 있다 */
export function DragScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null);
  return (
    <div ref={ref} className={`drag-scroll${className ? ` ${className}` : ''}`}
      onPointerDown={(e) => {
        // 버튼·링크를 누를 때는 끌기로 보지 않는다
        if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as HTMLElement).closest('a, button, input, select, textarea')) return;
        drag.current = { y: e.clientY, top: ref.current!.scrollTop, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dy = e.clientY - d.y;
        if (!d.moved && Math.abs(dy) > 4) { d.moved = true; ref.current!.setPointerCapture(e.pointerId); ref.current!.classList.add('dragging'); }
        if (d.moved) ref.current!.scrollTop = d.top - dy;
      }}
      onPointerUp={() => { drag.current = null; ref.current?.classList.remove('dragging'); }}
      onPointerCancel={() => { drag.current = null; ref.current?.classList.remove('dragging'); }}>
      {children}
    </div>
  );
}
