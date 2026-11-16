import { spawnSync } from 'node:child_process'
import { assertTestDatabase } from '../../backend/scripts/test-database.mjs'
const url = assertTestDatabase(process.env.TEST_DATABASE_URL)
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: url,
  JWT_SECRET: 'synthetic-e2e-only-secret-with-256-bits-minimum',
  AUTH_ALLOWED_ORIGINS: 'http://localhost:5174', ACCESS_TOKEN_TTL_SECONDS: '4', SESSION_TTL_SECONDS: '604800', AUTH_RATE_WINDOW_SECONDS: '60',
  JWT_ISSUER: 'synkro-e2e-api', JWT_AUDIENCE: 'synkro-e2e-web',
  AUTH_LOGIN_LIMIT: '1000', AUTH_REGISTER_LIMIT: '1000', AUTH_REFRESH_LIMIT: '1000',
  PORT: '3001', VITE_API_URL: 'http://localhost:3001/api', NOTIFICATION_SERVICE_URL: '' }
const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc'], { cwd: '../backend', env, stdio: 'inherit' })
if (build.status !== 0) process.exit(build.status ?? 1)
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], { env, stdio: 'inherit' })
process.exit(result.status ?? 1)
