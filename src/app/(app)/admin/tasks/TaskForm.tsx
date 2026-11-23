'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveTaskAction } from '@/app/actions/admin';
import type { TaskDefinition } from '@/lib/tasks';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

type Props = { task: TaskDefinition | null; members: { id: number; name: string }[]; today: string };

export function TaskForm({ task, members, today }: Props) {
  const [state, action, pending] = useActionState(saveTaskAction, null);
  const [kind, setKind] = useState<'dated' | 'weekly'>(task?.kind ?? 'dated');
  const [repeatDated, setRepeatDated] = useState(task?.kind === 'dated' ? task.repeat : 'none');
  const [repeatWeekly, setRepeatWeekly] = useState(task?.kind === 'weekly' ? task.repeat : 'none');
  const repeating = kind === 'dated' ? repeatDated !== 'none' : repeatWeekly !== 'none';
  const [parts, setParts] = useState<{ id?: number; title: string; assigneeId: number | null }[]>(task?.parts ?? []);
  const setPart = (i: number, patch: Partial<(typeof parts)[number]>) => setParts(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <form action={action} className="stack" key={task?.id ?? 'new'}>
      <input type="hidden" name="id" value={task?.id ?? ''} />
      <label className="field">제목<input name="title" required maxLength={100} defaultValue={task?.title} /></label>
      <label className="field">설명 (선택)<textarea name="description" rows={2} defaultValue={task?.description ?? ''} /></label>

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
              <label key={d}><input type="checkbox" name="weekdays" value={i} defaultChecked={task?.weekdays.includes(i)} /> {d}</label>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2">
        <label className="field">
          {kind === 'weekly' && repeating ? '시작 주 (그 주의 아무 날짜)' : repeating || kind === 'weekly' ? '시작일' : '날짜'}
          <input type="date" name="startDate" required defaultValue={task?.startDate ?? today} />
        </label>
        {repeating && (
          <label className="field">종료일 (선택)<input type="date" name="endDate" defaultValue={task?.endDate ?? ''} /></label>
        )}
        {kind === 'weekly' && !repeating && (
          <label className="field">마감일 (선택)<input type="date" name="dueDate" defaultValue={task?.dueDate ?? ''} /></label>
        )}
      </div>

      {kind === 'weekly' && repeating && (
        <label className="field">마감 요일 (선택)
          <select name="dueWeekday" defaultValue={task?.dueWeekday ?? ''}>
            <option value="">마감 없음 (그 주 안에)</option>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}요일까지</option>)}
          </select>
        </label>
      )}

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
          {members.map((m) => (
            <label key={m.id}><input type="checkbox" name="assignees" value={m.id} defaultChecked={task?.assigneeIds.includes(m.id)} /> {m.name}</label>
          ))}
        </div>
      </div>

      {state?.error && <p className="msg error">{state.error}</p>}
      <div className="row">
        <button className="btn primary" disabled={pending}>{pending ? '저장 중…' : task ? '수정 저장' : '업무 추가'}</button>
        {task && <Link className="btn" href="/admin/tasks">취소</Link>}
      </div>
    </form>
  );
}
