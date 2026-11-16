/**
 * Browser tests (e2e/). They run against a production build in demo mode: no Supabase, all data in localStorage,
 * so nothing here can touch real users. `npm run e2e` builds and serves on port 4173 by itself.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    reducedMotion: 'reduce',
    timezoneId: 'Asia/Tehran',
    trace: 'retain-on-failure',
    // Local runs can point at an already installed Chromium when the browser download is blocked (PW_EXE=/path/to/chrome)
    launchOptions: process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : {},
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'npx vite build --mode demo --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
