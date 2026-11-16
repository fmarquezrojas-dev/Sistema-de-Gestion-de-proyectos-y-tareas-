# Autorización por proyecto — bloque 1

En el bloque 2 la identidad autenticada se amplió a `{ userId, sessionId, email, role }`. El middleware verifica claims JWT y sesión persistida; email/role provienen del usuario en PostgreSQL. La política de proyectos del bloque 1 no cambia. Véase [authentication.md](authentication.md). Express incorpora ese tipo y los controladores obtienen el actor mediante `actorId(req)`. El cuerpo nunca determina la identidad del solicitante.

## Matriz de acceso

| Operación | OWNER | MEMBER | Usuario externo / exmiembro |
| --- | --- | --- | --- |
| Consultar proyecto, tareas y resumen | Sí | Sí | 404 |
| Crear tareas | Sí | Solo con canCreateTasks | 404 |
| Editar tarea, reasignar, cambiar estado | Sí | Solo con canEditTasks | 404 |
| Eliminar tareas | Sí | 403 | 404 |
| Editar/eliminar proyecto, agregar miembros, cambiar permisos | Sí | 403 | 404 |
| Retirar otro miembro MEMBER | Sí | 403 | 404 |
| Salir del proyecto | 409 | Sí | 404 |
| Retirar cualquier OWNER | 409 | 403 | 404 |
| Consultar y añadir comentarios | Sí | Sí, sin permisos de edición | 404 |
| Borrar comentario propio | Sí | Sí | 404 |
| Borrar comentario ajeno | Sí | 403 | 404 |

ADMIN global no concede acceso al contenido. El antiguo `checkProjectRole.ts` incluía un bypass opcional por defecto, pero no tenía consumidores activos y utilizaba `user.id` en vez de `userId`. Se retiró junto con el middleware de membresía redundante; no se amplió esa política.

## Implementación y rutas

`services/projectAccess.ts` concentra membresía, propietario, permisos de creación/edición, resolución de tarea por su proyecto real y validación de responsables. Los servicios autorizan también cuando se invocan fuera de un controlador. Las escrituras colaborativas usan su helper transaccional.

Rutas montadas en `app.ts`:

- `/api/projects`: lista/creación; `/:id`: detalle, edición y eliminación.
- `/api/projects/:id/members`, `/:memberId`, `/:userId/permissions`: administración y salida propia.
- `/api/tasks/project/:projectId`: consulta y creación.
- `/api/tasks/:id`: consulta, edición, eliminación; `/:id/status`: cambio de estado.
- `/api/tasks/:taskId/comments` y `/:commentId`: única implementación activa de comentarios, ahora con servicio propio.
- `/api/tasks/my-tasks`, `/api/dashboard`, `/api/dashboard/project/:projectId/summary`.
- `/api/auth/profile/stats` y `/api/auth/account`.

Se conservan las URL de comentarios de los consumidores existentes. Antes había dos implementaciones: la activa en task.controller y otra sin montar en comment.controller. Se consolidaron mediante el router anidado, sin acceso directo a Prisma desde los controladores de negocio.

Un comentario solo se elimina si pertenece al taskId de la URL. Una tarea se resuelve por su projectId persistido; enviar otro projectId en el cuerpo falla con 400. El resumen autoriza antes del SQL y además restringe membresía en la consulta. Se reemplazó la llamada a `get_project_summary`, cuya definición no estaba versionada, por una agregación parametrizada autocontenida. Devuelve un arreglo con project_id, project_name, total_tasks, pending_tasks, in_progress_tasks y completed_tasks. No había consumidores de ese resumen en el frontend local.

## Asignaciones, concurrencia y propiedad

`assigneeId: null` desasigna. Ausencia de assigneeId en una edición conserva el valor. Un número debe identificar a un miembro actual del mismo proyecto. `dueDate: null` limpia el vencimiento; la ausencia conserva la fecha. Creación sin responsable o fecha deja ambos nulos.

Retirar un miembro desasigna únicamente sus tareas de ese proyecto y elimina su membresía en la misma transacción. Conserva tareas, comentarios y actividad. Las lecturas personales, estadísticas y actividad del dashboard comprueban membresía actual incluso si existen asignaciones heredadas inválidas.

Las mutaciones de tareas, comentarios, proyectos, miembros y eliminación de cuenta usan PostgreSQL SERIALIZABLE. La comprobación de membresía y la escritura pertenecen a la misma transacción. La retirada lee/escribe asignaciones y membresía; la asignación lee membresía y escribe tareas. PostgreSQL detecta conflictos; el servicio reintenta hasta tres veces (cuatro intentos totales) P2034 y, para bloqueos SQL explícitos, P2010 con SQLSTATE 40001/40P01. Agotados los intentos devuelve 409. La intención durable de asignación se guarda en el callback; la entrega SMTP ocurre después en el worker del bloque 4. Desde el bloque 3, el historial de tareas está dentro de la transacción y los abortos revierten también sus eventos.

