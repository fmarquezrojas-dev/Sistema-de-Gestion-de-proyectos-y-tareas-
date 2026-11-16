# Propuesta de primera entrega: v1.0.0

Propuesta para revisión, no tag ni release publicada. Se consultaron tags locales/remotos: no existen. Los manifiestos raíz/backend ya indican 1.0.0; frontend conserva su versión interna 0.0.0. Se propone v1.0.0 para la entrega de portafolio del sistema, sin alterar automáticamente los manifiestos.

## Producto

SYNKRO permite coordinar proyectos, miembros, tareas, responsables, fechas y comentarios con permisos por proyecto. Esta entrega reúne la implementación local completa sobre el commit inicial 54b84ad.

- Permisos de creación/edición, moderación y aislamiento entre proyectos.
- Sesiones persistidas y revocables, refresh rotativo y coordinación de pestañas.
- Versionado de tareas, precondición expectedVersion, conflictos que conservan borradores e historial transaccional.
- Kanban con teclado y reconciliación de errores por tarea.
- Notificaciones de asignación/vencimiento mediante PostgreSQL y worker Python/SMTP; Mailpit local, deduplicación, leases y revisión de resultados inciertos.
- Instalador Windows, demo sintética idempotente, healthchecks, pruebas y CI.

## Instalación local

Docker Desktop con contenedores Linux y PowerShell 5.1 o posterior:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\synkro.ps1 -Accion Instalar
.\iniciar_proyecto.bat -Accion Demo
```

Iniciar/Detener/Estado/Actualizar usan `iniciar_proyecto.bat -Accion NOMBRE`. Actualizar no hace git pull. URLs por defecto: 5173 interfaz, 3000 API y 8025 Mailpit, solo loopback.

## Migración y configuración

Se incluyen baseline y migraciones aditivas de sesiones, versiones/historial, trabajos de notificación y marcador de demo. Instalaciones antiguas sin historial Prisma requieren el baseline descrito en authentication.md. No usar reset ni borrar volúmenes. Las sesiones anteriores requieren nuevo login y clientes de tareas deben enviar expectedVersion.

Conservar credenciales de bases inicializadas. Secretos de JWT/servicio independientes; SMTP/Cloudinary externos opcionales. El instalador solo genera configuración cuando falta y no existe el volumen correspondiente. Ver installation.md y operations.md.

## Verificación y límites

Resultados y enlaces CI se registran en release-readiness.md; no considerar aprobado CI antes de su ejecución remota. Capturas reales en docs/screenshots. La entrega local no certifica producción, rendimiento ni disponibilidad.

SMTP accepted no garantiza entrega final; unknown requiere revisión, sin reenvío automático. Historial sujeto a cascadas, sin WebSockets ni purga automática de sesiones/trabajos. Quedan verificaciones externas y deuda de herramientas de desarrollo. No publicar tag/release hasta revisar el PR, CI y estos límites.
