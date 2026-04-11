import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Match only .spec.ts files in e2e/ directory
  testMatch: '**/*.spec.ts',

  // Timeout for each test
  timeout: 30 * 1000,  // 30 seconds

  // Timeout for expect()
  expect: {
    timeout: 5000,  // 5 seconds
  },

  // Parallel execution
  workers: 1,  // Single worker to avoid race conditions with shared DB

  // Retry failed tests
  retries: 0,  // No retries in E2E; failures are real

  // Reporter
  reporter: 'html',

  // Use
  use: {
    baseURL: 'http://app:8000',
    trace: 'on-first-retry',  // Capture trace on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Web Server: none (app runs in docker-compose, not via npm script)
  // Docker-compose health check ensures app is ready

  // Projects: test in Chromium only (single-user demo)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Global timeout
  globalTimeout: 60 * 1000,  // 60 seconds total for all tests
})
