'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveTaskAction } from '@/app/actions/admin';
import { createRequestAction } from '@/app/actions/requests';
import type { ActionResult } from '@/app/actions/result';
import type { TaskDefinition, TaskInput } from '@/lib/tasks';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

export type FromRequest = { id: number; requesterName: string; spec: TaskInput };
type Props = {
  task: TaskDefinition | null;
  members: { id: number; name: string }[];
  today: string;
  /** 관리자: 멤버 요청을 승인할 때 요청 내용으로 미리 채운다 */
  fromRequest?: FromRequest | null;
  /** request: 멤버가 같은 폼으로 업무 추가를 요청한다 */
  mode?: 'admin' | 'request';
  onSent?: (message: string) => void;
};

export function TaskForm({ task, members, today, fromRequest = null, mode = 'admin', onSent }: Props) {
  const req = task ? null : fromRequest;
  const init: TaskInput | null = task ?? req?.spec ?? null;
  const [state, action, pending] = useActionState(async (prev: ActionResult, form: FormData) => {
    const res = await (mode === 'request' ? createRequestAction : saveTaskAction)(prev, form);
    if (res?.ok) onSent?.(res.ok);
    return res;
  }, null);
  const [kind, setKind] = useState<'dated' | 'weekly'>(init?.kind ?? 'dated');
  const [repeatDated, setRepeatDated] = useState(init?.kind === 'dated' ? init.repeat : 'none');
  const [repeatWeekly, setRepeatWeekly] = useState(init?.kind === 'weekly' ? init.repeat : 'none');
  const repeating = kind === 'dated' ? repeatDated !== 'none' : repeatWeekly !== 'none';
  const [parts, setParts] = useState<{ id?: number; title: string; assigneeId: number | null }[]>(init?.parts ?? []);
  const setPart = (i: number, patch: Partial<(typeof parts)[number]>) => setParts(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <form action={action} className="stack" key={task?.id ?? 'new'}>
      <input type="hidden" name="id" value={task?.id ?? ''} />
      <input type="hidden" name="requestId" value={req?.id ?? ''} />
      {req && <p className="msg ok">{req.requesterName} 님의 요청이에요. 내용을 확인하고 저장하면 승인돼요.</p>}
      <label className="field">제목<input name="title" required maxLength={100} defaultValue={init?.title} /></label>
      <label className="field">설명 (선택)<textarea name="description" rows={2} defaultValue={init?.description ?? ''} placeholder="링크를 붙여 넣으면 눌러서 열 수 있어요. 슬랙 링크는 카드로 보여요." /></label>

      <div className="field">업무 종류
        <div className="checks">
          <label><input type="radio" name="kind" value="dated" checked={kind === 'dated'} onChange={() => setKind('dated')} /> 날짜 업무</label>
          <label><input type="radio" name="kind" value="weekly" checked={kind === 'weekly'} onChange={() => setKind('weekly')} /> 주간 업무 (그 주 안에)</label>
        </div>
      </div>

      {kind === 'dated' ? (
        <label className="field">반복
          <select name="repeatDated" value={repeatDated} onChange={(e) => setRepeatDated(e.target.value as typeof repeatDated)}>
            <option value="none">반복 안 함</option>
            <option value="daily">매일</option>
            <option value="weekdays">평일만 (월~금)</option>
            <option value="weekly_days">매주 선택 요일</option>
          </select>
        </label>
      ) : (
        <label className="field">반복
          <select name="repeatWeekly" value={repeatWeekly} onChange={(e) => setRepeatWeekly(e.target.value as typeof repeatWeekly)}>
            <option value="none">반복 안 함</option>
            <option value="weekly">매주</option>
          </select>
        </label>
      )}

      {kind === 'dated' && repeatDated === 'weekly_days' && (
        <div className="field">반복 요일
          <div className="checks">
            {WEEKDAYS.map((d, i) => (
              <label key={d}><input type="checkbox" name="weekdays" value={i} defaultChecked={init?.weekdays.includes(i)} /> {d}</label>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2">
        <label className="field">
          {kind === 'weekly' && repeating ? '시작 주 (그 주의 아무 날짜)' : repeating || kind === 'weekly' ? '시작일' : '날짜'}
          <input type="date" name="startDate" required defaultValue={init?.startDate ?? today} />
        </label>
        {repeating && (
          <label className="field">종료일 (선택)<input type="date" name="endDate" defaultValue={init?.endDate ?? ''} /></label>
        )}
        {kind === 'weekly' && !repeating && (
          <label className="field">마감일 (선택)<input type="date" name="dueDate" defaultValue={init?.dueDate ?? ''} /></label>
        )}
      </div>

      <div className="field">파트 나누기 (선택)
        <p className="help" style={{ fontWeight: 400 }}>파트를 만들면 파트마다 담당자와 체크 원이 따로 생기고, 업무 상태는 파트에서 자동으로 정해집니다.</p>
        <input type="hidden" name="parts" value={JSON.stringify(parts)} />
        {parts.map((p, i) => (
          <div key={p.id ?? `new-${i}`} className="part-edit">
            <input value={p.title} onChange={(e) => setPart(i, { title: e.target.value })} placeholder={`파트 ${i + 1} 이름`}
              aria-label={`파트 ${i + 1} 이름`} maxLength={100} required />
            <select value={p.assigneeId ?? ''} onChange={(e) => setPart(i, { assigneeId: e.target.value ? Number(e.target.value) : null })}
              aria-label={`파트 ${i + 1} 담당자`}>
              <option value="">담당 없음</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button type="button" className="btn small danger" onClick={() => setParts(parts.filter((_, j) => j !== i))}>빼기</button>
          </div>
        ))}
        <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }}
          onClick={() => setParts([...parts, { title: '', assigneeId: null }])}>＋ 파트 추가</button>
      </div>

      <div className="field">담당자 (선택{parts.length ? ' · 파트 담당자는 자동으로 포함' : ''})
        <div className="checks">
          {members.map((m) => {
            // 파트 담당자는 업무 담당자에 자동으로 들어가므로 체크된 채로 잠근다
            const viaPart = parts.some((p) => p.assigneeId === m.id);
            return viaPart ? (
              <label key={m.id} title="파트 담당자라서 자동으로 포함돼요">
                <input type="checkbox" checked disabled readOnly /> {m.name} <span className="muted">(파트)</span>
              </label>
            ) : (
              <label key={m.id}><input type="checkbox" name="assignees" value={m.id} defaultChecked={init?.assigneeIds.includes(m.id)} /> {m.name}</label>
            );
          })}
        </div>
      </div>

      {state?.error && <p className="msg error">{state.error}</p>}
      <div className="row">
        <button className="btn primary" disabled={pending}>{pending ? (mode === 'request' ? '보내는 중…' : '저장 중…') : mode === 'request' ? '요청 보내기' : task ? '수정 저장' : req ? '승인하고 업무 추가' : '업무 추가'}</button>
        {(task || req) && <Link className="btn" href="/admin/tasks">취소</Link>}
      </div>
    </form>
  );
}
