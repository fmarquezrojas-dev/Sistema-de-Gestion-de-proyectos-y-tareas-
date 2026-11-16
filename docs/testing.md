# Pruebas de SYNKRO

Los resultados históricos de los bloques 1 y 2 se conservan abajo. La sección final registra el bloque 3 y sus comandos actuales.

## Entorno y aislamiento

Verificado el 15 de noviembre de 2026 (America/Lima) con Node 22.14.0, npm 10.9.2 y PostgreSQL 17 en una instancia separada, host 127.0.0.1, puerto 55432. No se utilizó la base de desarrollo del usuario. Docker Desktop estaba detenido; las pruebas ejecutadas usaron PostgreSQL nativo.

El runner exige TEST_DATABASE_URL con usuario y base `synkro_test`, host localhost/127.0.0.1, puerto 55432, protocolo postgresql y sin query/fragment. Rechaza otros destinos antes de ejecutar Prisma. Sobrescribe DATABASE_URL con ese destino, fija NODE_ENV=test y claves JWT sintéticas. El setup vuelve a verificar ambas URL y la suite verifica current_database()/current_user antes de limpiar. No basta con NODE_ENV.

La suite elimina proyectos/usuarios **solo de esta base desechable** antes de cada caso; no guardes datos reales ahí. Nunca ejecuta reset, force-reset, accept-data-loss ni elimina volúmenes. Desde el bloque 2, el runner usa migrate deploy. Para la antigua base de pruebas sin historial, compara el esquema con prisma/baseline/schema.prisma y solo si coincide marca el baseline como aplicado. El repositorio ahora contiene baseline y migración aditiva de sesiones.

## Instalación (PowerShell, raíz del repositorio)

```powershell
npm ci --prefix backend
npm ci --prefix frontend
npm run prisma:generate --prefix backend
```

## PostgreSQL de pruebas: elegir una opción

Con PostgreSQL 17 instalado en Windows, los siguientes comandos reproducen la instancia aislada usada en esta entrega. Si ya está iniciada, omite initdb/start/createdb y pasa a validación. El directorio contiene solo datos sintéticos de pruebas.

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$testPg = Join-Path $env:TEMP 'synkro-block1-pg'
if (!(Test-Path -LiteralPath $testPg)) {
    & "$pgBin\initdb.exe" -D $testPg -U synkro_test -A trust --encoding=UTF8 --locale=C
}
& "$pgBin\pg_ctl.exe" -D $testPg -l (Join-Path $testPg 'server.log') -o '-p 55432 -h 127.0.0.1' start
& "$pgBin\createdb.exe" -h 127.0.0.1 -p 55432 -U synkro_test synkro_test
$env:TEST_DATABASE_URL = 'postgresql://synkro_test@127.0.0.1:55432/synkro_test'
```

Alternativa con Docker Desktop iniciado, sin usar docker-compose.yml del proyecto:

```powershell
docker run --name synkro-test-postgres -d -p 127.0.0.1:55432:5432 -e POSTGRES_USER=synkro_test -e POSTGRES_PASSWORD=synkro_test -e POSTGRES_DB=synkro_test postgres:17
docker exec synkro-test-postgres pg_isready -U synkro_test -d synkro_test
$env:TEST_DATABASE_URL = 'postgresql://synkro_test:synkro_test@127.0.0.1:55432/synkro_test'
```

Espera a que pg_isready confirme disponibilidad. No ejecutes ambas opciones en el mismo puerto. La variante Docker se documenta como alternativa; no se ejecutó en esta sesión.

## Validación

```powershell
npm test --prefix backend
npm test --prefix frontend
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend

# Lint acotado a frontend modificado, sin ocultar el resultado global:
Push-Location frontend
npx eslint src/components/KanbanBoard.tsx src/components/TaskComments.tsx src/pages/ProjectDetail.tsx src/pages/Tasks.tsx src/services/api.ts src/services/errors.ts src/types/index.ts src/hooks/useTaskStatus.ts src/tests vitest.config.ts
Pop-Location

