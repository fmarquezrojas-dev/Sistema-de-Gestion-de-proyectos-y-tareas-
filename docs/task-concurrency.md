# Edición concurrente e historial de tareas — bloque 3

Implementado sobre PostgreSQL, Prisma y la interfaz existente. Evita actualizaciones perdidas; no ofrece edición de texto simultánea ni WebSockets. Los cambios externos se conocen al consultar, recuperar foco, por polling (detalle cada 30 segundos; Mis tareas cada 60) o al recibir un conflicto.

## Versión y escritura atómica

Task.version es un entero persistido, obligatorio, inicialmente 1. Cada modificación efectiva de título, descripción, estado, prioridad, responsable o vencimiento incrementa una vez la versión. Lecturas, comentarios y envíos sin diferencias no la incrementan. Incluso un envío sin diferencias exige una versión coincidente. No se utiliza updatedAt como precondición.

El servicio autoriza primero dentro de la transacción SERIALIZABLE del bloque 1, toma SELECT FOR UPDATE sobre la tarea, comprueba expectedVersion y escribe con condición id/version e incremento atómico. Devuelve la representación de esa operación. La escritura de ActivityLog pertenece a la misma transacción: cualquier fallo revierte ambos cambios. Los reintentos internos de transacciones abortadas conservan la precondición original y vuelven a autorizar; nunca aceptan silenciosamente una nueva versión. Se reintenta hasta tres veces P2034 y P2010 con SQLSTATE 40001/40P01. Otros errores de Prisma no se convierten en conflictos de versión; agotamiento de serialización devuelve el 409 genérico previo del proyecto.

Dos escrituras efectivas sobre una misma versión no pueden tener éxito ambas. La perdedora recibe TASK_VERSION_CONFLICT, o 403/404 si perdió acceso o desapareció el recurso. Desde la entrega de notificaciones, la intención de asignación se registra en esta misma transacción; SMTP ocurre después mediante worker (notifications.md).

## Contratos HTTP

Todas las rutas conservan autenticación de sesión y permisos por proyecto. Los cuerpos son JSON estrictos. expectedVersion es obligatorio, entero positivo hasta 2147483647. Se rechazan version y campos ajenos a la lista editable. Los clientes anteriores que omitan la precondición reciben 400.

| Ruta | Cuerpo / respuesta |
| --- | --- |
| POST /api/tasks/project/:projectId | Campos de creación habituales; devuelve data con version: 1. No acepta version/expectedVersion. |
| PUT /api/tasks/:id | expectedVersion y campos editables presentes; ausencia conserva el valor. Devuelve data con tarea y versión resultantes. |
| PATCH /api/tasks/:id/status | Solo status y expectedVersion; misma semántica de actualización. |
| DELETE /api/tasks/:id | JSON con expectedVersion. Solo OWNER. Devuelve el mensaje de éxito existente. |
| GET /api/tasks/:id | data con version, relaciones públicas y permisos efectivos. |
| GET /api/tasks/:id/activity?page=1&limit=20 | data y pagination: page, limit, total, totalPages. Solo miembros actuales. Página 1–1000000, límite 1–50. |

Las listas por proyecto, Mis tareas y detalle de proyecto también incluyen version. assigneeId:null desasigna; dueDate:null elimina vencimiento; las fechas no nulas se envían ISO con zona horaria.

Ejemplo de actualización:

```json
{ "expectedVersion": 4, "title": "Preparar propuesta", "priority": "HIGH" }
```

Si la versión vigente es 5, el error contiene (currentTask abreviado aquí):

```json
{
  "error": "Esta tarea cambió mientras la estabas editando",
  "code": "TASK_VERSION_CONFLICT",
  "currentVersion": 5,
  "currentTask": { "id": 42, "version": 5, "title": "Propuesta revisada" }
}
```

No se devuelve información de conflicto a terceros: 401 para sesión inválida, 403 para miembro sin permiso, 404 para inexistencia o falta de membresía. Validación devuelve 400. Un fallo interno sigue siendo 500 genérico.

Axios transmite la precondición de eliminación en el cuerpo, compatible con Express:

```typescript
await api.delete(`/tasks/${task.id}`, { data: { expectedVersion: task.version } })
```

## Formulario y Kanban

El formulario conserva una instantánea inicial y un borrador independiente del polling. Solo envía los campos cambiados y la versión inicial. Ante 409 conserva el texto, enfoca el aviso y permite comparar todos los valores actuales. «Cargar versión actual y descartar mis cambios» es explícito. «Revisar y reaplicar mis cambios» aplica únicamente los campos modificados al recurso actual y exige pulsar «Confirmar cambios revisados». Puede aparecer un nuevo conflicto si otro usuario vuelve a editar durante la revisión. No existe bypass ni botón de forzado.

El cambio de estado en lista/Kanban es optimista por tarea; se permite una sola petición simultánea por tarea. El servidor proporciona la versión siguiente. Un 409 reconcilia únicamente esa tarea y anuncia el conflicto. 403 restaura el estado y deshabilita edición; 404 retira la tarea inaccesible. Las respuestas se combinan por versión y se descartan consultas anteriores o iniciadas durante mutaciones; el rechazo de una tarea no revierte otras.

Kanban conserva @dnd-kit y añade selectores nativos en «Cambiar estado con teclado». No persiste orden dentro de columnas. Los estados de guardado y errores se anuncian mediante status/alert. El formulario enfoca título/aviso al abrir o resolver un conflicto; al cerrarlo devuelve foco al control de edición disponible.

