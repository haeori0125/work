# 팀 투두

모임 멤버가 함께 쓰는 업무 체크리스트입니다.

- 이름 + 비밀번호 로그인 (멤버 / 관리자 탭), 가입은 관리자 승인 후 사용
- 오늘 업무 · 지난 업무 · 이번 주 업무 · 위클리(요일별) 보기
- 업무 상태: 미체크 / 진행 중 / 완료 — 누가 언제 바꿨는지 표시
- 관리자: 업무 작성(반복: 매일·평일·매주 선택 요일·주간), 담당자 지정, 멤버 승인·관리, 출퇴근 기록 수정
- 메모: 업무별 메모, 날짜별 공용 메모, 개인 메모
- 출근(그날 첫 로그인) / 퇴근(버튼) 기록, 자정까지 퇴근을 안 누르면 "퇴근 미기록"

## Vercel 배포 설정 (처음 한 번)

1. **데이터베이스 연결** — Vercel 프로젝트 → **Storage** → **Create Database** → **Neon** (무료) → 이 프로젝트에 연결.
   연결하면 `DATABASE_URL`(또는 `POSTGRES_URL`) 환경변수가 자동으로 들어갑니다.
2. **첫 관리자 계정** — **Settings → Environment Variables**에 추가:
   - `ADMIN_NAME` : 관리자 이름 (예: 운영자)
   - `ADMIN_PASSWORD` : 관리자 비밀번호 (4자 이상)
3. **프레임워크** — `vercel.json`이 Next.js로 지정하므로 따로 할 일은 없습니다.
   (Settings → Build and Deployment → Framework Preset이 Next.js로 보이면 정상)
4. **재배포** — Deployments → 최신 배포 → Redeploy. 빌드할 때 DB 테이블이 자동으로 만들어집니다.
5. 사이트에서 **관리자 탭**으로 `ADMIN_NAME` / `ADMIN_PASSWORD` 로그인.

관리자가 한 명도 없을 때만 환경변수로 관리자 계정이 만들어집니다. 이후 관리자는 "멤버 관리"에서 다른 멤버를 관리자로 지정할 수 있습니다.

## 로컬 개발

```bash
npm install
ADMIN_NAME=운영자 ADMIN_PASSWORD=pw1234 npm run dev
```

`DATABASE_URL`이 없으면 `./.pglite` 폴더에 로컬 DB(PGlite)를 만들어 씁니다.

```bash
npm test                          # 단위 테스트 (vitest + 메모리 DB)
npx playwright test --trace off   # 전체 흐름 테스트
npm run db:generate               # 스키마 변경 후 마이그레이션 생성
```

모든 날짜·시간은 한국 시간(Asia/Seoul) 기준입니다.
