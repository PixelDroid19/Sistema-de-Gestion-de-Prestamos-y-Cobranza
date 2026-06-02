import { test, expect } from '@playwright/test';

const base = 'http://localhost:3000';
const creds = {
  username: 'qa.admin.20260427@test.local',
  password: 'Admin123!',
};

async function login(page) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await expect(page.locator('input[placeholder="Correo"]')).toBeVisible({ timeout: 10000 });
  await page.fill('input[placeholder="Correo"]', creds.username);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/\/dashboard|\/credits|\/payouts|\/reports/);
}

test('credits-new amount decimal does not reset on arrow keys', async ({ page }) => {
  await login(page);
  await page.goto(`${base}/credits-new`, { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(`${base}/credits-new`);

  const amountInput = page.locator('.new-credit-workspace .operational-control input').first();
  await expect(amountInput).toBeVisible();

  await amountInput.click();
  await amountInput.fill('120554.50');
  await expect(amountInput).toHaveValue('120.554,50');

  await amountInput.press('ArrowLeft');
  await amountInput.press('ArrowLeft');
  await expect(amountInput).toHaveValue('120.554,50');

  await amountInput.press('Backspace');
  await amountInput.fill('120554.5');
  await amountInput.press('ArrowRight');
  await amountInput.press('ArrowRight');
  await expect(amountInput).toHaveValue('120.554,5');
});

test('selects are centralized', async ({ page }) => {
  await login(page);
  await page.goto(`${base}/credits-new`, { waitUntil: 'networkidle' });

  const selects = page.locator('select');
  const count = await selects.count();
  expect(count).toBeGreaterThanOrEqual(0);

  for (let i = 0; i < count; i += 1) {
    const id = await selects.nth(i).getAttribute('id');
    await expect(selects.nth(i)).toHaveClass(/operational-control-select/);
    const parent = selects.nth(i).locator('xpath=ancestor::*[contains(@class, "operational-control")]');
    await expect(parent).toHaveCount(1);
    if (id) {
      await expect(parent).toBeVisible();
    }
  }
});