git diff --check
```

El runner backend primero comprueba el destino, verifica tipos de src/tests con tsconfig.test.json, prepara el esquema y ejecuta Vitest/Supertest sobre app.ts y las rutas reales. Prisma no está simulado. Las pruebas frontend usan Testing Library/jsdom y simulan respuestas HTTP para controlar rechazos y respuestas pendientes.

## Resultados reales

| Comprobación | Antes | Después |
| --- | --- | --- |
| Backend build | No había cliente Prisma generado en esta instalación | Aprobado tras prisma:generate |
| Frontend build | Fallaba TS6133: handleDeleteComment sin uso | Aprobado |
| Backend tests | Sin infraestructura | 13 aprobadas |
| Frontend tests | Sin infraestructura | 7 aprobadas |
| Frontend lint global | 106 errores, 4 advertencias | 46 errores, 1 advertencia |
| Lint de frontend modificado | No se medía por separado | Aprobado |
| Backend lint | No existe script | No se incorporó una configuración general |

Los 46 errores y la advertencia restantes están en AuthContext, ThemeContext, useApi, Dashboard, Login, Profile, Projects y Register, archivos no modificados. No se desactivaron reglas para obtener un resultado favorable. npm también reportó vulnerabilidades de dependencias al instalar; su revisión integral queda pendiente y no se ejecutó audit fix/force.

La primera ejecución backend detectó una expectativa incorrecta en una prueba: al salir de A se esperaba dashboard sin actividad, pero B seguía accesible. Se corrigió la expectativa para exigir solo actividad de B. Los resultados aprobados corresponden a la suite corregida, no a esa primera ejecución.

## Cobertura

Usuarios sintéticos: OWNER A, MEMBER A sin permisos, MEMBER A con creación, MEMBER A con edición y externo OWNER B. Desde el bloque 2 los usuarios sintéticos tienen ADMIN global persistido y obtienen sesiones mediante login HTTP para comprobar que no concede bypass.

- Matriz de tareas/proyectos/miembros y estado por PUT/PATCH.
- Comentarios ajenos, autor/moderador y sustitución del taskId.
- Asignación externa, ausencia/null y fecha anulable.
- Retirada con conservación de tareas/comentarios, desasignación por proyecto y accesos personales revocados.
- Resumen SQL autorizado y bloqueado para externos.
- Cuenta propietaria y retiro de otro OWNER bloqueados; salida propia MEMBER y borrado de cuenta sin propiedad.
- Payload autenticado, IDs, enums, paginación, contenido y propiedades privilegiadas.
- Ocho rondas de solicitudes HTTP simultáneas de creación/asignación/retiro con PostgreSQL real, comprobando que no quedan asignaciones al exmiembro.
- Guard de base de datos con destinos inseguros.
- Frontend: reversión aislada, conservación de otro cambio exitoso, error visible, bloqueo de estado/arrastre, 404, comentario de MEMBER/moderación OWNER, revocación en pantalla y recarga tras retirar miembro.

## Recorrido manual por roles

Este recorrido queda preparado para ejecutarlo en navegador; no se afirma una inspección visual manual en esta entrega.

1. Registrar cinco usuarios de demo con correos ficticios. OWNER crea A; otro usuario crea B. OWNER añade a los otros tres a A.
2. Como OWNER, activar solo creación a uno y solo edición a otro. Crear una tarea con responsable y vencimiento.
3. Como MEMBER sin permisos, comprobar consulta/comentarios y selectores deshabilitados. Como creador, crear pero no editar. Como editor, editar/cambiar estado pero no eliminar tareas ni administrar miembros.
4. Desde otra sesión OWNER revocar edición. Volver a la pestaña del editor: al recuperar foco se actualizan los controles. Un intento con permisos antiguos debe mostrar el rechazo del backend.
5. Como OWNER retirar al responsable: desaparece de miembros y de la asignación visible; la tarea y comentarios permanecen. El exmiembro ya no accede por Mis tareas, dashboard ni URL directa.
6. Intentar borrar la cuenta OWNER: ver el mensaje de conflicto. Probar moderación de comentarios como OWNER y eliminación propia como MEMBER.
7. Repetir en ventana estrecha y escritorio; verificar formularios, comentarios y Kanban. La prueba jsdom no reemplaza esta revisión visual.

## Detener la instancia de pruebas

Después de las verificaciones, sin borrar datos ni volúmenes:

```powershell
# Opción PostgreSQL nativo:
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D (Join-Path $env:TEMP 'synkro-block1-pg') stop
# Opción Docker (solo si la usaste):
docker stop synkro-test-postgres
```


## Bloque 2 — Resultados actuales

Referencia ejecutada antes de editar: 13 pruebas backend, 7 frontend y ambos builds aprobados; lint global con 46 errores y 1 advertencia.

Resultado final del bloque 2:

| Verificación | Resultado real |
| --- | --- |
| Backend TypeScript y Vitest/Supertest/PostgreSQL | 28 aprobadas |
| Frontend Vitest/Testing Library | 17 aprobadas |
| Playwright Chromium con API y PostgreSQL reales | 3 aprobadas |
| Build backend/frontend | Aprobados |
| Lint de lógica afectada de autenticación | Aprobado |
| Lint global frontend | 34 errores y 1 advertencia heredados |
| git diff --check | Aprobado |

Las 28 incluyen las 12 de autorización del bloque 1, el guard de base, 14 de sesiones y una de migración. Las 17 frontend incluyen las 7 de colaboración y 10 de autenticación. No se eliminaron ni relajaron casos para aceptar tokens sin sesión: las fixtures del bloque 1 ahora inician sesión por HTTP.

Los errores globales restantes corresponden a ThemeContext (sin cambios), Dashboard y Projects (solo import actualizado de useAuth). No se desactivaron reglas. Backend no tiene script lint general; se ejecutó TypeScript estricto para código y tests.

Pruebas nuevas: hash único sin token crudo, expiración absoluta, límites del JWT, consumo/reemplazo, reutilización con revocación confirmada pese al 401, refresh simultáneo por conexiones reales, sesión desconocida/expirada/revocada, claims y firma, logout idempotente/aislado con Bearer expirado, cambio de contraseña y carrera con login, Origin ausente/no permitido, atributos Secure/httpOnly/Strict/path/borrado y 429 en las cuatro rutas.

La carrera login/contraseña mantiene bloqueada la fila del usuario desde una conexión adicional, verifica dos conexiones esperando el bloqueo y luego libera; el estado final no admite sesiones activas de la contraseña anterior. No usa mocks de Prisma.

La prueba de migración crea un esquema PostgreSQL sintético dentro de una transacción, ejecuta baseline, inserta usuario/proyecto/tarea, aplica la migración y verifica que permanecen. Termina con rollback; no modifica la instalación real.

## Ejecutar el bloque 2 (PowerShell, raíz)

Con la instancia aislada descrita arriba disponible:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://synkro_test@127.0.0.1:55432/synkro_test'
npm ci --prefix backend
npm ci --prefix frontend
npm run prisma:generate --prefix backend
npm test --prefix backend
npm test --prefix frontend
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend

Push-Location frontend
npx playwright install chromium
Pop-Location
npm run test:e2e --prefix frontend

Push-Location frontend
npx eslint src/context/AuthContext.tsx src/context/authState.ts src/services src/hooks/useApi.ts src/components/PrivateRoute.tsx src/components/Navbar.tsx src/pages/Login.tsx src/pages/Register.tsx src/pages/Profile.tsx src/tests/authentication.test.tsx e2e playwright.config.ts scripts/e2e.mjs
Pop-Location
git diff --check
```

