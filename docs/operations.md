# Operación y recuperación

Usar los comandos de [installation.md](installation.md). Detener hace compose stop y conserva contenedores/volúmenes. Actualizar trabaja sobre código ya descargado: revisar cambios con git diff, respaldar y actualizar Git por separado; el instalador no hace pull/reset. Reiniciar no carga demo.

## Respaldo antes de actualizar

Desde raíz, con `.env` configurado; el dump se crea dentro del contenedor para evitar corrupción binaria por redirección de PowerShell 5.1:

```powershell
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/synkro-backup.dump'
docker compose cp db:/tmp/synkro-backup.dump .\synkro-backup.dump
```

Guardar el dump fuera del repositorio y protegerlo: contiene datos y hashes. Para `-Config`, añadir `--env-file RUTA` a Compose. Probar restauración en otra base antes de confiar en un respaldo. No hay rollback automático de esquema; la recuperación requiere código compatible y restauración revisada por el operador. No restaurar sobre una base activa sin plan explícito.

## Diagnóstico

`Estado` valida configuración y muestra salud. API `/health/live` prueba proceso; `/health/ready` consulta DB. Python `/health/live` no certifica SMTP. Mailpit permite verificar aceptación real; no entrega fuera de este entorno. Para revisar logs: `docker compose logs --tail 100 backend notification-service`. Nunca compartir `.env`, inspect completo ni compose config expandido.

Errores de construcción/migración devuelven fase y código no cero; el script evita imprimir salida que pueda incluir secretos. Para diagnosticar una migración, ejecutar `docker compose run --rm --no-deps backend npx prisma migrate status` localmente. P3005 requiere baseline, contraseña incorrecta requiere recuperar credencial original, puerto ocupado requiere cambiar puertos o detener voluntariamente el servicio propio.

Notificaciones failed/unknown: [procedimiento administrativo](notifications.md). Nunca reclasificar unknown como no enviado sin evidencia. sent significa aceptación SMTP. No se garantiza entrega final ni eliminación de un mensaje ya aceptado. El lease es 120s, reintentos conocidos máximo cinco; tareas eliminadas o contexto inválido se cancelan al preparar.

No hay limpieza automática de trabajos/sesiones antiguas. Definir retención según uso. Los IDs de trabajos sobreviven al borrado de entidades para diagnóstico, sin cuerpos de correo ni email persistidos en el trabajo. ActivityLog conserva cascadas existentes.

## Dependencias y calidad

Instalación desde lockfiles; actualizaciones realizadas dentro de rangos semver existentes. CI bloquea vulnerabilidades altas/críticas de dependencias de producción mediante npm audit --omit=dev --audit-level=high. No usa continue-on-error ni audit fix --force. Audit completo detecta deuda de herramientas de desarrollo (incluido Vitest/tinypool); no se actualizaron majors automáticamente. No exponer servidor UI de Vitest, ni usar dependencias de desarrollo como servicio público. Esto limita el alcance del resultado de audit, no es certificación de seguridad.

Las imágenes base usan etiquetas de versión, no digests inmutables; lockfiles fijan dependencias de aplicación. Repetibilidad funcional local verificada, no garantía de bits idénticos. Cloudinary, SMTP externo, HTTPS productivo y entrega final fuera de Mailpit no se verificaron.

Variables nuevas: NOTIFICATION_INTERNAL_SECRET (Node/Python), NODE_API_URL, FRONTEND_URL, SMTP_HOST/PORT/FROM/STARTTLS/USER/PASSWORD, NOTIFICATION_INTERVAL_SECONDS y NETWORK_TIMEOUT_SECONDS. Compose usa COMPOSE_PROJECT_NAME, POSTGRES_USER/DB/PASSWORD y BACKEND_PORT/FRONTEND_PORT/MAILPIT_PORT. Nunca publicar sus valores secretos.
