import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('이름').fill('운영자');
  await page.getByLabel('비밀번호').fill('pw1234');
  await page.locator('form button.btn.primary').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

const isNoteSave = (req: { method(): string; headers(): Record<string, string>; postData(): string | null }) =>
  req.method() === 'POST' && !!req.headers()['next-action'] && (req.postData() ?? '').includes('저장 실패 테스트');

test('a failed autosave is retried instead of being dropped', async ({ page }) => {
  await login(page);
  await page.goto('/memo');
  await page.getByRole('button', { name: '새 메모' }).click();
  await expect(page.locator('#note-text')).toBeVisible();

  let failing = true;
  await page.route('**/memo', async (route) => {
    if (failing && isNoteSave(route.request())) await route.abort();
    else await route.fallback();
  });
  await page.locator('#note-text').fill('저장 실패 테스트\n사라지면 안 됨');
  await expect(page.getByRole('status')).toContainText('저장하지 못했습니다');

  failing = false;
  await expect(page.getByRole('status')).toHaveText('자동 저장됨', { timeout: 10000 });
  await page.reload();
  await expect(page.locator('.nl b').first()).toHaveText('저장 실패 테스트');
});

test('leaving the page with unsaved text asks before closing', async ({ page }) => {
  await login(page);
  await page.goto('/memo');
  await page.getByRole('button', { name: '새 메모' }).click();
  await page.locator('#note-text').fill('닫기 직전 입력');
  const dialog = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  expect((await dialog).type()).toBe('beforeunload');
});
