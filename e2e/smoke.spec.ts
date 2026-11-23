import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, name: string, password: string, admin = false) {
  await page.goto('/login');
  if (admin) await page.getByRole('tab', { name: '관리자' }).click();
  await page.getByLabel('이름').fill(name);
  await page.getByLabel('비밀번호').fill(password);
  await page.locator('form button.btn.primary').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function logout(page: Page) {
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.waitForURL('**/login');
}

test('admin creates a task, approves a member, member completes it and admin sees who', async ({ page }) => {
  page.on('dialog', (d) => d.accept());

  // 관리자: 오늘 날짜 일회성 업무 등록
  await login(page, '운영자', 'pw1234', true);
  await expect(page).toHaveURL(/\/admin\/tasks/);
  await page.getByLabel('제목').fill('매장 오픈 준비');
  await page.getByRole('button', { name: '업무 추가' }).click();
  await expect(page.getByText('저장했습니다')).toBeVisible();
  await logout(page);

  // 민수: 가입 신청 → 승인 전 로그인 거절
  await page.goto('/signup');
  await page.getByLabel('이름').fill('민수');
  await page.getByLabel('비밀번호 (4자 이상)').fill('pw5678');
  await page.getByLabel('비밀번호 확인').fill('pw5678');
  await page.getByRole('button', { name: '가입 신청' }).click();
  await expect(page.getByRole('status')).toContainText('가입 신청이 접수되었습니다');
  await page.goto('/login');
  await page.getByLabel('이름').fill('민수');
  await page.getByLabel('비밀번호').fill('pw5678');
  await page.locator('form button.btn.primary').click();
  await expect(page.locator('.msg.error')).toHaveText('관리자 승인 대기 중입니다');

  // 관리자: 승인
  await login(page, '운영자', 'pw1234', true);
  await page.goto('/admin/members');
  await page.locator('li.task', { hasText: '민수' }).getByRole('button', { name: '승인' }).click();
  await expect(page.getByText('대기 중인 신청이 없습니다')).toBeVisible();
  await logout(page);

  // 민수: 로그인 → 오늘 업무 완료
  await login(page, '민수', 'pw5678');
  const task = page.locator('section[aria-label="오늘 업무"] li.task', { hasText: '매장 오픈 준비' });
  await expect(task).toBeVisible();
  await expect(page.locator('.shift')).toContainText('출근');
  await task.getByRole('button', { name: '완료', exact: true }).click();
  await expect(task.locator('.last-change')).toContainText('완료 · 민수');
  await logout(page);

  // 관리자: 같은 업무에 민수가 완료한 것으로 보임
  await login(page, '운영자', 'pw1234');
  await expect(
    page.locator('section[aria-label="오늘 업무"] li.task', { hasText: '매장 오픈 준비' }).locator('.last-change'),
  ).toContainText('완료 · 민수');
});
