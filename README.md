# Team to-do

모임 멤버가 함께 쓰는 업무 체크리스트입니다.

- 이름 + 비밀번호 로그인 (멤버 / 관리자 탭), 가입은 관리자 승인 후 사용
- 홈: 왼쪽 **오늘**(지난 업무 · 오늘 할 일), 오른쪽 **위클리**(이번 주 업무 + 7칸), 아래 **공용 메모**
- 체크 원을 누를 때마다 미완료 → 진행 중 → 완료, 누가 언제 바꿨는지 표시
- **설정**(사람마다 저장): 테마 색(색상환 · 밝기 · 색상 코드), 위클리 일요일/월요일 시작, 진행 중 · 완료 색
- **출퇴근**: 로그인하면 출근, 빨간 "퇴근하기"를 누르면 퇴근 + 자동 로그아웃. 하루 여러 번이면 모든 구간 합산. 자정까지 퇴근을 안 누른 구간은 "퇴근 미기록"(관리자가 수정)
- **내 기록**: 월 요약, 달력, 날짜별 근무 구간 막대
- **개인 메모**: 여러 장, 고정 · 검색 · 자동 저장
- 관리자: 업무 작성(반복 · 담당자), 멤버 승인 · 관리, 출퇴근 구간 수정
- 글꼴은 Pretendard(`public/fonts/pretendard`, SIL OFL 1.1)

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

> **미리보기(Preview) 배포 주의:** 빌드할 때마다 DB 마이그레이션이 실행됩니다. 다른 브랜치에 푸시해 미리보기 배포를 만들 계획이면,
> Neon 연결 설정에서 "Preview 배포마다 DB 브랜치 만들기"를 켜거나 DB 환경변수를 Production에만 두세요.
> 지금처럼 기본 브랜치 하나에만 푸시하면 신경 쓰지 않아도 됩니다.

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