El runner configura claves sintéticas y orígenes de prueba sin modificar .env. El E2E requiere ejecutar primero npm test --prefix backend para preparar migraciones. Usa puertos 3001/5174 y rechaza reutilizar servidores existentes. Crea usuarios sintéticos únicos en synkro_test; las siguientes pruebas backend limpian esa base protegida. No ejecutar pruebas backend destructivas de fixtures simultáneamente con E2E.

Playwright inicia y detiene sus servidores. Access TTL de 4 segundos solo para E2E; se espera 4,2 segundos para probar expiración real. Backend usa reloj controlado o fechas persistidas, sin esperar quince minutos/siete días. No se guardan traces, vídeos, screenshots ni storageState con cookies/tokens.

Los recorridos de navegador verifican: recarga, cookie compartida/httpOnly, ausencia de tokens persistidos, una sola renovación entre dos pestañas, logout propagado, descarte de refresh en vuelo desde otra pestaña y cambio de contraseña comunicado. Se ejecutaron en Chromium headless; no se verificaron Firefox/Safari/Edge ni un despliegue HTTPS real. Secure se comprobó mediante HTTP de pruebas con configuración de producción.

## Recorrido manual de dos pestañas

1. Aplicar la migración según authentication.md y configurar JWT_SECRET/orígenes; iniciar backend/frontend de desarrollo. Los usuarios del bloque 1 deben iniciar sesión otra vez.
2. Entrar con un usuario sintético; abrir Dashboard y Proyectos en dos pestañas del mismo origen/perfil del navegador.
3. Recargar una pestaña: ver inicialización y luego sesión recuperada. DevTools debe mostrar refreshToken httpOnly en cookies y ningún accessToken/user en localStorage/sessionStorage. El único marcador de autenticación persistido es una generación no secreta.
4. En un entorno de prueba, configurar ACCESS_TOKEN_TTL_SECONDS=4 antes de arrancar backend. Esperar expiración y solicitar datos desde ambas pestañas: las peticiones deben recuperarse coordinadamente.
5. Cerrar sesión en una pestaña: ambas deben perder perfil/acceso. Recargar la otra no debe restaurar la sesión.
6. Iniciar sesión otra vez y cambiar contraseña: ambas pestañas deben volver a login con el mensaje correspondiente. La contraseña anterior debe fallar.
7. Simular red caída durante refresh: debe mostrarse error temporal/resultado incierto, sin rotación repetida ni bucle de navegación. Usar el camino explícito a login o reintentar cierre.

