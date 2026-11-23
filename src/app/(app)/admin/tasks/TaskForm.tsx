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
          {kind === 'weekly' ? '시작 주 (그 주의 아무 날짜)' : repeating ? '시작일' : '날짜'}
          <input type="date" name="startDate" required defaultValue={task?.startDate ?? today} />
        </label>
        {repeating && (
          <label className="field">종료일 (선택)<input type="date" name="endDate" defaultValue={task?.endDate ?? ''} /></label>
        )}
      </div>

      <div className="field">담당자 (선택)
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
