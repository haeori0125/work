# 팀 투두 화면 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 시안대로 화면을 개편하고, 사용자별 설정·여러 장 개인 메모·하루 여러 구간 출퇴근(퇴근 시 자동 로그아웃)을 실제 데이터와 연결한다.

**Architecture:** 기존 Next.js 앱 위에서 진행. 규칙은 `src/lib/*.ts`(첫 인자 `db`)에 두고 vitest + PGlite로 테스트, 화면은 서버 컴포넌트 + 서버 액션. DB 변경은 drizzle 마이그레이션 3단계(새 테이블 추가 → 데이터 옮기기 SQL → 옛 테이블 삭제)로 기존 데이터 보존. 색은 시안과 같은 CSS 변수 공식.

**Tech Stack:** Next.js 16.4.6, drizzle-orm 0.45.4 / drizzle-kit 0.31.11, PGlite(테스트), Pretendard 1.3.9(동적 서브셋 woff2를 `public/fonts/pretendard/`에 포함), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-ui-redesign-design.md` (이전 기능 설계: `2026-11-23-team-todo-design.md`)
**시안(색·간격·문구의 기준):** 저장소 밖 시안 소스 `/tmp/claude-0/-home-user-work/f5f3eb70-88dd-5edf-9914-3c4e210516e1/scratchpad/mockup/v6.src.html` — CSS 토큰, 체크 원, 색상환, 기록 막대 스타일은 여기서 가져온다.

## Global Constraints

- 시간대 Asia/Seoul, 날짜 문자열 `YYYY-MM-DD`.
- 화면 문구: 상태 "미완료 / 진행 중 / 완료", 탭 "홈 · 내 기록 · 개인 메모 · 설정 · 관리", 버튼 "퇴근하기"(빨강 `#e5383b` 고정).
- 전체 글꼴 Pretendard, `word-break: keep-all; overflow-wrap: break-word`.
- 모든 색은 CSS 변수에서 계산, 라이트/다크 모두.
- 360px 폭에서 가로 스크롤 없음.
- 기존 데이터(출퇴근, 개인 메모)는 마이그레이션에서 보존.
- 기본 브랜치에 태스크마다 커밋·푸시.

## Review Focus

1. **열린 구간이 있는 상태의 재로그인** — 같은 날 퇴근 안 한 구간이 있으면 새 구간을 만들지 않는다. → Task 2 테스트.
2. **자정을 넘긴 열린 구간** — 어제 열린 구간이 있어도 오늘 로그인은 새 구간을 만들고, 어제는 "퇴근 미기록". → Task 2 테스트.
3. **색상 코드 입력 형식** — `#a3b1f0`, `A3B1F0` 허용, `A3B1F`, `GGGGGG`, 빈 값은 거절. 밝기 범위 밖 값 거절. → Task 3 테스트.
4. **남의 메모 접근** — 다른 사용자의 메모 id로 수정·삭제하면 not_found. → Task 4 테스트.
5. **기존 데이터 이전** — 옛 `attendance`·`personal_memos` 행이 새 테이블로 옮겨진다. → Task 1 테스트.

---

## File Structure

```
src/db/schema.ts                 + work_segments, segment_edits, notes, user_prefs (옛 attendance*, personal_memos 제거)
drizzle/0001_*.sql               새 테이블 추가 (generate)
drizzle/0002_*.sql               데이터 옮기기 (generate --custom, 손으로 작성)
drizzle/0003_*.sql               옛 테이블 삭제 (generate)
src/lib/attendance.ts            구간 기반으로 재작성
src/lib/auth.ts                  endShift() 추가
src/lib/color.ts                 새: 색 변환·CSS 변수 계산 (순수)
src/lib/prefs.ts                 새: 사용자 설정 읽기/저장
src/lib/notes.ts                 새: 개인 메모 여러 장
src/lib/memos.ts                 개인 메모 함수 제거(공용·업무 메모만 남김)
src/lib/time.ts                  weekStartOf(date, start) 확장
public/fonts/pretendard/         동적 서브셋 CSS + woff2
src/app/globals.css              시안 토큰·컴포넌트 스타일로 교체
src/app/layout.tsx               <html style>에 사용자 색 변수, 글꼴 링크
src/app/(app)/layout.tsx         ShiftBar + TopBar
src/app/(app)/_components/*      ShiftBar, TopBar, CheckCircle, TodayPanel, WeekPanel, MemoPanel(공용), TaskItem(개편)
src/app/(app)/page.tsx           홈 3분할
src/app/(app)/settings/*         설정 화면 (ColorWheel, StatusColor, WeekStartChoice)
src/app/(app)/attendance/*       내 기록 개편
src/app/(app)/memo/*             여러 장 메모 (NotesApp client)
src/app/(app)/admin/**           새 스타일 + 구간 단위 출퇴근 수정
src/app/actions/*                attendance(endShift), prefs, notes, admin(editSegment)
tests/lib/*.test.ts, tests/migration.test.ts, e2e/*.spec.ts
```

