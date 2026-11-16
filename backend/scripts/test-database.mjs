// Lista cerrada: no se permite apuntar a bases locales/de producción por accidente.
export function assertTestDatabase(value) {
  if (!value) throw new Error('Configura TEST_DATABASE_URL para PostgreSQL aislado')
  const url = new URL(value)
  if (url.protocol !== 'postgresql:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
    || url.port !== '55432' || url.pathname !== '/synkro_test'
    || url.username !== 'synkro_test' || url.search || url.hash) {
    throw new Error('Destino rechazado: usa synkro_test@127.0.0.1:55432/synkro_test sin parámetros')
  }
  return value
}
