import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 30000,
  retries: 0,
  workers: 1, // Serial execution - tests share a database
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8000',
    screenshot: 'only-on-failure',
    trace: 'off',
    ignoreHTTPSErrors: true,
    headless: true,
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--allow-insecure-localhost',
        '--ignore-certificate-errors',
        '--disable-features=AutoupgradeMixedContent,UpgradeInsecureRequests',
      ],
    },
  },
  projects: [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: [['list'], ['html', { open: 'never', outputFolder: './test-results/html-report' }]],
  outputDir: './screenshots',
});
