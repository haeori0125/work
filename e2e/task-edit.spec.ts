import { expect, test } from '@playwright/test';

test('editing a weekly task keeps it weekly and keeps its parts', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('tab', { name: '관리자' }).click();
  await page.getByLabel('이름').fill('운영자');
  await page.getByLabel('비밀번호').fill('pw1234');
  await page.locator('form button.btn.primary').click();
  await page.waitForURL(/admin\/tasks/);

  await page.getByLabel('제목').fill('[DB] 어법파트 통일하기');
  await page.getByLabel('기간 업무 (기간 안에)').check();
  await page.getByRole('button', { name: '업무 추가' }).click();
  await expect(page.locator('.toast', { hasText: '등록되었습니다' })).toBeVisible();

  const row = page.locator('.list-card > li', { hasText: '[DB] 어법파트 통일하기' });
  await row.getByRole('link', { name: '수정' }).click();
  await page.waitForURL(/edit=/);
  await expect(page.getByLabel('기간 업무 (기간 안에)')).toBeChecked();

  await page.getByRole('button', { name: '파트 추가' }).click();
  await page.getByLabel('파트 1 이름').fill('1~10번');
  await page.getByRole('button', { name: '파트 1 담당자' }).click();
  await page.getByRole('option', { name: '운영자' }).click();
  // 파트 담당자는 업무 담당자에도 자동으로 들어간다(체크된 채 잠김)
  await expect(page.getByRole('checkbox', { name: /운영자/ })).toBeChecked();
  await page.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.locator('.toast', { hasText: '저장되었습니다' })).toBeVisible();
  await expect(row.locator('.tag').first()).toHaveText('기간 · 한 번');
  await expect(row).toContainText('파트 1개');
  await expect(row.locator('.tag', { hasText: '담당' })).toContainText('운영자');
  // 새 업무 칸은 다시 비어 있어야 한다
  await expect(page.getByLabel('제목')).toHaveValue('');
  await expect(page.locator('.part-edit')).toHaveCount(0);
});
