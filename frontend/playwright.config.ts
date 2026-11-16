import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 30000, retries: 0,
  use: { baseURL: 'http://localhost:5174', headless: true, trace: 'off', screenshot: 'off', video: 'off' },
  webServer: [
    { command: 'node ../backend/dist/server.js', url: 'http://localhost:3001/api/auth/me', reuseExistingServer: false },
    { command: 'node node_modules/vite/bin/vite.js --host localhost --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: false },
  ],
})
