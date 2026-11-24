'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  copyBaseAction, createPeriodAction, deletePeriodAction, setBaseCellAction, setBaseTitleAction, updatePeriodAction,
} from '@/app/actions/onsite';
import type { ActionResult } from '@/app/actions/result';
import { Person } from '@/app/_ui/AvatarContext';
import { DateField } from '@/app/_ui/DateField';
import { PlusIcon } from '@/app/_ui/icons';
import { useToast } from '@/app/_ui/Toast';
import { SLOTS, type BaseTitles, type BaseWeek, type Period, type Slot } from '@/lib/onsite-shared';

type PeriodRow = Period & { range: string; current: boolean };
type Props = {
  today: string; members: { id: number; name: string }[];
  periods: PeriodRow[]; picked: Period | null; base: BaseWeek | null; titles: BaseTitles | null;
};

const SLOT = Object.fromEntries(SLOTS.map((s) => [s.key, s])) as Record<Slot, (typeof SLOTS)[number]>;
const WD_MON = ['월', '화', '수', '목', '금', '토', '일'];

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const run = (fn: () => Promise<ActionResult>, ok?: string, after?: (res: ActionResult) => void) => start(async () => {
    const res = await fn();
    setError(res?.error ?? null);
    if (!res?.error) { if (ok) toast(ok); after?.(res); }
  });
  return { pending, error, run };
}

