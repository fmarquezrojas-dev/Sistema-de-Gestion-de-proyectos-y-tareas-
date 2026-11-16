// Solo instancia sintética: Node + worker real + SMTP Mailpit local.
import { spawn } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { assertTestDatabase } from './test-database.mjs'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
const url = assertTestDatabase(process.env.TEST_DATABASE_URL)
const prisma = new PrismaClient({ datasources: { db: { url } } })
const secret = randomBytes(32).toString('hex')
const env = { ...process.env, DATABASE_URL: url, NODE_ENV: 'test', PORT: '53001',
  JWT_SECRET: randomBytes(32).toString('hex'), AUTH_ALLOWED_ORIGINS: 'http://localhost:5173',
  NOTIFICATION_INTERNAL_SECRET: secret, NODE_API_URL: 'http://127.0.0.1:53001',
  SMTP_HOST: '127.0.0.1', SMTP_PORT: '51025', FRONTEND_URL: 'http://localhost:5173', NOTIFICATION_INTERVAL_SECONDS: '1' }
const node = spawn(process.execPath, ['dist/server.js'], { cwd: 'backend', env, stdio: 'ignore' })
let python
const poll = async (fn) => { for (let i=0;i<80;i++) { try { if(await fn()) return } catch {} await new Promise(r=>setTimeout(r,250)) } throw Error('Timeout integración') }
const internal = async (path, body) => {
  const res = await fetch('http://127.0.0.1:53001/api/internal/notifications'+path, { method:'POST', headers:{'Content-Type':'application/json','X-Synkro-Service':secret},body:JSON.stringify(body) })
  assert.equal(res.status,200); return res.json()
}
try {
  await poll(async()=> (await fetch('http://127.0.0.1:53001/health/ready')).ok)
  const marker = Date.now()
  const owner = await prisma.user.create({ data:{name:'SMTP synthetic owner', email:`smtp-owner-${marker}@example.invalid`,password:'unused'} })
  const member = await prisma.user.create({ data:{name:'SMTP synthetic member',email:`smtp-member-${marker}@example.invalid`,password:'unused'} })
  const project = await prisma.project.create({data:{name:'SMTP synthetic',members:{create:[{userId:owner.id,role:'OWNER'},{userId:member.id}]}}})
  // API login HTTP real para crear la tarea: hash sintético local.
  const bcrypt = await import('bcryptjs')
  await prisma.user.update({where:{id:owner.id},data:{password:await bcrypt.hash('synthetic-integration-password',4)}})
  const login = await fetch('http://127.0.0.1:53001/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:5173'},body:JSON.stringify({email:owner.email,password:'synthetic-integration-password'})})
  const token = (await login.json()).data.accessToken
  const created = await fetch(`http://127.0.0.1:53001/api/tasks/project/${project.id}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({title:'Correo sintético real',assigneeId:member.id})})
  assert.equal(created.status,201)
  const task = (await created.json()).data
  const job = await prisma.notificationJob.findFirstOrThrow({where:{taskId:task.id}})
  assert.equal(job.status,'pending') // Python apagado: intención conservada.
  // Procesar solamente este contexto; otras fixtures no deben generar correo.
  await prisma.notificationJob.updateMany({where:{id:{not:job.id},status:'pending'},data:{status:'cancelled'}})
  await prisma.task.updateMany({where:{id:{not:task.id}},data:{dueDate:null}})
  python = spawn(process.env.SYNKRO_TEST_PYTHON || resolve('notification-service/.venv/Scripts/python.exe'),['-m','uvicorn','main:app','--port','58000','--no-access-log'], {cwd:'notification-service',env,stdio:'ignore'})
  // Resolver ejecutable absoluto en Windows desde la raíz.
  await poll(async()=> (await prisma.notificationJob.findUnique({where:{id:job.id}})).status === 'sent')
  const messages = await (await fetch('http://127.0.0.1:58025/api/v1/messages')).json()
  assert.ok(messages.messages.some(m=>m.To.some(t=>t.Address === member.email)))
  const count = messages.total
  await new Promise(r=>setTimeout(r,2300))
  assert.equal((await (await fetch('http://127.0.0.1:58025/api/v1/messages')).json()).total,count)
  const uncertain = await prisma.notificationJob.create({data:{kind:'assigned',taskId:task.id,projectId:project.id,recipientId:member.id,assignmentVersion:task.assignmentVersion,dedupeKey:`unknown:${marker}`,status:'processing',claimToken:crypto.randomUUID(),leaseUntil:new Date(Date.now()-1000),sendingAt:new Date()}})
  await internal('/claim',{limit:1})
  assert.equal((await prisma.notificationJob.findUnique({where:{id:uncertain.id}})).status,'unknown')
  await new Promise(r=>setTimeout(r,1500))
  assert.equal((await (await fetch('http://127.0.0.1:58025/api/v1/messages')).json()).total,count)
  console.log('PASS: API → intención con Python apagado → recuperación → SMTP Mailpit → sin duplicado; unknown sin reenvío')
} finally {
  python?.kill(); node.kill(); await prisma.$disconnect()
}
