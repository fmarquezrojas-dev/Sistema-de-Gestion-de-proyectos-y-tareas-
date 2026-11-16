import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { recordTaskChange } = require('../dist/services/taskHistory.js')
const db = new PrismaClient()
try {
  const created = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(771983)`
    if (await tx.demoSeed.findUnique({ where: { id: 'portfolio-v1' } })) return false
    const emails = ['ana.demo@example.invalid','bruno.demo@example.invalid','carla.demo@example.invalid']
    if (await tx.user.count({ where: { email: { in: emails } } })) throw Error('Hay cuentas demo previas sin marcador. No se cambiarán sus credenciales ni datos.')
    const password = await bcrypt.hash('SynkroDemo2026!', 10)
    const users = []
    for (const [index, email] of emails.entries()) users.push(await tx.user.create({ data: { email, password, name: ['Ana Demo','Bruno Demo','Carla Demo'][index] } }))
    for (let n=0;n<2;n++) {
      const project = await tx.project.create({data:{name:['Demo · Lanzamiento web','Demo · Operaciones'][n], description:'Datos sintéticos de demostración local',
        members:{create:users.map((user,index)=>({userId:user.id,role:index===n?'OWNER':'MEMBER',canEditTasks:index===1,canCreateTasks:index!==2}))}}})
      const actor = users[n]
      for (let index=0;index<5;index++) {
        const assigneeId = index===3 ? null : users[index%3].id
        const task = await tx.task.create({ data:{projectId:project.id,title:['Preparar propuesta','Revisar prototipo','Validación terminada','Pendiente de asignar','Documentar resultados'][index],
          description:'Contenido sintético; puedes editarlo sin que la demo lo restablezca.',
          status:index===2?'COMPLETED':index===1?'IN_PROGRESS':'PENDING', priority:index===0?'HIGH':'MEDIUM', assigneeId,
          assignmentVersion:assigneeId?1:0, dueDate:index===3?null:new Date(Date.now()+(index===0?-3600000:(index+1)*7200000)) },
          include:{assignee:{select:{id:true,name:true}}} })
        await recordTaskChange(tx, actor.id, null, task, 'TASK_CREATED', 'DEMO')
        await tx.comment.create({data:{taskId:task.id,userId:actor.id,content:'Comentario sintético para explorar la colaboración.'}})
        // Demo sin avalancha: registrar los contextos de recordatorios como cancelados.
        if (task.dueDate && assigneeId) for (const kind of ['due_soon','overdue']) await tx.notificationJob.create({data:{kind,taskId:task.id,projectId:project.id,recipientId:assigneeId,dueDate:task.dueDate,
          dedupeKey:`${kind}:${task.id}:${assigneeId}:${task.dueDate.toISOString()}`,status:'cancelled',diagnostic:'DEMO_SUPPRESSED'}})
      }
    }
    await tx.demoSeed.create({data:{id:'portfolio-v1'}})
    return true
  }, {timeout:30000})
  console.log(created ? 'Demo creada: ana.demo@example.invalid, bruno.demo@example.invalid, carla.demo@example.invalid / SynkroDemo2026! (solo local)' : 'Demo ya cargada. No se modificaron registros ni contraseñas.')
} catch (error) { console.error(error.message); process.exitCode=1 }
finally { await db.$disconnect() }