El flujo equivalente se automatizó en Chromium; este recorrido queda disponible para revisión humana. No se afirma una inspección visual manual ni una prueba de instalación completa.


## Bloque 3: resultados ejecutados

Verificado localmente con la misma instancia aislada PostgreSQL 17, Node 22.14.0 y Chromium headless. No se usó la base de desarrollo, ni se publicaron cambios.

| Comprobación | Resultado |
| --- | --- |
| Backend Vitest/Supertest/PostgreSQL | 39 aprobadas (28 anteriores + 11 nuevas) |
| Frontend Vitest/Testing Library | 29 aprobadas (17 anteriores + 12 nuevas) |
| Playwright Chromium/API/PostgreSQL | 4 aprobadas (3 anteriores + colaboración con dos usuarios distintos) |
| Build backend/frontend y tipos de tests backend | Aprobados |
| ESLint de archivos afectados del bloque 3 | Aprobado |
| ESLint global frontend | 34 errores y 1 advertencia heredados en ThemeContext, Dashboard y Projects |
| git diff --check | Aprobado |

La suite backend nueva cubre versión inicial, cambios de los seis campos y actor, no-op, comentario independiente, precondiciones inválidas/ausentes, rechazo de version directo, autorización previa a revelar conflictos, eliminación, desasignación por retirada/cuenta, eventos antiguos y paginación. Una restricción CHECK temporal en la base sintética provoca fallo real al insertar historial: se verifica 500 genérico, versión/datos intactos y ausencia de evento; la restricción se retira en finally.

Tres carreras mantienen una fila de tarea bloqueada desde una tercera conexión; pg_stat_activity debe observar al menos dos conexiones esperando FOR UPDATE antes de liberar. Compiten edición/estado, edición/retirada y edición/eliminación. Se verifica ganador, conflicto o recurso eliminado, versión final e historial. Esto encontró y permitió corregir el SQLSTATE 40001 emitido por Prisma como P2010 desde bloqueos explícitos. No son peticiones secuenciales ni mocks de Prisma.

La prueba de migración existente aplica también task_versions sobre un esquema con usuario/proyecto/tarea previos y comprueba version=1 y conservación de los datos. Termina con rollback. No se alteran migraciones aplicadas previamente.

Las pruebas de interfaz cubren expectedVersion inicial y siguiente, conservación/descarte explícito del borrador, confirmación separada de reaplicación, foco del aviso, 403/404, una petición pendiente por tarea, conflictos aislados, respuestas/consultas tardías, resultado incierto sin reintento de escritura, bloqueo tras perder permisos y actividad con texto seguro, carga, error/reintento, vacío y paginación. El E2E inicia dos contextos con Ana y Bruno, abre ambos formularios antes del primer guardado, comprueba 409 real, revisión, segundo guardado e historial con ambos actores/versiones. No se simula la API en E2E.

### Comandos exactos (PowerShell, raíz)

Con la instancia aislada de la sección inicial disponible:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://synkro_test@127.0.0.1:55432/synkro_test'
npm run prisma:generate --prefix backend
npm test --prefix backend
npm test --prefix frontend
npm run build --prefix backend
npm run build --prefix frontend
Push-Location backend
npx tsc -p tsconfig.test.json
Pop-Location
npm run test:e2e --prefix frontend

