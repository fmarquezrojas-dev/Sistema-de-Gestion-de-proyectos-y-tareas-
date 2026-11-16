import { expect, it } from 'vitest'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
it('baseline instala desde vacío y migración de sesiones conserva datos existentes', async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    const { rows: [identity] } = await db.query('SELECT current_database() AS db, current_user AS owner')
    expect(identity).toEqual({ db: 'synkro_test', owner: 'synkro_test' })
    await db.query('BEGIN')
    // Identificador generado aquí, sin entradas del cliente. ROLLBACK retira el esquema sintético.
    const schema = 'migration_' + randomUUID().replace(/-/g, '')
    await db.query(`CREATE SCHEMA "${schema}"`)
    await db.query(`SET LOCAL search_path TO "${schema}"`)
    await db.query(readFileSync('prisma/migrations/20261115000000_baseline/migration.sql', 'utf8'))
    await db.query(`INSERT INTO users (name,email,password) VALUES ('Synthetic','migration@example.invalid','synthetic-hash')`)
    await db.query(`INSERT INTO projects (name,"updatedAt") VALUES ('Proyecto sintético',now())`)
    await db.query(`INSERT INTO project_members ("userId","projectId",role) VALUES (1,1,'OWNER')`)
    await db.query(`INSERT INTO tasks (title,"projectId","updatedAt") VALUES ('Tarea sintética',1,now())`)
    await db.query(readFileSync('prisma/migrations/20261115000100_auth_sessions/migration.sql', 'utf8'))
    await db.query(readFileSync('prisma/migrations/20261115000200_task_versions/migration.sql', 'utf8'))
    await db.query(readFileSync('prisma/migrations/20261116000000_notification_jobs/migration.sql', 'utf8'))
    const { rows: [task] } = await db.query('SELECT version FROM tasks')
    expect(task.version).toBe(1)
    const { rows: [counts] } = await db.query('SELECT (SELECT COUNT(*)::int FROM users) AS users, (SELECT COUNT(*)::int FROM projects) AS projects, (SELECT COUNT(*)::int FROM tasks) AS tasks, (SELECT COUNT(*)::int FROM auth_sessions) AS sessions')
    expect(counts).toEqual({ users: 1, projects: 1, tasks: 1, sessions: 0 })
  } finally { await db.query('ROLLBACK'); await db.end() }
})
