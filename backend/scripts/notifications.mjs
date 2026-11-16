import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const [action = 'list', id, reason] = process.argv.slice(2)
try {
  if (action === 'list') {
    console.table(await db.notificationJob.findMany({ where: { status: { in: ['unknown','failed'] } },
      select: { id: true, kind: true, status: true, attempts: true, diagnostic: true, resolutionReason: true },
      orderBy: { createdAt: 'asc' }, take: 100 }))
  } else {
    if (!['confirm-sent', 'confirm-not-sent', 'retry'].includes(action) || !/^[0-9a-f-]{36}$/.test(id ?? '') || !reason || reason.length < 5 || reason.length > 200)
      throw Error('Uso: notifications.mjs list | confirm-sent|confirm-not-sent|retry UUID "motivo sin datos sensibles"')
    const where = action === 'retry' ? { id, status: 'failed', result: 'temporary' } : { id, status: 'unknown' }
    const status = action === 'confirm-sent' ? 'sent' : action === 'confirm-not-sent' ? 'failed' : 'pending'
    const changed = await db.notificationJob.updateMany({ where, data: { status, claimToken: null,
      resolutionReason: reason, diagnostic: 'ADMIN_RESOLUTION',
      ...(action === 'confirm-sent' ? { acceptedAt: new Date(), result: 'accepted' } :
        action === 'confirm-not-sent' ? { result: 'temporary' } : { attempts: 0, nextAttemptAt: new Date(), result: null }) } })
    if (changed.count !== 1) throw Error('Estado incompatible; revisar antes de resolver/reintentar')
    console.log('Resolución registrada. No se envió correo desde esta herramienta.')
  }
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally { await db.$disconnect() }