---

### Task 1: 스키마와 데이터 이전

**Files:** Modify `src/db/schema.ts`; Create `drizzle/0001…`, `0002…`(custom), `0003…`; Test `tests/migration.test.ts`; Modify `tests/helpers/db.ts`

**Interfaces — Produces:**
- `workSegments`: id, user_id → users, date text, clock_in timestamptz not null, clock_out timestamptz null; index(user_id, date)
- `segmentEdits`: id, segment_id → work_segments (cascade), edited_by → users, at, old_clock_in, old_clock_out
- `notes`: id, user_id → users (cascade), body text not null default '', pinned boolean default false, created_at, updated_at
- `userPrefs`: user_id pk → users (cascade), theme_h int default 232, theme_s int default 55, theme_l int default 76, theme_hex text null, week_start text (`mon|sun`) default 'mon', doing_hex text null, done_hex text null, updated_at
- `createTestDbAt(n: number)` in `tests/helpers/db.ts`: 마이그레이션을 n번째까지만 적용한 DB (이전 테스트용; journal 항목 수로 자름 — 임시 폴더에 `_journal.json`을 잘라 복사)

- [ ] **Step 1:** schema에 새 테이블 4개 추가(옛 테이블 유지) → `npm run db:generate` → 0001 생성.
- [ ] **Step 2:** `npx drizzle-kit generate --custom --name move_data` → 0002에 SQL 작성:
  - `INSERT INTO work_segments (user_id, date, clock_in, clock_out) SELECT user_id, date, clock_in, clock_out FROM attendance;`
  - `INSERT INTO segment_edits (segment_id, edited_by, at, old_clock_in, old_clock_out) SELECT ws.id, e.edited_by, e.at, e.old_clock_in, e.old_clock_out FROM attendance_edits e JOIN attendance a ON a.id = e.attendance_id JOIN work_segments ws ON ws.user_id = a.user_id AND ws.date = a.date AND ws.clock_in = a.clock_in;` (단, 수정으로 clock_in이 바뀐 경우를 위해 join은 `ws.user_id = a.user_id AND ws.date = a.date`로 — 이전 데이터는 하루 1행이라 유일)
  - `INSERT INTO notes (user_id, body, pinned, created_at, updated_at) SELECT user_id, body, false, updated_at, updated_at FROM personal_memos WHERE btrim(body) <> '';`
- [ ] **Step 3: 실패하는 테스트** `tests/migration.test.ts` — `createTestDbAt(1)`(0000·0001만)에 users·attendance(2행, 1행 수정 이력 포함)·personal_memos(본문 1, 빈 본문 1) 삽입 → 나머지 마이그레이션 적용 → work_segments 2행(시각 동일), segment_edits 1행, notes 1행(본문 동일), 옛 테이블 없음(`to_regclass('attendance') IS NULL`).
- [ ] **Step 4:** FAIL 확인(0003 없음 → 옛 테이블 존재) → schema에서 attendance, attendanceEdits, personalMemos 제거 → `npm run db:generate`(삭제만 있으므로 질문 없음) → PASS.
- [ ] **Step 5:** 이 시점에 `src/lib/attendance.ts`, `memos.ts`가 옛 테이블을 참조해 타입 오류 — Task 2·4에서 고친다. 이 태스크는 `npx vitest run tests/migration.test.ts tests/db.test.ts`만 통과 기준. 커밋·푸시 `feat: add segment, notes and prefs tables with data migration`.

### Task 2: 출퇴근 구간

