import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  test: { maxWorkers: 2, include: ['src/**/*.test.{ts,tsx}'], environment: 'jsdom', setupFiles: ['./src/tests/setup.ts'], clearMocks: true },
})
