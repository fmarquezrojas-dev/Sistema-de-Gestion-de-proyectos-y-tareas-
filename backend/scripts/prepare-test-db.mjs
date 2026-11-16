import { spawnSync } from 'node:child_process'
import pg from 'pg'
import { assertTestDatabase } from './test-database.mjs'
export async function prepareTestDatabase(env) {
  assertTestDatabase(env.DATABASE_URL)
  const db = new pg.Client({ connectionString: env.DATABASE_URL })
  await db.connect()
  try {
    const { rows: [state] } = await db.query("SELECT current_database() AS db, current_user AS owner, to_regclass('public.users') AS users, to_regclass('public._prisma_migrations') AS migrations")
    if (state.db !== 'synkro_test' || state.owner !== 'synkro_test') throw new Error('Identidad de base de pruebas incorrecta')
    const run = args => {
      const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], { env, stdio: 'inherit' })
      if (result.status !== 0) throw new Error('Preparación interrumpida: revisa el esquema, sin reset')
    }
    if (state.users && !state.migrations) {
      // Resolver baseline solo si el esquema existente coincide exactamente.
      run(['migrate', 'diff', '--from-url', env.DATABASE_URL, '--to-schema-datamodel', 'prisma/baseline/schema.prisma', '--exit-code'])
      run(['migrate', 'resolve', '--applied', '20261115000000_baseline'])
    }
    run(['migrate', 'deploy'])
  } finally { await db.end() }
}
