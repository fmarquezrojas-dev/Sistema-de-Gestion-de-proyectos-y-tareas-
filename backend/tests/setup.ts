// Se ejecuta antes de importar app/Prisma y antes de cualquier limpieza.
// @ts-expect-error El guard compartido es un módulo JavaScript ejecutable por Node.
import { assertTestDatabase } from '../scripts/test-database.mjs'
if (process.env.NODE_ENV !== 'test') throw new Error('NODE_ENV debe ser test')
const safe = assertTestDatabase(process.env.TEST_DATABASE_URL)
if (process.env.DATABASE_URL !== safe) throw new Error('DATABASE_URL no coincide con la base de pruebas')