**Files:** Rewrite `src/lib/attendance.ts`; Modify `src/lib/auth.ts`; Rewrite `tests/lib/attendance.test.ts`; Modify `tests/lib/auth.test.ts`

**Interfaces — Produces:**
- `type Segment = { id: number; clockIn: Date; clockOut: Date | null; edited: boolean }`
- `type DayRecord = { userId; userName; date; segments: Segment[]; state: 'working' | 'done' | 'missing'; totalMs: number; firstIn: Date; edited: boolean }`
  - state: 오늘이고 열린 구간 있음 → working; 지난 날이고 열린 구간 있음 → missing; 그 외 done. totalMs = 닫힌 구간 합 (+ working이면 열린 구간은 제외하고 화면에서 now까지 더함)
- `recordLogin(db, userId, now)` — login_events 추가; 오늘 날짜에 열린 구간이 없으면 새 구간(clock_in=now)
- `clockOut(db, userId, now)` — 오늘 열린 구간 닫기, 없으면 `AppError('no_open_segment', '진행 중인 근무가 없습니다')`
- `listDays(db, { userId?, from, to, now }): Promise<DayRecord[]>` — 날짜 내림차순, 같은 날은 이름순; 구간은 출근순
- `getToday(db, userId, now): Promise<DayRecord | null>`
- `editSegment(db, adminId, segmentId, { clockIn?, clockOut? }, now)` — 이력 저장, 퇴근 < 출근이면 `AppError('invalid', …)`
- `endShift(db, userId, now)` in auth.ts — `clockOut` 후 그 사용자 세션 전부 삭제
- 제거: `cancelClockOut`, `listAttendance`, `getTodayAttendance`, `editAttendance`

- [ ] **Step 1: 실패하는 테스트** (attendance.test.ts 전면 교체)
  - 09:00 로그인 → 12:00 clockOut → 13:00 로그인 → 18:00 clockOut: segments 2개, totalMs = 8h, state done
  - 09:00 로그인 후 10:00 다시 로그인(열린 구간 있음) → segments 1개, login_events 2행
  - 11/23 09:00 로그인(퇴근 없음) → 11/24 09:00 로그인 → 11/24 새 구간, `listDays` 11/24 now 기준 11/23 state `missing`, totalMs 0
  - KST 경계: UTC 14:59 / 15:00 로그인 → 날짜 '2026-11-23' / '2026-11-24'
  - 열린 구간 없이 clockOut → `no_open_segment`
  - editSegment로 미기록 구간 퇴근 입력 → state done, edited true, segment_edits 1행
  - auth.test: `endShift` 후 `getSessionUser` null, 다시 login하면 새 구간 생김
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** `npx vitest run tests/lib/attendance.test.ts tests/lib/auth.test.ts` PASS
- [ ] **Step 5:** 커밋·푸시 `feat: work segments with auto logout on clock-out`

### Task 3: 색 계산과 사용자 설정

**Files:** Create `src/lib/color.ts`, `src/lib/prefs.ts`, `tests/lib/color.test.ts`, `tests/lib/prefs.test.ts`; Modify `src/lib/time.ts`, `tests/lib/time.test.ts`

**Interfaces — Produces:**
- color.ts: `parseHex(input: string): string | null` (대문자 6자리, `#` 허용), `hexToHsl(hex): {h,s,l}`(정수), `hslToHex(h,s,l): string`, `inkOn(h, l): string` (l ≥ 60 → `hsl(h 30% 14%)`, 아니면 `#ffffff`), `themeVars(p: Prefs): Record<string, string>` → `--h --s --l --on-accent`, 진행 중 직접 선택이면 `--dh --ds --dl`, 완료 직접 선택이면 `--oh --os --ol`, 그리고 `--on-done`
- prefs.ts: `type Prefs = { themeH; themeS; themeL; themeHex: string | null; weekStart: 'mon' | 'sun'; doingHex: string | null; doneHex: string | null }`, `DEFAULT_PREFS`, `getPrefs(db, userId): Promise<Prefs>`(행 없으면 기본값), `savePrefs(db, userId, patch: Partial<Prefs>, now): Promise<Prefs>` — 검증: h 0–359 정수, s 0–100, l 25–90, hex는 `parseHex`로 정규화(null 허용), weekStart enum. 실패 `AppError('invalid', 문구)`; 색상 코드 문구 "색상 코드는 # 뒤에 6자리로 입력하세요"
- time.ts: `weekStartOf(date, start: 'mon' | 'sun' = 'mon')`

