'use client';

import { useState } from 'react';
import { SegmentRow } from './SegmentRow';

export type SegRow = { key: string; id: number; index: number; clockIn: string; clockOut: string; edited: boolean };
type Props = {
  dateLabel: string; name: string; count: number; missing: boolean; working: boolean; dayTotal: string;
  /** 최근 구간이 먼저 */
  rows: SegRow[];
};

/** 한 사람의 하루. 구간이 여러 개면 최근 구간만 보이고, 눌러서 나머지를 펼친다 */
export function DayRows({ rows, ...d }: Props) {
  const [open, setOpen] = useState(false);
  const many = rows.length > 1;
  return rows.map((s, row) => (row === 0 || open) && (
    <SegmentRow
      key={s.key}
      id={s.id} dateLabel={d.dateLabel} name={d.name} index={s.index} lead={row === 0} count={d.count}
      clockIn={s.clockIn} clockOut={s.clockOut} missing={d.missing} working={d.working} edited={s.edited}
      dayTotal={row === 0 ? d.dayTotal : null}
      sub={row > 0}
      toggle={row === 0 && many ? { open, onToggle: () => setOpen(!open) } : undefined}
    />
  ));
}
