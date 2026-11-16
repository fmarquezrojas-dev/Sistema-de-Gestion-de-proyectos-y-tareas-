import { prepareTestDatabase } from './prepare-test-db.mjs'
import { spawnSync } from 'node:child_process'
import { assertTestDatabase } from './test-database.mjs'
const url = assertTestDatabase(process.env.TEST_DATABASE_URL)
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: url,
  JWT_SECRET: 'synthetic-test-only-secret-with-256-bits-minimum', AUTH_ALLOWED_ORIGINS: 'http://localhost:5173',
  JWT_ISSUER: 'synkro-test-api', JWT_AUDIENCE: 'synkro-test-web',
  ACCESS_TOKEN_TTL_SECONDS: '900', SESSION_TTL_SECONDS: '604800', AUTH_RATE_WINDOW_SECONDS: '60',
  AUTH_LOGIN_LIMIT: '10', AUTH_REGISTER_LIMIT: '5', AUTH_REFRESH_LIMIT: '120', AUTH_PASSWORD_LIMIT: '5',
  NOTIFICATION_SERVICE_URL: '' }
await prepareTestDatabase(env)
for (const [script, args] of [
  ['node_modules/typescript/bin/tsc', ['-p', 'tsconfig.test.json']],
  ['node_modules/vitest/vitest.mjs', ['run']],
]) {
  const result = spawnSync(process.execPath, [script, ...args], { env, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