- [ ] **Step 1: 실패하는 테스트**
  - `parseHex('#a3b1f0') === 'A3B1F0'`, `parseHex('A3B1F') === null`, `parseHex('GGGGGG') === null`, `parseHex('') === null`
  - `hslToHex(...hexToHsl('F4B6C2'))`가 각 채널 ±3 이내
  - `inkOn(232, 76)`은 `hsl(` 시작, `inkOn(232, 40) === '#ffffff'`
  - `themeVars(DEFAULT_PREFS)`에 `--dh` 없음; doingHex 지정 시 `--dh` 있음
  - getPrefs 기본값; savePrefs 부분 저장 후 다시 읽기 일치; l=95 → invalid; doingHex 'zz' → invalid 문구 일치
  - `weekStartOf('2026-11-25', 'sun') === '2026-11-22'`, `weekStartOf('2026-11-22', 'sun') === '2026-11-22'`
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS → **Step 5:** 커밋·푸시 `feat: user prefs and theme color math`

### Task 4: 개인 메모 여러 장

**Files:** Create `src/lib/notes.ts`, `tests/lib/notes.test.ts`; Modify `src/lib/memos.ts`, `tests/lib/memos.test.ts` (개인 메모 부분 제거)

**Interfaces — Produces:**
- `type Note = { id; body; pinned; createdAt; updatedAt }`
- `listNotes(db, userId, query?: string): Promise<Note[]>` — 고정 먼저, 그다음 updatedAt 내림차순; query는 본문 포함(대소문자 무시, `ilike`)
- `createNote(db, userId, now): Promise<Note>` (빈 본문)
- `updateNote(db, userId, id, body, now)` — 2만 자 초과 `too_long`
- `setNotePinned(db, userId, id, pinned, now)`, `deleteNote(db, userId, id)`
- 남의 메모·없는 id → `AppError('not_found', '메모를 찾을 수 없습니다')`
- `noteTitle(body): string`(첫 줄 trim, 비면 '새로운 메모'), `notePreview(body): string`(나머지 줄 합침, 비면 '추가 텍스트 없음') — 순수

- [ ] **Step 1: 실패하는 테스트** — 정렬(고정·최신), 검색, 남의 메모 update/delete → not_found, too_long, title/preview 규칙
- [ ] **Step 2:** FAIL → **Step 3:** 구현, memos.ts에서 개인 메모 함수 삭제 → **Step 4:** `npx vitest run` 전체 PASS, `npx tsc --noEmit`은 화면 코드 오류만 남음(다음 태스크) → **Step 5:** 커밋·푸시 `feat: multiple personal notes`

### Task 5: 글꼴·디자인 토큰·공통 틀

**Files:** Create `public/fonts/pretendard/`(동적 서브셋 CSS + `woff2-dynamic-subset/`, 라이선스 주석 유지); Rewrite `src/app/globals.css`; Modify `src/app/layout.tsx`, `src/app/(app)/layout.tsx`; Create `_components/ShiftBar.tsx`(client), `_components/TopBar.tsx`(client, 기존 NavLinks 대체), `_components/CheckCircle.tsx`(client); Delete `ClockBar.tsx`, `NavLinks.tsx`; Modify `src/app/actions/attendance.ts`(`endShiftAction`: endShift + 쿠키 삭제 + `/login` 이동; cancel 제거)

- 글꼴: `<link rel="stylesheet" href="/fonts/pretendard/pretendardvariable-dynamic-subset.css">`, `font-family: "Pretendard Variable", Pretendard, -apple-system, …`
- 루트 layout: 로그인 사용자가 있으면 `getPrefs` → `themeVars`를 `<html style>`로; 없으면 기본값.
- globals.css: 시안의 `:root` 토큰·다크 블록·체크 원·패널·탭·버튼 스타일을 옮긴다. 로그인/가입 화면도 새 토큰으로.
- ShiftBar: 이름, 근무 상태 알약(근무 중/퇴근), "11월 23일 (월) · 출근 09:02"(그날 첫 구간), 오른쪽 빨간 퇴근하기 → 확인 문구 "퇴근할까요? 퇴근하면 로그아웃됩니다." (페이지 안 확인 단계, `confirm()` 아님) → `endShiftAction`.
- TopBar: 홈 · 내 기록 · 개인 메모 · 설정 · (관리자) 관리, 로그아웃, 머리글자 원.
- CheckCircle props: `{ status: TaskStatus; size?: 'md' | 'sm'; label: string; onCycle(): void; disabled?: boolean }`; 다음 상태 `todo→doing→done→todo`.

