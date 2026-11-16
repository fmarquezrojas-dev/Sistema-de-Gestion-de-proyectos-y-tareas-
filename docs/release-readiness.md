# Estado de entrega local — SYNKRO

Fecha: 16 de noviembre de 2026, America/Lima. Referencia base revisada: `54b84ad35beccc4621da399c8f5a71675e319613` más los commits de la rama `release/synkro-portfolio` que reúnen los bloques 1–4 y operación. Se prepara push autorizado de esa rama y PR en borrador hacia main; no se publica tag, release ni imágenes. Los cambios anteriores se preservan.

## Completado y verificado

- A: trabajos durables, asignaciones transaccionales, recordatorios, reclamación/leases, SMTP Python, Mailpit, reintentos/unknown y CLI administrativa. 12 tests backend, 7 Python e integración SMTP real.
- B: regresión 51 backend y 29 frontend, 4 E2E Chromium; builds y lint global pasan. Auditoría de dependencias de producción sin hallazgos en la ejecución. Actualizaciones dentro de rangos existentes, sin audit fix --force.
- C: instalador Windows PowerShell 5.1/Compose, configuración nueva con secretos, archivos existentes conservados, migraciones deploy, salud, URLs, operación/demo. Instalación en snapshot limpio sin node_modules/venv en ruta con espacios/Unicode, segundo arranque, reinstalación, actualización, parada/reinicio y demo repetida.
- Datos manuales: tarea editada, proyecto añadido, contraseña y conteos conservados al repetir demo y reiniciar. Volúmenes sintéticos separados; base habitual no migrada.
- D: recorrido real de dos usuarios con proyecto, miembro/permisos, asignación/correo, consulta sin edición, habilitación, conflicto/reaplicación, historial, teclado Kanban, completada sin recordatorios y retirada con 404. Sesiones/refresh/logout/cambio de contraseña cubiertos por los E2E separados.
- Interfaz: capturas reales de escritorio/tablet/móvil y revisión de captura móvil. Corregidos menú superpuesto y aviso de permisos impreciso. Comprobados teclado, mensajes/carga/vacío mediante pruebas de componentes; no es una auditoría integral de accesibilidad.
- Casos negativos: configuración incompleta, motor inaccesible simulado, puerto ajeno y migración fallida conservando marcador. Código no cero y sin borrado. Al inicio se observó Docker apagado y se inició Desktop; no se apagaron proyectos ajenos para probar fallos.

## Implementado, pendiente de verificación externa

- GitHub Actions: configurado con lockfiles, PostgreSQL/Mailpit de tests, Prisma, builds, lint, suites Python/frontend/backend, SMTP y E2E; **sin ejecución remota comprobada**.
- SMTP externo y Cloudinary: configuración/guardas disponibles, no se utilizaron credenciales ni destinatarios reales.
- Entorno HTTPS productivo, cookies en navegador sobre TLS y navegadores no Chromium no verificados en esta entrega.

## Pendientes y límites

- Audit completo de herramientas de desarrollo conserva avisos moderados y críticos, incluidos Vitest/tinypool; política CI bloquea alta/crítica en producción, no declara todo el árbol libre de vulnerabilidades. Resolver majors de tooling requiere trabajo separado.
- No hay verificación de restauración completa de respaldo, carga/rendimiento, alta disponibilidad ni certificación. El procedimiento de respaldo está documentado; no se promete rollback automático.
- sent significa aceptación SMTP. unknown no se reenvía automáticamente; requiere evidencia y resolución humana. Existe carrera entre comprobación final y aceptación SMTP.
- No hay purga automática/retención programada de trabajos o sesiones. ActivityLog sigue sujeto a cascadas. Imágenes base por etiqueta, no digest fijado.
- La prueba de instalación limpia usa snapshot del árbol local, no un clon remoto de un release aún inexistente. El fallo de migración se probó con el mismo comando deploy contra una base sintética; no se introdujo una migración inválida en el repositorio.

## Entorno y evidencia

Windows, PowerShell 5.1, Node 22.14.0/npm 10.9.2, Python 3.13.17, PostgreSQL 17 nativo aislado y PostgreSQL 15 en Compose, Compose 5.6.1, Chromium headless. Código: Express 5.3.0, React 19.3.1, Prisma 5.22.0, TypeScript 5.9.3, Vite 7.3.8; Python fijado en requirements.txt.

Scripts reproducibles: backend/scripts/notification-integration.mjs, backend/scripts/check-demo.mjs, frontend/scripts/portfolio-check.mjs, scripts/test-installation.ps1. Capturas docs/screenshots. Comandos y límites de pruebas en testing.md.

**Estado:** funcionalidad de portafolio local implementada y verificada. Para declarar entrega remota validada falta ejecutar CI sobre un commit publicado voluntariamente; para producción faltan las verificaciones operativas/externas anteriores. No se declara “todo funciona” fuera del alcance comprobado.


## Preparación para revisión en GitHub

Repositorio comprobado: https://github.com/fmarquezrojas-dev/Sistema-de-Gestion-de-proyectos-y-tareas-. origin coincide, base main 54b84ad, sin commits locales adicionales previos ni tags existentes. Propuesta v1.0.0 en release-notes.md; no se creó tag.

Se revisaron rutas a publicar y diff antes de staging: ejemplos, lockfiles, migraciones, pruebas, scripts y capturas sintéticas incluidos; .env reales, node_modules, venv, bases, logs y dumps excluidos. Búsqueda de tokens/llaves/URLs con credenciales no encontró secretos privados en la entrega. Los candidatos eran placeholders/variables o credenciales expresamente sintéticas de pruebas. El historial remoto contiene un antiguo backend/.env (d9002d0), eliminado en 54b84ad: se comprobó sin imprimir valores que sus JWT eran placeholders y la URL apuntaba a loopback con la contraseña demo del Compose original. No se reintroduce; si esos valores públicos se reutilizaron en otra instalación, deben rotarse allí. No se reescribió historia.

Correcciones de revisión: detener_proyecto.bat delega al mismo instalador y propaga errores; ejemplos Cloudinary vacíos para no aparentar una integración configurada. No se reconstruyeron los bloques ni reemplazaron archivos con versiones antiguas.

Estado CI remoto al preparar estos commits: pendiente de ejecución; se actualizará con enlace y resultado observado después del push.


Revalidación de la rama de entrega: backend build/tipos y 51 pruebas aprobadas; instalador Iniciar y check-demo ejecutados nuevamente en Windows/Compose aislado. Recorrido portfolio-check aprobado con correo real, edición concurrente y tres tamaños. Completadas nuevamente: frontend lint/build y 29 pruebas, Python 7 pruebas, 4 E2E Chromium e integración SMTP (Python apagado/recuperado, sin duplicados, unknown sin reenvío). Ambos npm audit de producción finalizaron sin hallazgos. CI remoto se comprueba después del push. Los comandos exactos se mantienen en testing.md. No se repitió instalación desde snapshot vacío en esta pasada: su evidencia anterior se conserva y se revalidó operación sobre la instalación sintética existente.

Revisi?n del diff completo contra main: se corrigieron espacios finales del esquema baseline. Quedan dos avisos de l?nea vac?a final en SQL de migraciones baseline/auth_sessions ya aplicadas durante pruebas; se preservaron sus bytes/checksums. No son fallos SQL. El diff de cambios de trabajo estaba limpio, pero eso no equivale al diff completo contra main.