/** 관리자: 기간(이름·시작일·종료일)을 만들고, 기간마다 요일 × 오후/저녁 칸에 지점명과 출근할 사람을 정한다 */
export function BaseSchedule({ today, members, periods, picked, base, titles }: Props) {
  const router = useRouter();
  const { pending, error, run } = useRun();
  const [form, setForm] = useState<'new' | 'edit' | null>(periods.length ? null : 'new');
  const [cell, setCell] = useState<{ wd: number; slot: Slot } | null>(null);
  const [copying, setCopying] = useState(false);
  const people = cell && base ? base[cell.wd][cell.slot] : [];
  const others = periods.filter((p) => p.id !== picked?.id);

  const savePeriod = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = { name: String(f.get('name') ?? ''), startDate: String(f.get('startDate') ?? ''), endDate: String(f.get('endDate') ?? '') };
    if (form === 'edit' && picked) run(() => updatePeriodAction(picked.id, input), '기간을 저장했습니다', () => setForm(null));
    else run(() => createPeriodAction(input), '기간을 만들었습니다', (res) => { setForm(null); router.push(`/admin/onsite?period=${res?.ok}`, { scroll: false }); });
  };
  const toggle = (id: number) => {
    if (!cell || !picked) return;
    const ids = people.some((x) => x.id === id) ? people.filter((x) => x.id !== id).map((x) => x.id) : [...people.map((x) => x.id), id];
    run(() => setBaseCellAction(picked.id, cell.wd, cell.slot, ids));
  };

  return (
    <div className="os-body">
      <div className="os-periods" role="group" aria-label="기간">
        {periods.map((p) => (
          <Link key={p.id} href={`/admin/onsite?period=${p.id}`} scroll={false} className="os-period" aria-current={p.id === picked?.id ? 'true' : undefined}>
            <b>{p.name}</b><span>{p.range}</span>{p.current && <em>지금</em>}
          </Link>
        ))}
        <button type="button" className="os-period add" onClick={() => setForm(form === 'new' ? null : 'new')}><PlusIcon size={10} /> 새 기간</button>
      </div>

      {form && (
        <form key={form + (picked?.id ?? '')} className="os-period-form" onSubmit={savePeriod}>
          <label className="field">기간 이름<input name="name" required maxLength={40} defaultValue={form === 'edit' ? picked?.name : ''} placeholder="예: 1–2월 고3N수 현장강의" /></label>
          <label className="field">시작일<DateField name="startDate" defaultValue={form === 'edit' ? picked?.startDate : today} /></label>
          <label className="field">종료일<DateField name="endDate" defaultValue={form === 'edit' ? picked?.endDate : today} /></label>
          <div className="row">
            <button type="button" className="btn" onClick={() => setForm(null)}>취소</button>
            <button className="btn primary" disabled={pending}>{form === 'edit' ? '저장' : '기간 만들기'}</button>
          </div>
        </form>
      )}

      {!picked ? <p className="empty">기간을 먼저 만들어 주세요. 예: 1–2월, 3–6월처럼 스케줄이 바뀌는 기간마다 하나씩</p> : (
        <>
          <div className="os-bar">
            <div className="os-picked"><b>{picked.name}</b> <span className="muted">{periods.find((p) => p.id === picked.id)?.range}</span></div>
            <div className="row">
              <button type="button" className="btn small" onClick={() => setForm(form === 'edit' ? null : 'edit')}>기간 수정</button>
              {others.length > 0 && <button type="button" className="btn small" onClick={() => setCopying(!copying)}>다른 기간에서 복사</button>}
              <button type="button" className="btn small danger" disabled={pending}
                onClick={() => { if (confirm(`'${picked.name}' 기간과 그 기본 스케줄을 지울까요?`)) run(() => deletePeriodAction(picked.id), '기간을 지웠습니다', () => router.push('/admin/onsite', { scroll: false })); }}>
                기간 삭제
              </button>
            </div>
          </div>
          {copying && (
            <div className="os-copy">
              <span className="muted">어느 기간 것을 가져올까요? 이 기간의 지점명·사람은 바뀌어요.</span>
              <div className="row">
                {others.map((o) => (
                  <button key={o.id} type="button" className="btn small" disabled={pending}
                    onClick={() => { if (confirm(`'${o.name}' 스케줄을 '${picked.name}'로 복사할까요?`)) run(() => copyBaseAction(o.id, picked.id), '복사했습니다', () => setCopying(false)); }}>
                    {o.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="help">이 기간 동안 매주 반복돼요. 칸을 누르면 지점명과 출근할 사람을 정할 수 있어요. 멤버는 현장 수업 달력에서 결과만 봐요.</p>
          <div className="os-base-wrap">
            <table className="os-base">
              <thead><tr><th />{WD_MON.map((w, i) => <th key={w} className={i === 6 ? 'sun' : i === 5 ? 'sat' : undefined}>{w}</th>)}</tr></thead>
              <tbody>
                {SLOTS.map((s) => (
                  <tr key={s.key}>
                    <th><span className={`os-slotname ${s.key}`}>{s.label}</span><small>{s.time}</small></th>
                    {WD_MON.map((w, wd) => {
                      const list = base![wd][s.key];
                      const title = titles![wd][s.key];
                      const on = cell?.wd === wd && cell.slot === s.key;
                      return (
                        <td key={w} className={on ? 'on' : undefined}>
                          <button type="button" className="os-base-cell" onClick={() => setCell(on ? null : { wd, slot: s.key })} aria-pressed={on}
                            aria-label={`${w}요일 ${s.label} ${title ?? ''} ${list.map((x) => x.name).join(', ') || '없음'}`}>
                            {title && <b className="os-title">{title}</b>}
                            {list.length ? list.map((x) => <Person key={x.id} name={x.name} size={18} />) : <span className="muted">{title ? '미배정' : '—'}</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cell && (
            <div className="os-cell-edit">
              <b>{WD_MON[cell.wd]}요일 {SLOT[cell.slot].label}</b> <span className="muted">{SLOT[cell.slot].time} · 사람은 누를 때마다 바로 저장돼요</span>
              <form key={`${cell.wd}-${cell.slot}`} className="os-title-form" onSubmit={(e) => {
                e.preventDefault();
                const v = String(new FormData(e.currentTarget).get('title') ?? '');
                run(() => setBaseTitleAction(picked.id, cell.wd, cell.slot, v), '지점명을 저장했습니다');
              }}>
                <input name="title" defaultValue={titles![cell.wd][cell.slot] ?? ''} maxLength={30} placeholder={`지점명 (예: 러셀 강남, 비우면 '${SLOT[cell.slot].label}')`} aria-label="지점명" />
                <button className="btn small primary" disabled={pending}>지점명 저장</button>
              </form>
              <div className="os-pick">
                {members.map((m) => {
                  const sel = people.some((x) => x.id === m.id);
                  return (
                    <button key={m.id} type="button" className={`os-chip ${sel ? 'base' : 'none'}`} aria-pressed={sel} disabled={pending} onClick={() => toggle(m.id)}>
                      <Person name={m.name} size={18} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      {error && <p className="msg error">{error}</p>}
    </div>
  );
}
