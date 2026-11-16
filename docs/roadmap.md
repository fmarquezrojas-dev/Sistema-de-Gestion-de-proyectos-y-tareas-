# Hoja de ruta de SYNKRO

## Bloque 1 — Permisos y colaboración segura

Implementado y verificado localmente. Identidad tipada, política central por proyecto, autorización de tareas/comentarios/resúmenes, integridad transaccional de responsables y retirada de miembros, bloqueo de propietarios, validación, interfaz por permisos y pruebas reales con PostgreSQL.

Resultado histórico al cerrar el bloque 1: 13 pruebas backend y 7 frontend aprobadas; ambos builds pasaban. El lint global tenía 46 errores y 1 advertencia heredados. Ese bloque no cambió el esquema. Los resultados actuales y la migración de sesiones figuran en el bloque 2 y testing.md.

## Bloque 2 — Sesiones revocables y rotación real

Implementado y verificado localmente.

- AuthSession y RefreshToken mediante migración aditiva, con baseline para el esquema anterior.
- Refresh opaco de 256 bits; solo hash SHA-256 en base; rotación atómica y detección estricta de reutilización.
- Vencimiento absoluto de siete días por defecto, access máximo quince minutos y nunca posterior a la sesión.
- Logout idempotente por cookie; cambio de contraseña revoca todas las sesiones, coordinado con login mediante bloqueos de usuario.
- Revocación inmediata: consulta de sesión/usuario en cada petición, sin caché.
- Access/perfil en memoria; recuperación al recargar; Web Locks, BroadcastChannel y generación no secreta para coordinación y descarte de respuestas tardías.
- Cookie httpOnly, Secure en producción, SameSite=Strict; Origin obligatorio, CORS explícito y límites por IP.
- 28 pruebas backend, 17 frontend y 3 recorridos Chromium de dos pestañas aprobados. Ambos builds pasan.
- Lint de lógica modificada de autenticación aprobado. Lint global conserva 34 errores y 1 advertencia heredados en ThemeContext y secciones no modificadas de Dashboard/Projects (solo cambió su import de useAuth).

Las sesiones antiguas requieren nuevo login. Migración aplicada solo a la base de pruebas. Documentación y procedimientos en authentication.md y testing.md. Quedan las limitaciones documentadas: resultado incierto de refresh requiere nuevo acceso, limitadores por instancia, sin limpieza automática de sesiones vencidas, verificación de navegadores distinta de Chromium pendiente.

## Bloque 3 — Edición concurrente y trazabilidad

Implementado y verificado localmente.

- Migración aditiva: Task.version con valor inicial 1 y diferencias estructuradas opcionales en ActivityLog.
- expectedVersion obligatorio para edición, estado y eliminación; autorización anterior al conflicto, bloqueo de fila y escritura condicional SERIALIZABLE.
- Desasignación por retirada de miembro o eliminación de cuenta versionada; comentarios no incrementan versión.
- Formulario conserva borrador y exige revisión/confirmación explícita sobre la versión actual.
- Kanban con una mutación pendiente por tarea, reconciliación de conflictos, resultados inciertos y descarte de respuestas obsoletas; alternativa con teclado.
- Historial transaccional paginado, actor, valores antes/después, compatibilidad con eventos antiguos y límites de cascada documentados.
- 39 pruebas backend, 29 frontend y 4 E2E Chromium aprobados. Incluye conexiones PostgreSQL realmente solapadas, fallo de historial con rollback y dos usuarios de navegador distintos.
- Builds y lint de archivos afectados aprobados. El lint global mantiene los 34 errores y 1 advertencia heredados.

Migración aplicada solo a la base aislada de pruebas. Sin WebSockets, auditoría inmutable ni cambios en retención. Procedimientos en [task-concurrency.md](task-concurrency.md) y [testing.md](testing.md).

## Bloque 4 — Notificaciones y estabilización

Completado y verificado localmente: registro durable PostgreSQL, asignaciones transaccionales, recordatorios deduplicados, reclamos atómicos, SMTP real Python/Mailpit, resultados inciertos y administración local. Lint global corregido, dependencias actualizadas dentro de rangos existentes, builds/regresiones aprobados. [CI remoto aprobado sobre a6eda70](https://github.com/fmarquezrojas-dev/Sistema-de-Gestion-de-proyectos-y-tareas-/actions/runs/43892056352).

## Entrega final — Instalación y operación local

Implementada y verificada en Windows PowerShell 5.1 y Compose aislado: instalar/iniciar/detener/estado/actualizar/demo, secretos nuevos sin sobrescritura, migraciones deploy, conservación de volumen histórico, healthchecks, demo idempotente y capturas reales.

No se migró la instalación habitual. Se probó un snapshot limpio del árbol local pendiente de commit, no un clon de un commit publicado. Casos y alcance exactos en release-readiness.md.

## Pendientes explícitos

- Resolver deuda de dependencias de desarrollo que requiere decisiones de actualización mayor.
- Validar SMTP externo, Cloudinary y despliegue HTTPS si se pretende producción.
- Otros navegadores, carga/rendimiento, retención automática y restauración de respaldos fuera del alcance comprobado.

La entrega funcional está implementada y CI remoto aprobado. La aprobación de producción permanece pendiente.
