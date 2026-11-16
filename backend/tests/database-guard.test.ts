import { expect, it } from 'vitest'
// @ts-expect-error Guard Node compartido.
import { assertTestDatabase } from '../scripts/test-database.mjs'
it('rechaza destinos que puedan ser la base del usuario', () => {
  for (const url of [undefined, 'postgresql://postgres@localhost:5432/sist_proytask',
    'postgresql://synkro_test@remote:55432/synkro_test',
    'postgresql://synkro_test@localhost:55432/synkro',
    'postgresql://postgres@localhost:55432/synkro_test',
    'postgresql://synkro_test@localhost:55432/synkro_test?schema=public']) {
    expect(() => assertTestDatabase(url)).toThrow()
  }
  expect(() => assertTestDatabase('postgresql://synkro_test@127.0.0.1:55432/synkro_test')).not.toThrow()
})