Si se pierde una respuesta de escritura, puede haberse confirmado en el servidor. El tablero intenta una lectura de reconciliación; si también falla, mantiene el estado como incierto y bloquea modificaciones hasta usar el botón «Comprobar» de esa tarea. El formulario conserva el borrador y exige «Consultar estado actual», revisar y confirmar otra vez. La eliminación incierta requiere consultar antes de volver a eliminar. Ninguna de estas rutas repite automáticamente la escritura. Una caída de red durante refresh mantiene las reglas del bloque 2 y puede requerir nuevo login.

## Mutaciones indirectas e historial

Retirar un miembro usa el mismo servicio de desasignación, bloqueando tareas por id ascendente: cambia responsable a null, incrementa cada versión afectada y registra TASK_UNASSIGNED con actor OWNER y reason MEMBER_REMOVED. La membresía se elimina en esa misma transacción. Borrar una cuenta MEMBER hace lo equivalente con ACCOUNT_DELETED antes de borrar al usuario; la restricción de cuentas OWNER permanece. Un formulario anterior a la desasignación detecta conflicto. La serialización protege también la carrera entre una nueva asignación y una retirada.

No se encontraron scripts demo/seed que escriban tareas en el repositorio. Las fixtures de pruebas que usan Prisma directamente construyen estados sintéticos aislados; no son rutas de aplicación. Escrituras SQL manuales o futuras integraciones deben respetar este protocolo: no se añadieron triggers ni se garantiza versionar cambios hechos fuera de los servicios.

ActivityLog agrega previousVersion, resultingVersion, changes JSONB, actorName y reason opcionales. Conserva los campos previos, identificador del actor/proyecto/tarea y fecha generada por servidor. changes guarda pares before/after de campos realmente modificados; responsables guardan id y nombre, fechas ISO. Creación produce TASK_CREATED, completar TASK_COMPLETED, otras ediciones TASK_UPDATED. No-op/conflicto no generan evento. No se registran credenciales, cookies ni tokens.

Actividad muestra actor, fecha, versiones y diferencias con etiquetas españolas, como texto escapado por React. Tiene carga, vacío, error/reintento y páginas de diez. Eventos anteriores sin changes se muestran como «Evento antiguo» con su descripción, sin reconstruir valores inexistentes. La consulta ordena createdAt DESC, id DESC y usa índice compuesto. La paginación por desplazamiento tiene orden determinista, pero inserciones entre páginas pueden desplazar resultados; no es una instantánea permanente.

**Límite de retención real:** las relaciones existentes de ActivityLog con User, Project y Task son onDelete:Cascade. Borrar una tarea o proyecto elimina sus eventos; borrar una cuenta elimina los eventos de ese actor, incluido el evento ACCOUNT_DELETED recién escrito. Los eventos de otros actores sobre tareas conservadas permanecen. actorName mantiene un nombre histórico mientras existe el evento, no evita la cascada. No se cambió la política global de borrado ni se promete auditoría inmutable/certificada.

## Migración no destructiva (PowerShell)

20261115000200_task_versions añade una columna con DEFAULT 1 para tareas existentes, cinco columnas opcionales de historial y un índice; no recrea tablas ni rellena diferencias históricas. Se verificó sobre datos previos en un esquema sintético con rollback. En esta entrega se aplicó únicamente a synkro_test, no a la base de desarrollo del usuario.

Desde la raíz, con DATABASE_URL de la instalación configurada en backend/.env y los pasos de baseline del bloque 2 ya completados:

```powershell
Push-Location backend
npx prisma migrate status
npx prisma migrate deploy
npm run prisma:generate
Pop-Location
npm run build --prefix backend
npm run build --prefix frontend
```

Una base existente sin historial de Prisma necesita primero el [baseline no destructivo](authentication.md); no usar migrate reset/db push ni marcar migraciones nuevas como aplicadas sin ejecutarlas. Desplegar frontend/backend juntos: el contrato de escritura exige expectedVersion. Los comandos y preparación de la base aislada de pruebas están en [testing.md](testing.md).

## Recorrido manual con dos integrantes

1. Iniciar los servicios, crear usuarios Ana y Bruno. Ana crea proyecto/tarea, invita a Bruno y habilita canEditTasks.
2. Usar perfiles de navegador distintos o ventana normal/incógnita; iniciar sesión con un usuario diferente en cada contexto. Ambos abren la misma tarea en «Editar tarea» antes de guardar.
3. Ana cambia título y guarda. Bruno escribe otro título y guarda: debe ver el conflicto y conservar su texto.
4. Bruno consulta la versión actual, pulsa «Revisar y reaplicar mis cambios», revisa los campos y confirma. Abrir Actividad: ambos autores y cambios aparecen con versiones consecutivas.
5. Repetir y elegir descartar: solo cambia el formulario; no hay escritura automática. Revocar el permiso de Bruno mientras edita y comprobar que el siguiente guardado conserva el borrador y bloquea envío.
6. En Mis tareas, mover una tarea y observar «Guardando» y el bloqueo de nuevos movimientos; probar el selector con teclado. Cortar red durante guardado: consultar estado antes de reintentar. Una modificación de otra tarea debe conservarse.

El recorrido de dos usuarios está automatizado y fue ejecutado en Chromium headless con API/PostgreSQL reales. No se afirma una inspección visual humana, otros navegadores ni despliegue productivo. Estado histórico del cierre del bloque 3. Bloque 4 e instalador se implementaron después; consultar release-readiness.md.
