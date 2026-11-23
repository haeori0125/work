'use client';

import { useState, useTransition } from 'react';
import { setPartStatusAction } from '@/app/actions/tasks';
import type { PartView } from '@/lib/view';
import { StatusMark } from '@/app/_ui/icons';
import { CheckCircle, NEXT_STATUS } from './CheckCircle';

/** 업무 아래 파트 목록. 파트마다 체크 원이 따로 있다. */
export function PartList({ parts, occurrenceKey, compact = false }: { parts: PartView[]; occurrenceKey: string; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cycle = (p: PartView) => start(async () => {
    const res = await setPartStatusAction(p.id, occurrenceKey, NEXT_STATUS[p.status]);
    setError(res?.error ?? null);
  });
  return (
    <div className={compact ? 'parts compact' : 'parts'}>
      <ul aria-label="파트">
        {parts.map((p) => (
          <li key={p.id} className={`part ${p.status}`}>
            <CheckCircle status={p.status} title={p.title} size="sm" onCycle={() => cycle(p)} disabled={pending} />
            <div>
              <span className="part-title">{p.title}</span>
              {(p.assignee || p.tag) && (
                <span className="tags mini">
                  {p.assignee && <span className="tag line">담당 {p.assignee}</span>}
                  {p.tag && <span className={`tag ${p.status}`}><StatusMark status={p.status} />{p.tag}</span>}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="err">{error}</p>}
    </div>
  );
}
