'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteLectureAction, saveLectureAction } from '@/app/actions/onsite';
import { MiniAvatar, Person } from '@/app/_ui/AvatarContext';
import { DateField } from '@/app/_ui/DateField';
import { PlusIcon } from '@/app/_ui/icons';
import { useToast } from '@/app/_ui/Toast';
import { SLOTS, SLOT_INFO, WEEKDAYS, type Lecture, type Slot } from '@/lib/onsite-shared';

type Row = Lecture & { range: string };
type Props = {
  month: string; monthTitle: string; prevMonth: string; nextMonth: string; isThisMonth: boolean;
  defaultStart: string; defaultEnd: string; members: { id: number; name: string }[]; lectures: Row[];
};

/** 관리자: 달마다 열리는 현장 강의를 보고, 강의(지점명·요일·시간대·기간·담당)를 등록·수정·삭제 */
export function LectureAdmin(p: Props) {
  const [editing, setEditing] = useState<number | 'new' | null>(p.lectures.length ? null : 'new');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const remove = (l: Row) => {
    if (!confirm(`'${l.title} ${WEEKDAYS[l.weekday]} ${SLOT_INFO[l.slot].label}' 강의를 지울까요? 이 강의의 변동 기록도 함께 지워져요.`)) return;
    start(async () => {
      const res = await deleteLectureAction(l.id);
      setError(res?.error ?? null);
      if (!res?.error) toast('삭제되었습니다');
    });
  };

  return (
    <div className="os-body">
      <div className="os-bar">
        <div className="nav-group">
          <div className="week-nav">
            <Link className="arrow" href={`/admin/onsite?month=${p.prevMonth}`} scroll={false} aria-label="지난달">‹</Link>
            <span className="sub">{p.monthTitle}</span>
            <Link className="arrow" href={`/admin/onsite?month=${p.nextMonth}`} scroll={false} aria-label="다음 달">›</Link>
          </div>
          {!p.isThisMonth && <Link className="btn small soft" href="/admin/onsite" scroll={false}>이번 달</Link>}
        </div>
        <button type="button" className="btn small primary" onClick={() => setEditing(editing === 'new' ? null : 'new')}>
          <PlusIcon size={10} />강의 등록
        </button>
      </div>
      <div className="os-guide">
        <p>강의마다 지점명·요일·시간대·기간을 정하면, 그 기간 동안 매주 그 요일 달력에 들어가요. 이 달에 열리는 강의만 보여요.</p>
        <p><b>담당이 바뀔 때도 새 강의로 등록하세요.</b> 기존 강의는 바뀌기 전날까지로 종료일을 줄이고, 바뀌는 날부터 새 담당으로 강의를 하나 더 등록하면 지난 기록이 그대로 남아요.</p>
        <p className="muted">하루만 빠지거나 대신 나가는 건 강의를 고치지 말고, 현장 수업 달력에서 그날을 눌러 <b>변동 입력</b>으로 남겨 주세요.</p>
      </div>

      {editing === 'new' && (
        <LectureForm members={p.members} start={p.defaultStart} end={p.defaultEnd} onDone={() => setEditing(null)} />
      )}

      {p.lectures.length === 0 ? <p className="empty">이 달에 열리는 강의가 없어요</p> : (
        <ul className="os-lectures">
          {p.lectures.map((l) => (
            <li key={l.id}>
              {editing === l.id ? (
                <LectureForm lecture={l} members={p.members} start={l.startDate} end={l.endDate} onDone={() => setEditing(null)} />
              ) : (
                <div className="os-lec">
                  <div className="os-lec-main">
                    <b className="os-lec-title">{l.title}</b>
                    <span className="os-lec-when">{WEEKDAYS[l.weekday]}요일 {SLOT_INFO[l.slot].label} {SLOT_INFO[l.slot].time}</span>
                    <span className="muted os-lec-range">{l.range}</span>
                  </div>
                  <div className="os-lec-staff" aria-label={`담당 ${l.staff.map((x) => x.name).join(', ') || '없음'}`}>
                    {l.staff.length ? l.staff.map((x) => <Person key={x.id} name={x.name} size={18} />) : <span className="muted">담당 미배정</span>}
                  </div>
                  <div className="row">
                    <button type="button" className="btn small" onClick={() => setEditing(l.id)}>수정</button>
                    <button type="button" className="btn small danger" disabled={pending} onClick={() => remove(l)}>삭제</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="msg error">{error}</p>}
    </div>
  );
}

function LectureForm({ lecture, members, start, end, onDone }: {
  lecture?: Lecture; members: { id: number; name: string }[]; start: string; end: string; onDone: () => void;
}) {
  const [weekday, setWeekday] = useState(lecture?.weekday ?? 0);
  const [slot, setSlot] = useState<Slot>(lecture?.slot ?? 'eve');
  const [staff, setStaff] = useState<number[]>(lecture?.staff.map((x) => x.id) ?? []);
  const [pending, run] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  return (
    <form className="os-lec-form" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const input = {
        title: String(f.get('title') ?? ''), weekday, slot, startDate: String(f.get('startDate') ?? ''), endDate: String(f.get('endDate') ?? ''), staffIds: staff,
      };
      run(async () => {
        const res = await saveLectureAction(lecture?.id ?? null, input);
        setError(res?.error ?? null);
        if (!res?.error) { toast(lecture ? '저장되었습니다' : '등록되었습니다'); onDone(); }
      });
    }}>
      <label className="field">지점명<input name="title" required maxLength={30} defaultValue={lecture?.title} placeholder="예: 러셀 강남" /></label>
      <div className="field">요일
        <div className="pick days">
          {WEEKDAYS.map((w, i) => (
            <label key={w}><input type="radio" className="vh" name="weekday" checked={weekday === i} onChange={() => setWeekday(i)} /><span>{w}</span></label>
          ))}
        </div>
      </div>
      <div className="field">시간대
        <div className="pick">
          {SLOTS.map((s) => (
            <label key={s.key}><input type="radio" className="vh" name="slot" checked={slot === s.key} onChange={() => setSlot(s.key)} /><span>{s.label} {s.time}</span></label>
          ))}
        </div>
      </div>
      <div className="tf-dates">
        <label className="field">시작일<DateField name="startDate" defaultValue={start} /></label>
        <label className="field">종료일<DateField name="endDate" defaultValue={end} /></label>
      </div>
      <div className="field"><span className="fl">담당 <small className="muted">선택 · 여러 명</small></span>
        <div className="pick">
          {members.map((m) => (
            <label key={m.id} className="pick-person">
              <input type="checkbox" className="vh" checked={staff.includes(m.id)}
                onChange={() => setStaff(staff.includes(m.id) ? staff.filter((x) => x !== m.id) : [...staff, m.id])} />
              <span><MiniAvatar name={m.name} size={20} />{m.name}</span>
            </label>
          ))}
        </div>
      </div>
      {error && <p className="msg error">{error}</p>}
      <div className="tf-actions">
        <button type="button" className="btn" onClick={onDone}>취소</button>
        <button className="btn primary" disabled={pending}>{pending ? '저장 중…' : lecture ? '수정 저장' : '강의 등록'}</button>
      </div>
    </form>
  );
}
