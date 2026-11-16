import { PrismaClient } from '@prisma/client'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
if (process.env.SYNKRO_DEMO_CHECK !== 'local-synthetic') throw Error('Solo entorno Compose sintético explícito')
const db = new PrismaClient()
const { updateTask } = createRequire(import.meta.url)('../dist/services/task.service.js')
const count = async () => ({ users:await db.user.count(), projects:await db.project.count(), tasks:await db.task.count(), comments:await db.comment.count(), logs:await db.activityLog.count() })
try {
  const ana = await db.user.findUniqueOrThrow({where:{email:'ana.demo@example.invalid'}})
  const project = await db.project.findFirstOrThrow({where:{name:'Demo · Lanzamiento web'}})
  const task = await db.task.findFirstOrThrow({where:{projectId:project.id},orderBy:{id:'asc'}})
  await updateTask(task.id,ana.id,{expectedVersion:task.version,title:'Edición manual conservada'})
  await db.project.create({data:{name:'Proyecto manual conservado',members:{create:{userId:ana.id,role:'OWNER'}}}})
  const before = await count()
  const password = ana.password
  for (let i=0;i<2;i++) assert.equal(spawnSync(process.execPath,['scripts/demo.mjs'],{stdio:'inherit'}).status,0)
  assert.deepEqual(await count(),before)
  assert.equal((await db.task.findUniqueOrThrow({where:{id:task.id}})).title,'Edición manual conservada')
  assert.equal((await db.user.findUniqueOrThrow({where:{id:ana.id}})).password,password)
  assert.equal(await db.notificationJob.count({where:{status:'pending',taskId:{in:(await db.task.findMany({where:{projectId:project.id},select:{id:true}})).map(t=>t.id)}}}),0)
  console.log('PASS demo: conteos, historial, edición manual, proyecto manual y contraseña conservados; sin trabajos pendientes de demo')
} finally { await db.$disconnect() }
