# Notificaciones

Node administra NotificationJob en PostgreSQL; Python solo usa el contrato interno para reclamar, preparar y confirmar entregas. No accede a tablas de negocio. La intención de asignación se guarda en la transacción de tarea/historial. Python apagado no la pierde. No se incrementa Task.version al procesar correo.

Eventos: assigned (asignación real, no autoasignación), due_soon (0 < vencimiento - ahora <= 24h), overdue (vencimiento <= ahora). Fechas ISO/UTC conservan el instante capturado por la interfaz local; los correos indican el offset ISO. Sin fecha solo se admite asignación. Tarea completada, responsable inexistente/no miembro y proyecto PAUSED/COMPLETED se excluyen al preparar. Sin responsable no hay trabajo. Autoasignación no genera assigned para evitar ruido; sí puede generar recordatorios.

assignmentVersion cambia únicamente cuando cambia el responsable, incluidas desasignaciones indirectas. Evita enviar una asignación antigua si el responsable sale y vuelve. Dedupe assigned: tarea/contexto de asignación; recordatorios: tipo/tarea/destinatario/fecha ISO. Cambiar título no crea nuevos recordatorios. Volver exactamente al mismo vencimiento reutiliza su contexto ya notificado.

El planificador recorre lotes de 100 tareas por id, con cursor, cada 15 segundos. La restricción única evita duplicados incluso con dos planificadores. PostgreSQL reclama con FOR UPDATE SKIP LOCKED; límite HTTP 10, worker local 1 para no retener lotes durante SMTP. Cada reclamo cambia un UUID y aumenta intentos. Lease 120 segundos. Prepare comprueba elegibilidad y marca sendingAt una sola vez; no se mantienen bloqueos durante SMTP. Puede haber carrera entre esta última comprobación y aceptación SMTP: un correo aceptado no puede retirarse.

Estados: pending → processing → sent/failed/unknown/cancelled. Fallos temporales conocidos vuelven a pending con 30s, 60s, 120s, 240s de espera; quinto fallo termina failed. Fallos permanentes terminan failed. Lease vencido termina unknown conservadoramente, aun si no se alcanzó SMTP. unknown no se reenvía automáticamente. Confirmación del mismo resultado/reclamo es idempotente; token antiguo no modifica otro reclamo. Confirmación tardía de un lease unknown puede registrar su resultado conocido si ningún administrador lo resolvió.

SMTP 250 significa aceptado por servidor, no entrega final ni lectura. Timeout/desconexión durante DATA es unknown. Error conocido antes de transmitir puede reintentarse. Python reintenta la confirmación HTTP tres veces sin repetir SMTP. Message-ID estable facilita trazabilidad, no garantiza deduplicación del servidor. No se promete exactly-once.

Contrato POST /api/internal/notifications: /plan {afterId}, /claim {limit}, /:id/prepare {claimToken}, /:id/complete {claimToken,result,diagnostic}. X-Synkro-Service exige NOTIFICATION_INTERNAL_SECRET independiente (mínimo 32), comparación de hashes constante; Origin se rechaza, sin CORS, cuerpos estrictos de 4KiB, diagnósticos enumerados. No queda endpoint público de envío arbitrario. La clave viaja solo en entorno/cabecera y no se registra.

FastAPI inicia una única tarea periódica en lifespan, la detiene esperando el ciclo y cierra HTTP. SMTP bloqueante corre en thread con timeout por operación de 5 segundos; cierre sin QUIT evita reinterpretar una aceptación. /health/live indica proceso vivo, no SMTP; /health/status expone resultado del último ciclo, no promete disponibilidad SMTP. No hay puerto Python publicado en Compose.

Plantillas multipart texto/HTML escapado, asunto fijo por tipo, proyecto/título/fecha/enlace al proyecto. Direcciones y Message-ID validados; ningún título controla cabeceras. SMTP externo opcional exige STARTTLS con credenciales. Mailpit recibe mensajes locales sin relay externo. No se registran cuerpos ni destinatarios en errores.

## Administración local

Desde backend (o compose exec -T backend node scripts/notifications.mjs):

```powershell
node scripts/notifications.mjs list
node scripts/notifications.mjs confirm-sent UUID "Aceptación corroborada en Mailpit"
node scripts/notifications.mjs confirm-not-sent UUID "Servidor confirmó rechazo antes de aceptación"
node scripts/notifications.mjs retry UUID "Dependencia recuperada; fallo temporal confirmado"
```

confirm-not-sent requiere evidencia humana y deja failed; otro comando explícito retry lo habilita. retry solo admite failed de clase temporal. No convierte unknown automáticamente para reenviarlo. El motivo debe evitar datos personales. Acceso local a base equivale a privilegio administrativo.

Los trabajos conservan IDs numéricos sin FK para diagnosticar recursos eliminados; prepare los cancela si ya no existen. No guardan email ni texto de tarea, solo IDs/contexto/diagnóstico. No hay purga automática; un operador debe establecer retención acorde al uso. Historial de tareas mantiene sus cascadas previas.

Verificación: 12 pruebas PostgreSQL de notificaciones, 7 Python y SMTP Mailpit real, incluyendo Python apagado/recuperado y unknown sin reenvío. Implementación SMTP contrastada con la [documentación oficial de smtplib](https://docs.python.org/3/library/smtplib.html).
