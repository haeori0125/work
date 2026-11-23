import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, name = '운영자', password = 'pw1234') {
  await page.goto('/login');
  await page.getByLabel('이름').fill(name);
  await page.getByLabel('비밀번호').fill(password);
  await page.locator('form button.btn.primary').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

test('settings are saved to the account and follow the user to another browser', async ({ page, browser }) => {
  await login(page);
  await page.getByRole('link', { name: '설정' }).click();
  await page.locator('#theme-hex').fill('zz');
  await page.locator('#theme-hex').press('Enter');
  await expect(page.locator('.err')).toContainText('색상 코드는 # 뒤에 6자리로 입력하세요');
  await page.locator('#theme-hex').fill('#F4B6C2');
  await page.locator('#theme-hex').press('Enter');
  await expect(page.getByRole('status')).toHaveText('저장했습니다.');
  await page.getByRole('button', { name: '일요일 시작' }).click();
  await expect(page.getByRole('status')).toHaveText('저장했습니다.');

  const other = await browser.newPage();
  await login(other);
  await expect(other.locator('.day-head .w').first()).toHaveText('일');
  await other.getByRole('link', { name: '설정' }).click();
  await expect(other.locator('#theme-hex')).toHaveValue('F4B6C2');
  await other.close();
});

test('clocking out logs out, and logging in again adds a second segment to the day', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: '퇴근하기' }).click();
  await page.getByRole('button', { name: '퇴근', exact: true }).click();
  await page.waitForURL(/\/login/);
  await expect(page.getByRole('status')).toContainText('퇴근했습니다');
  await login(page);
  await page.getByRole('link', { name: '내 기록' }).click();
  const today = page.locator('.rec').first();
  await expect(today).toContainText('2회 합산');
  await expect(today).toContainText('근무 중');
});

test('personal notes are kept after reload', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: '개인 메모' }).click();
  await page.getByRole('button', { name: '＋ 새 메모' }).click();
  await page.locator('#note-text').fill('장보기\n우유, 커피');
  await expect(page.getByText('자동 저장됨')).toBeVisible();
  await page.reload();
  await expect(page.locator('.nl b').first()).toHaveText('장보기');
  await expect(page.locator('.nl span').first()).toContainText('우유, 커피');
});