Push-Location frontend
npx eslint src/components/TaskActivity.tsx src/components/KanbanBoard.tsx src/hooks/useTaskStatus.ts src/pages/Tasks.tsx src/pages/ProjectDetail.tsx src/services/taskState.ts src/services/api.ts src/types/index.ts src/tests/task-concurrency.test.tsx src/tests/collaboration.test.tsx e2e/task-concurrency.spec.ts
Pop-Location
npm run lint --prefix frontend
git diff --check
```

Si Chromium no está instalado, ejecutar previamente `npx playwright install chromium` desde frontend. Backend tests y E2E deben ejecutarse secuencialmente: comparten únicamente la base sintética y las fixtures backend la limpian. No se relajaron los casos de autorización/sesión previos; sus helpers de mutación ahora aportan la versión actual del fixture. Las pruebas nuevas de concurrencia usan deliberadamente la misma versión inicial en ambos contendientes.

La migración y el recorrido manual con dos integrantes están en [task-concurrency.md](task-concurrency.md). Los límites de retención por cascada se prueban/documentan expresamente. No se verificaron otros navegadores, SMTP, Docker Compose completo ni instalación/despliegue productivo.


## Entrega A–D — 16 de noviembre de 2026

Resultados finales locales: 51 backend (39 anteriores + 12 notificaciones), 29 frontend, 7 Python, 4 E2E Chromium. Builds backend/frontend y lint frontend global aprobados. La deuda anterior de 34 errores/1 advertencia fue corregida sin desactivar reglas. `npm audit --omit=dev --audit-level=high` aprobado en ambos paquetes; audit completo conserva deuda de desarrollo documentada en operations.md.

```powershell
$env:TEST_DATABASE_URL = 'postgresql://synkro_test@127.0.0.1:55432/synkro_test'
npm ci --prefix backend
npm ci --prefix frontend
npm run prisma:generate --prefix backend
npm run build --prefix backend
npm test --prefix backend
npm run lint --prefix frontend
npm run build --prefix frontend
npm test --prefix frontend
npm run test:e2e --prefix frontend
python -m venv notification-service/.venv
notification-service/.venv/Scripts/python.exe -m pip install -r notification-service/requirements.txt
Push-Location notification-service
.venv/Scripts/python.exe -m unittest -v
Pop-Location
```

No ejecutar suites backend destructivas de fixtures mientras E2E o integración SMTP usan la misma base sintética. Generación/migraciones de producción siguen el instalador y no los tests.

SMTP integrado: levantar Mailpit local aislado en puertos 51025/58025 y ejecutar desde raíz:

```powershell
docker run -d --name synkro-mailpit-test -p 127.0.0.1:58025:8025 -p 127.0.0.1:51025:1025 axllent/mailpit:v1.27.10
node backend/scripts/notification-integration.mjs
```

El runner valida la base sintética, crea usuarios/tarea por API y comprueba intención con Python apagado, recuperación, mensaje real, ausencia de duplicado y unknown sin reenvío. No apuntar a datos reales: prepara otras fixtures para impedir correo ajeno. CI usa Mailpit como service y SYNKRO_TEST_PYTHON=python. En Windows el ejecutable predeterminado es el venv local.

Instalador: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-installation.ps1` crea un snapshot de archivos versionados/no ignorados del árbol local, sin dependencias ni secretos, en una ruta con espacios/Unicode. Usa proyecto synkro-clean-test y puertos 53011/55174/58027. Conserva snapshot/volumen para inspección y detiene servicios al finalizar. No es un clon de un commit publicado porque los cambios siguen locales.

Recorrido Compose: con configuración de prueba synkro-release-test y puertos 53010/55173/58026, ejecutar `node scripts/portfolio-check.mjs` desde frontend. Usa usuarios sintéticos distintos, SMTP, permisos, conflicto, historial, teclado Kanban, exclusión de completada y revocación. Captura escritorio 1440×1000, tablet 820×1180 y móvil 390×844; comprueba navegación móvil y ausencia de desbordamiento horizontal. No detener/reconstruir ese mismo Compose mientras corre el recorrido.

La prueba check-demo.mjs se ejecuta exclusivamente en Compose sintético con SYNKRO_DEMO_CHECK=local-synthetic: modifica una tarea, crea un proyecto manual y comprueba que dos cargas demo conservan conteos, historial, contraseña y edición. Se comprobó después de reiniciar que proyecto/tarea manuales permanecen.

Casos negativos ejecutados: configuración incompleta, motor inaccesible mediante DOCKER_HOST de prueba, puerto ajeno ocupado; todos fallan sin modificar configuración ni matar procesos. Migración contra base sintética no vacía sin baseline devuelve error y conserva tabla/marcador. No se apagó globalmente Docker durante esta prueba porque tenía otros proyectos activos; sí se detectó motor apagado al iniciar la sesión. Se conservó la instalación habitual.

Fallos encontrados y corregidos: SQL de reclamo con comparación temporal tipada, incompatibilidad de ExitCode de Start-Process/PowerShell 5.1, navbar móvil sin clases CSS y mensaje incorrecto para miembros que pueden editar pero no crear. Una prueba coincidió con npm update y falló EBUSY; se repitió tras terminar instalación. Un recorrido coincidió con parada del Compose y falló ECONNREFUSED; se repitió sin operaciones concurrentes de infraestructura. No se alteraron aserciones para esconder esos fallos.

GitHub Actions está configurado en .github/workflows/ci.yml sin continue-on-error. No fue ejecutado remotamente: no se hizo push. El informe completo está en release-readiness.md.
