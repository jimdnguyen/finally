import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, '../../docs/screenshots');

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

test('dashboard screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/');
  await page.locator('[data-testid="watchlist-row"]').first().waitFor({ state: 'visible' });
  // Let prices stream for a moment
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'dashboard.png'), fullPage: false });
});

test('heatmap screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/');
  await page.locator('[data-testid="watchlist-row"]').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(2000);

  // Switch to heatmap tab
  await page.click('text=Heatmap');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, 'heatmap.png'), fullPage: false });
});
