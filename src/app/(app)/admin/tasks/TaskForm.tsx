'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveTaskAction } from '@/app/actions/admin';
import { createRequestAction } from '@/app/actions/requests';
import type { ActionResult } from '@/app/actions/result';
import { MiniAvatar } from '@/app/_ui/AvatarContext';
import { DateField } from '@/app/_ui/DateField';
import { PersonSelect } from '@/app/_ui/PersonSelect';
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

  const DATED_REPEATS = [['none', '반복 안 함'], ['daily', '매일'], ['weekdays', '평일만'], ['weekly_days', '요일 선택']] as const;
  const WEEKLY_REPEATS = [['none', '이번 한 번'], ['weekly', '매주']] as const;

  return (
    <form action={action} className="tf" key={task?.id ?? 'new'}>
      <input type="hidden" name="id" value={task?.id ?? ''} />
      <input type="hidden" name="requestId" value={req?.id ?? ''} />
      {req && <p className="msg ok">{req.requesterName} 님의 요청이에요. 내용을 확인하고 저장하면 승인돼요.</p>}
      <div className="tf-grid">
          <section className="tf-sec tf-what" aria-label="무엇을">
            <h3>무엇을</h3>
            <label className="field">제목<input name="title" required maxLength={100} defaultValue={init?.title} placeholder="예: 매장 오픈 준비" /></label>
            <label className="field"><span className="fl">설명 <small>선택</small></span>
              <textarea name="description" rows={3} defaultValue={init?.description ?? ''} placeholder="링크를 붙여 넣으면 눌러서 열 수 있어요. 슬랙 링크는 카드로 보여요." />
            </label>
          </section>

          <section className="tf-sec tf-who" aria-label="누가">
            <h3>누가</h3>
            <div className="field"><span className="fl">담당자 <small>{parts.length ? '선택 · 파트 담당자는 자동 포함' : '선택'}</small></span>
              <div className="pick">
                {members.map((m) => {
                  // 파트 담당자는 업무 담당자에 자동으로 들어가므로 체크된 채로 잠근다
                  const viaPart = parts.some((p) => p.assigneeId === m.id);
                  return (
                    <label key={m.id} className="pick-person" title={viaPart ? '파트 담당자라서 자동으로 포함돼요' : undefined}>
                      {viaPart
                        ? <input type="checkbox" className="vh" checked disabled readOnly />
                        : <input type="checkbox" className="vh" name="assignees" value={m.id} defaultChecked={init?.assigneeIds.includes(m.id)} />}
                      <span><MiniAvatar name={m.name} size={20} />{m.name}{viaPart && <em>파트</em>}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="field"><span className="fl">파트 나누기 <small>선택</small></span>
              <p className="help">파트마다 담당자와 체크 원이 따로 생기고, 업무 상태는 파트에서 자동으로 정해져요.</p>
              <input type="hidden" name="parts" value={JSON.stringify(parts)} />
              {parts.map((p, i) => (
                <div key={p.id ?? `new-${i}`} className="part-edit">
                  <input value={p.title} onChange={(e) => setPart(i, { title: e.target.value })} placeholder={`파트 ${i + 1} 이름`}
                    aria-label={`파트 ${i + 1} 이름`} maxLength={100} required />
                  <PersonSelect value={p.assigneeId} options={members} onChange={(id) => setPart(i, { assigneeId: id })} label={`파트 ${i + 1} 담당자`} />
                  <button type="button" className="part-x" aria-label={`파트 ${i + 1} 빼기`} onClick={() => setParts(parts.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button type="button" className="btn small soft" style={{ alignSelf: 'flex-start' }}
                onClick={() => setParts([...parts, { title: '', assigneeId: null }])}>＋ 파트 추가</button>
            </div>
          </section>

          <section className="tf-sec tf-when" aria-label="언제">
            <h3>언제</h3>
            <div className="field">업무 종류
              <div className="kind-pick">
                <label>
                  <input type="radio" className="vh" name="kind" value="dated" checked={kind === 'dated'} onChange={() => setKind('dated')} />
                  <span><b>날짜 업무</b> <small>(정해진 날에)</small></span>
                </label>
                <label>
                  <input type="radio" className="vh" name="kind" value="weekly" checked={kind === 'weekly'} onChange={() => setKind('weekly')} />
                  <span><b>기간 업무</b> <small>(기간 안에)</small></span>
                </label>
              </div>
            </div>

            <div className="field" role="radiogroup" aria-label="반복">반복
              <div className="pick">
                {(kind === 'dated' ? DATED_REPEATS : WEEKLY_REPEATS).map(([v, label]) => {
                  const cur = kind === 'dated' ? repeatDated : repeatWeekly;
                  return (
                    <label key={v}>
                      <input type="radio" className="vh" name={kind === 'dated' ? 'repeatDated' : 'repeatWeekly'} value={v} checked={cur === v}
                        onChange={() => (kind === 'dated' ? setRepeatDated(v as typeof repeatDated) : setRepeatWeekly(v as typeof repeatWeekly))} />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {kind === 'dated' && repeatDated === 'weekly_days' && (
              <div className="field">반복 요일
                <div className="pick days">
                  {WEEKDAYS.map((d, i) => (
                    <label key={d}><input type="checkbox" className="vh" name="weekdays" value={i} defaultChecked={init?.weekdays.includes(i)} /><span>{d}</span></label>
                  ))}
                </div>
              </div>
            )}

            <div className="tf-dates">
              <label className="field">
                {kind === 'weekly' && repeating ? '시작 주' : repeating || kind === 'weekly' ? '시작일' : '날짜'}
                <DateField name="startDate" defaultValue={init?.startDate ?? today} />
              </label>
              {repeating && (
                <label className="field"><span className="fl">종료일 <small>선택</small></span><DateField name="endDate" defaultValue={init?.endDate} optional placeholder="없음" /></label>
              )}
              {kind === 'weekly' && !repeating && (
                <label className="field"><span className="fl">마감일 <small>선택</small></span><DateField name="dueDate" defaultValue={init?.dueDate} optional placeholder="없음" /></label>
              )}
            </div>
            {kind === 'weekly' && repeating && <p className="help">시작 주에는 그 주의 아무 날짜나 고르면 돼요.</p>}
          </section>
      </div>

      {state?.error && <p className="msg error">{state.error}</p>}
      <div className="tf-actions">
        {(task || req) && <Link className="btn" href="/admin/tasks">취소</Link>}
        <button className="btn primary" disabled={pending}>{pending ? (mode === 'request' ? '보내는 중…' : '저장 중…') : mode === 'request' ? '요청 보내기' : task ? '수정 저장' : req ? '승인하고 업무 추가' : '업무 추가'}</button>
      </div>
    </form>
  );
}
