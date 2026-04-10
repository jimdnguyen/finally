import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:8000',
    headless: true,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'cd ../backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000',
    url: 'http://localhost:8000/api/health',
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || 'test-key-for-testing',
      MASSIVE_API_KEY: process.env.MASSIVE_API_KEY || '',
      LLM_MOCK: 'true',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
