import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8000',
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: './screenshots/html-report' }]],
  outputDir: './screenshots',
});