- [ ] **Step 1:** 구현 → **Step 2:** `npx tsc --noEmit` 통과(홈 등 기존 화면은 이전 컴포넌트를 임시로 유지해도 됨) → **Step 3: 확인** dev 서버 + Playwright: 로그인 후 출퇴근 줄·탭 표시, 퇴근하기 → 확인 → `/login`으로 이동, 다시 로그인 시 내 기록 오늘 구간 2개; 360px 가로 스크롤 없음, 글꼴 `document.fonts.check('16px "Pretendard Variable"')` true → **Step 4:** 커밋·푸시 `feat: new design tokens, Pretendard, shift bar with auto logout`

### Task 6: 홈 3분할

**Files:** Rewrite `src/app/(app)/page.tsx`; Create `_components/TodayPanel.tsx`, `WeekPanel.tsx`(client), `MemoPanel.tsx`(client, BoardSection 대체); Rewrite `TaskItem.tsx`(CheckCircle 사용, 메모·기록 펼침 유지); Delete `TaskSection.tsx`, `WeekView.tsx`, `BoardSection.tsx`; Modify `src/lib/view.ts`(STATUS_LABEL '미완료')

- 서버에서 `getPrefs`로 weekStart → `weekStartOf(today, weekStart)` → `getWeekView(db, start)`; 이번 주 업무는 `getWeeklyOccurrences(db, weekStartOf(today,'mon'))`(주간 업무 키는 월요일 유지).
- TodayPanel: 제목·남은 수, 요약 3칸, 지난 업무, 오늘 할 일, 관리자면 "＋ 새로운 할 일" 링크(`/admin/tasks`).
- WeekPanel: 머리 "위클리 · 기간 · ○요일 시작", 이번 주 업무 띠, 7칸(오늘 강조, 일요일 빨강, 지난 날 흐림, 완료/전체), 칸 안 체크 원.
- MemoPanel: 공용 메모 카드 + 입력(기존 액션 재사용).
- `setStatusAction`은 그대로 사용(원 클릭 시 다음 상태 전달).

- [ ] **Step 1:** 구현 → **Step 2: 확인** Playwright(1360px): 3분할 배치(오늘 패널 높이 ≥ 위클리+메모), 원 클릭 3번 → 미완료로 순환하고 "진행 중 · 운영자" 표시, 설정 weekStart='sun'(DB 직접) 시 첫 칸 일요일; 390px 세로 쌓임·가로 스크롤 없음 → **Step 3:** `npm test`, `npm run build` → **Step 4:** 커밋·푸시 `feat: home with today, weekly grid and memo`

### Task 7: 설정 화면

**Files:** Create `src/app/(app)/settings/page.tsx`, `ColorWheel.tsx`(client), `StatusColorPicker.tsx`(client), `WeekStartChoice.tsx`(client); Create `src/app/actions/prefs.ts`

**Interfaces:** `savePrefsAction(patch: Partial<Prefs>): Promise<ActionResult>` — `requireActionUser`, `savePrefs`, `revalidatePath('/', 'layout')`

- 시안 설정 화면과 같은 구성·문구. 색상환·밝기 조작 중에는 `document.documentElement.style`로 즉시 미리 보기, 손을 떼면(포인터 업/막대 change) 저장. 색상 코드·추천 색·자동/직접 선택·시작 요일은 누르면 저장. "바꾸면 바로 저장됩니다."
- [ ] **Step 1:** 구현 → **Step 2: 확인** Playwright: 색상 코드 `F4B6C2` 적용 → 새로고침 후 입력칸 `F4B6C2`, `--h` 유지; 잘못된 코드 안내 문구; 진행 중 직접 선택 → 홈 체크 원 색 변경; 시작 요일 일요일 → 홈 첫 칸 일요일; 다른 브라우저 컨텍스트로 같은 계정 로그인 시 같은 색 → **Step 3:** 커밋·푸시 `feat: settings page`

