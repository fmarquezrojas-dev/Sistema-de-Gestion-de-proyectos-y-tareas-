import { Router, json } from 'express'
import { createHash, timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { claimJobs, planReminders, prepareJob, completeJob } from '../services/notification.service'
const router = Router()
router.use((req, res, next) => {
  const expected = process.env.NOTIFICATION_INTERNAL_SECRET
  const provided = req.header('X-Synkro-Service') ?? ''
  const hash = (value: string) => createHash('sha256').update(value).digest()
  if (req.header('Origin') || !expected || expected.length < 32 || !timingSafeEqual(hash(expected), hash(provided))) {
    res.status(401).json({ error: 'Servicio no autorizado' }); return
  }
  next()
})
router.use(json({ limit: '4kb' }))
const claim = z.object({ limit: z.number().int().min(1).max(10).default(5) }).strict()
const plan = z.object({ afterId: z.number().int().min(0).max(2147483647).default(0) }).strict()
const lease = z.object({ claimToken: z.uuid() }).strict()
const completion = lease.extend({ result: z.enum(['accepted', 'temporary', 'permanent', 'unknown']),
  diagnostic: z.enum(['SMTP_ACCEPTED','SMTP_TEMPORARY','SMTP_PERMANENT','SMTP_UNCERTAIN','INVALID_PAYLOAD','WORKER_ERROR']) }).strict()
router.post('/notifications/plan', async (req, res, next) => {
  try { res.json(await planReminders(plan.parse(req.body).afterId)) } catch (err) { next(err) }
})
router.post('/notifications/claim', async (req, res, next) => {
  try { res.json({ data: await claimJobs(claim.parse(req.body).limit) }) } catch (err) { next(err) }
})
router.post('/notifications/:id/prepare', async (req, res, next) => {
  try { res.json({ data: await prepareJob(z.uuid().parse(req.params.id), lease.parse(req.body).claimToken) }) } catch (err) { next(err) }
})
router.post('/notifications/:id/complete', async (req, res, next) => {
  try { const body = completion.parse(req.body); res.json(await completeJob(z.uuid().parse(req.params.id), body.claimToken, body.result, body.diagnostic)) } catch (err) { next(err) }
})
export default router