El bloque 1 no añadió tablas, índices ni migraciones. Los bloques 2 y 3 añaden migraciones para sesiones y versionado/historial, sin triggers. La integridad colaborativa depende de estos servicios: escrituras manuales o futuras rutas deben aplicar el mismo protocolo. No se reparan masivamente asignaciones históricas en esta entrega.

Se bloquea retirar a cualquier OWNER, incluso si hay varios propietarios en la base. Eliminar una cuenta con proyectos propios devuelve 409 y un mensaje accionable. No se borran proyectos automáticamente. Una cuenta MEMBER puede borrarse con contraseña: sus tareas se desasignan y se eliminan sus registros de adjuntos antes de borrar el usuario; se mantienen las cascadas existentes del esquema. La transferencia de propiedad no se implementa.

## Validación y errores

Zod valida IDs enteros positivos hasta el máximo Int de PostgreSQL, estados/prioridades, comentarios recortados de 1–5000 caracteres, títulos de 2–200, descripciones hasta 10000, booleanos y fechas ISO con zona horaria. Página: 1–1000000; límite: 1–100; por defecto 1 y 50. Cuerpos de tareas, proyectos, comentarios y permisos son estrictos: no aceptan propiedades privilegiadas adicionales.

- 401: autenticación ausente/inválida.
- 403: miembro sin permiso.
- 404: recurso inexistente o fuera del ámbito accesible.
- 409: conflicto de propiedad, duplicado, relaciones activas, concurrencia agotada o TASK_VERSION_CONFLICT por versión obsoleta de tarea.
- 400: validación; se conserva `error` legible y se añade `errors` cuando procede.
- 500: error interno genérico, sin detalles de Prisma ni stack al cliente.

## Frontend

ProjectDetail deriva permisos de membresía, reserva eliminación a OWNER y permite comentar a todo miembro. Actualiza datos al retirar miembros, al recuperar foco, cada 30 segundos y anuncia rechazos de autorización sin descartar borradores abiertos. Mis tareas recibe canEdit/canModerateComments efectivos del backend y refresca al recuperar foco y cada 60 segundos.

Kanban y selectores deshabilitan cambios sin permiso. Una mutación optimista por tarea puede estar pendiente; un rechazo restaura solo su estado, conserva otras tareas y muestra el error. Un 403 deshabilita edición y un 404 retira el recurso visible. Las recargas iniciadas antes de una mutación no reemplazan su resultado. Desde el bloque 3, edición/estado/eliminación requieren expectedVersion y el 409 de versión conserva el borrador o reconcilia la tarea. Contratos completos en [task-concurrency.md](task-concurrency.md).

La interfaz conserva Context API, estilos y diseño existentes. La actualización visual de permisos entre sesiones depende de foco/polling/rechazos; no hay WebSockets. El backend aplica la autorización en cada solicitud.

## Hallazgos de la inspección local

| Hallazgo de referencia | Estado encontrado | Resolución del bloque 1 |
| --- | --- | --- |
| Crear/editar solo exige membresía | Confirmado | Permisos efectivos exigidos en servicio |
| Middleware granular desconectado | Confirmado | Sustituido por política central en servicios |
| Variantes id/userId y casts any | Confirmado | userId único, payload validado, actorId tipado |
| Consultar/crear comentarios sin membresía | Confirmado en task.controller activo | Servicio autorizado y router consolidado |
| Eliminación sin vínculo commentId/taskId | Confirmado | Consulta conjunta por ambos IDs y moderación |
| Agregar miembros/editar proyecto sin OWNER | Confirmado | OWNER obligatorio |
| Resumen SQL sin actor | Confirmado; función SQL tampoco versionada | Actor obligatorio, autorización previa y SQL autocontenido |
| Mis tareas filtra solo por asignado | Confirmado, también en estadísticas/vencimientos | Filtros de membresía actual y actividad restringida |
| Responsable de otro proyecto admitido | Confirmado | Validación transaccional del responsable |
| Cuenta propietaria puede borrarse | Confirmado por ausencia de guard; cascada de membresías | 409 y transacción, sin borrar proyectos |

La consulta individual de tareas/proyectos y la eliminación de proyectos ya restringían membresía/propiedad. Se conservaron esas protecciones y se probaron por HTTP. La salida propia de OWNER ya estaba bloqueada, pero no se protegía retirar a otro OWNER ni se desasignaban las tareas de un miembro retirado.
