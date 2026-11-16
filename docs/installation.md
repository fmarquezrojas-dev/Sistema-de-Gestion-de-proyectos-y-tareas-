# Instalación local Windows

Requisitos: Windows PowerShell 5.1 o PowerShell 7, Docker Desktop iniciado con contenedores Linux y Compose v2 o posterior. No exige Node/Python globales para operación normal. Probado con PowerShell 5.1, Docker Desktop y Compose 5.6.1. Internet se necesita para descargar imágenes/dependencias.

Desde la raíz del repositorio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\synkro.ps1 -Accion Instalar
.\iniciar_proyecto.bat -Accion Demo
```

ExecutionPolicy Bypass afecta solo ese proceso, no cambia la política del equipo. `iniciar_proyecto.bat` es lanzador del mismo script, sin instaladores alternativos. `-SinNavegador` omite abrir la interfaz.

El script resuelve rutas desde su ubicación, verifica Docker/Compose, motor Linux, archivos, configuración y puertos. Construye imágenes con npm ci/pip fijado, espera PostgreSQL, aplica `prisma migrate deploy`, inicia servicios y espera salud/HTTP antes de abrir navegador. Hay tiempos máximos por fase y código no cero al fallar. No ejecuta migrate dev/reset, git pull, down -v ni prune.

Una instalación nueva crea `.env` desde `.env.example` una sola vez y genera tres secretos criptográficos: contraseña PostgreSQL, JWT_SECRET y NOTIFICATION_INTERNAL_SECRET. No los imprime ni regenera. La configuración existente incompleta se conserva y se informa la variable faltante. Los valores de usuario/base/contraseña de PostgreSQL deben usar caracteres URI seguros (letras, números, guion o guion bajo) para el DATABASE_URL local.

## Instalación anterior con datos

Se conserva el proyecto Compose histórico `sistema_gestion_proyectos_tareas` y volumen `postgres_data`, PostgreSQL 15. No cambiar el nombre del proyecto para “arreglar” un error: crearía otra instalación. Si existe el volumen y falta `.env`, el script se detiene antes de generar contraseña. Copia `.env.example`, conserva usuario/base/contraseña originales y completa secretos. Cambiar POSTGRES_PASSWORD en un archivo no cambia la contraseña de una base inicializada.

Antes de migrar una base antigua sin historial Prisma, seguir el baseline no destructivo de [authentication.md](authentication.md). Una instalación con tablas existentes sin baseline puede fallar con P3005; no resolverlo borrando tablas. Las migraciones de esta entrega son `20261116000000_notification_jobs` y `20261116000100_demo_marker`, aditivas. La base habitual del usuario no fue migrada en la verificación.

## Comandos

```powershell
.\iniciar_proyecto.bat -Accion Iniciar
.\iniciar_proyecto.bat -Accion Detener
.\iniciar_proyecto.bat -Accion Estado
.\iniciar_proyecto.bat -Accion Actualizar -SinNavegador
.\iniciar_proyecto.bat -Accion Demo
```

URLs predeterminadas: http://localhost:5173, API http://localhost:3000, Mailpit http://localhost:8025. Solo se publican en loopback; DB/SMTP/Python no se publican al host. Un puerto ajeno ocupado produce error; no se mata ningún proceso. Puertos BACKEND_PORT, FRONTEND_PORT, MAILPIT_PORT configurables en `.env`; cambiar frontend/backend exige Actualizar para reconstruir la URL integrada en la SPA.

`-Config C:\ruta\config.env` selecciona otra configuración. `-ProyectoNuevo nombre` se usa únicamente al crear un archivo nuevo. Para pruebas se utilizaron synkro-release-test (53010/55173/58026) y synkro-clean-test (53011/55174/58027), con volúmenes separados.

## Demo

Demo explícita: dos proyectos, tres usuarios, permisos distintos, tareas en tres estados, sin responsable, vencidas/futuras, comentarios e historial. Credenciales exclusivamente locales:

- ana.demo@example.invalid
- bruno.demo@example.invalid
- carla.demo@example.invalid
- Contraseña inicial compartida: `SynkroDemo2026!`

Un marcador transaccional y bloqueo asesor hacen idempotente la carga. Repetirla no duplica, restablece contraseñas ni modifica tareas editadas. Si hay cuentas demo sin marcador, se detiene para no apropiarse de datos anteriores. Los contextos iniciales de recordatorio quedan cancelados para evitar avalanchas; una asignación nueva desde UI permite probar Mailpit. No usar estas credenciales en producción.

Cloudinary es opcional: sin configurar, subir avatar responde 503 legible y permanecen inicial/color. SMTP local no requiere credenciales externas. Producción necesita revisión separada de HTTPS, cookies Secure, secretos, correo, respaldo y endurecimiento.

Se inspeccionó iniciar_proyecto.bat y el script local de pruebas de Facturly: rutas por PSScriptRoot, argumentos estructurados, comprobación de exit code. No se encontraron instaladores de DataBridge/Facturly que pudieran afirmarse revisados como modelo completo.