### Task 8: 내 기록

**Files:** Rewrite `src/app/(app)/attendance/page.tsx`; Create `attendance/RecordList.tsx`, `attendance/MonthCalendar.tsx`; Delete `AttendanceTable.tsx`(관리자 화면은 Task 10에서 자체 표)

- 요약 4칸(근무한 날 = 구간 있는 날 수, 총 근무 시간 = done 날 totalMs 합, 평균 출근 = firstIn 평균, 퇴근 미기록 = missing 날 수), 달력, 6–24시 눈금, 구간 막대(열린 구간 빗금, 미기록 빨간 빗금, 미기록 구간 길이는 막대 표시용으로 출근+9시간·자정 상한), 막대 아래 구간 시각, 오른쪽 합계 + "n회 합산"/"근무 중"/"수정됨"/"퇴근 미기록".
- [ ] **Step 1:** 구현(막대 위치 계산 `pctOfDay(date: Date): number`는 `src/lib/view.ts`에 순수 함수로 두고 테스트 1개: 06:00 → 0, 24:00 → 100, 15:00 → 50) → **Step 2: 확인** Playwright: 두 구간 있는 날 "2회 합산"과 합계 → **Step 3:** 커밋·푸시 `feat: records page with segments`

### Task 9: 개인 메모 화면

**Files:** Rewrite `src/app/(app)/memo/page.tsx`; Create `memo/NotesApp.tsx`(client); Rewrite `src/app/actions/personal.ts` → `notes.ts`(`createNoteAction`, `updateNoteAction(id, body)`, `setNotePinnedAction`, `deleteNoteAction`, `listNotesAction(q)`)

- 시안과 같은 2단(목록 | 편집), 휴대폰은 목록 ↔ 편집 전환. 자동 저장: 입력 멈춘 뒤 800ms, 저장 중/저장됨 표시, 페이지 떠날 때 저장 안 된 변경이 있으면 즉시 저장. 삭제 2단계 확인. 검색은 클라이언트에서 받은 목록을 거르고, 서버 검색은 쓰지 않아도 됨(YAGNI — `listNotesAction` 생략 가능).
- [ ] **Step 1:** 구현 → **Step 2: 확인** Playwright: 새 메모 작성 → 1초 후 새로고침해도 남음, 고정 → 고정됨 묶음, 삭제 2단계, 390px 전환 → **Step 3:** 커밋·푸시 `feat: multi-note personal memo page`

### Task 10: 관리 화면 개편

**Files:** Modify `src/app/(app)/admin/**`(새 클래스로 다시 칠함), Rewrite `admin/attendance/page.tsx` + `EditRow.tsx` → 구간 단위 `SegmentRow.tsx`; Modify `src/app/actions/admin.ts`(`editSegmentAction(segmentId, date, clockIn, clockOut)` — 날짜는 서버에서 구간의 date를 다시 읽어 사용)

- [ ] **Step 1:** 구현 → **Step 2: 확인** Playwright: 업무 추가·멤버 승인 흐름 동작, 출퇴근 구간 퇴근 미기록 수정 → 내 기록에 반영 → **Step 3:** 커밋·푸시 `feat: restyle admin pages and edit work segments`

### Task 11: E2E·정리·배포

**Files:** Modify `e2e/smoke.spec.ts`; Create `e2e/redesign.spec.ts`; Modify `README.md`

- smoke: 상태 버튼 대신 체크 원(라벨 "매장 오픈 준비: 미완료")을 눌러 완료까지.
- redesign: 설정에서 색상 코드 저장 → 새 컨텍스트 로그인 후 유지; 퇴근하기 → 로그인 화면 → 재로그인 → 내 기록 "2회 합산"; 메모 작성·새로고침 유지.
- README에 화면 설명 갱신.
- [ ] **Step 1:** 테스트 작성 → **Step 2:** `npx playwright test --trace off` PASS → **Step 3:** `npm test && npm run build` → **Step 4:** 커밋·푸시 `test: e2e for redesign`
