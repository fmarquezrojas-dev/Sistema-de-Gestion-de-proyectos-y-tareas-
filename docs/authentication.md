# Autenticación de SYNKRO — bloque 2

Implementación local con sesiones PostgreSQL, access JWT en memoria y refresh opaco de un solo uso. Las reglas de proyecto del bloque 1 permanecen en los servicios.

**Los access y refresh tokens anteriores a esta entrega dejan de ser válidos. Todos los usuarios deben iniciar sesión nuevamente.**

## Flujos

```mermaid
sequenceDiagram
    participant UI as Navegador / memoria
    participant API as API Express
    participant DB as PostgreSQL
    UI->>API: POST /auth/login + Origin + credenciales
    API->>DB: Bloquear usuario, verificar contraseña
    API->>DB: Crear sesión y hash SHA-256 del refresh
    API-->>UI: Access JWT + perfil; Set-Cookie refresh httpOnly
    UI->>API: Petición Bearer
    API->>DB: Verificar sesión vigente y usuario existente
    API-->>UI: Recurso autorizado por membresía
    UI->>UI: Web Lock + comprobar token recibido de otra pestaña
    UI->>API: POST /auth/refresh + cookie + Origin
    API->>DB: Bloquear usuario y sesión, consumir hash, insertar reemplazo
    API-->>UI: Access nuevo + Set-Cookie hasta vencimiento absoluto
    UI->>API: GET /auth/me con Bearer nuevo
    UI->>UI: Compartir access/perfil por BroadcastChannel
    UI->>UI: Logout invalida generación y limpia memoria de todas las pestañas
    UI->>API: POST /auth/logout + cookie + Origin bajo Web Lock
    API->>DB: Revocar solo esa sesión
    API-->>UI: Borrar cookie
```

## Modelo y vencimiento

- AuthSession: UUID no predecible, userId, createdAt, expiresAt, revokedAt y revokeReason.
- RefreshToken: UUID, sessionId, tokenHash único, createdAt y consumedAt.
- Índices: PK de sesión; sesiones por usuario/revocación y vencimiento; refresh por hash único y por sesión.
- Cascada desde User a sesiones y desde sesión a refresh. El bloqueo de borrado de OWNER sigue vigente.
- Cada login crea una sesión independiente. Duración absoluta por defecto: 604800 segundos (7 días), configurable hacia abajo.
- Access: como máximo 900 segundos (15 minutos), limitado además al vencimiento de la sesión. La rotación no extiende expiresAt.
- El refresh contiene 32 bytes de randomBytes (256 bits), codificados base64url. Solo su SHA-256 se almacena. El valor crudo solo existe transitoriamente para Set-Cookie; no va en JSON, URLs ni logs.
- Los hashes consumidos se conservan para detectar reutilización. Actualmente no hay trabajo automático de limpieza de sesiones vencidas; esa retención puede crecer.

## Claims y revocación inmediata

JWT HS256 con userId, sessionId, purpose=access, iat, exp, issuer y audience. El middleware valida firma, algoritmo, claims, propósito, issuer y audience, luego consulta la sesión y su usuario. El actor tipado usa userId/sessionId; email y rol global se obtienen del usuario persistido. Los permisos por proyecto no se toman del JWT ni del cuerpo.

Cada petición autenticada tiene el coste de consultar la sesión por su PK y leer el usuario asociado. No hay caché de sesiones: después del commit de logout, reutilización o cambio de contraseña, las siguientes peticiones Bearer reciben 401 aunque exp aún no haya llegado. Esto no cancela operaciones de negocio que ya habían pasado el middleware antes de la revocación.

El middleware usa `code: SESSION_INVALID` en sus 401, antes de ejecutar controladores. El interceptor solo reenvía una petición de negocio tras ese rechazo. Los errores de contraseña dentro de un controlador no disparan una renovación.

## Rotación y concurrencia del servidor

Orden de bloqueos: usuario → sesión → refresh. Se usa FOR UPDATE en transacciones PostgreSQL READ COMMITTED. Login obtiene el usuario por email y vuelve a leer/verificar su contraseña después del bloqueo. El cambio de contraseña bloquea el mismo usuario antes de validar la actual, actualizar el hash y revocar todas sus sesiones.

Así, un login con la contraseña antigua que gana el bloqueo crea una sesión que el cambio posterior revoca; si el cambio gana primero, ese login falla. La suite fuerza la contención con una tercera conexión y comprueba ambos posibles órdenes mediante el estado final.

Refresh busca el hash, bloquea usuario/sesión y vuelve a leer el token. Consume el anterior e inserta el reemplazo dentro de la transacción. Si encuentra consumedAt, escribe revokedAt/revokeReason=REFRESH_REUSE y retorna un resultado de rechazo. **El 401 se lanza fuera de la transacción, después del commit**, para no revertir la revocación.

Dos refresh simultáneos con el mismo valor producen como máximo un reemplazo; la segunda solicitud detecta reutilización y revoca toda la sesión, incluido el reemplazo. No hay ventana de gracia. Un hash desconocido no identifica ni revoca sesiones ajenas.

Logout acepta la cookie incluso si el access expiró; es idempotente. No se exige Bearer ni se interpretan claims no verificados como alternativa. Revoca exclusivamente la sesión de un hash conocido y borra la cookie. Cambiar contraseña exige la actual, valida 8–72 caracteres y máximo 72 bytes UTF-8 (límite de bcrypt), y revoca todas las sesiones en la misma transacción que el nuevo hash.

## Contratos HTTP

| Endpoint | Entrada | Resultado |
| --- | --- | --- |
| POST /api/auth/login | email, password y Origin válido | data.accessToken, data.user; cookie |
| POST /api/auth/refresh | cookie y Origin válido | data.accessToken; cookie rotada |
| GET /api/auth/me | Bearer vigente | data con perfil público |
| POST /api/auth/logout | cookie y Origin válido | 200 idempotente; cookie borrada |
| PUT /api/auth/password | Bearer, Origin, currentPassword, newPassword | 200; todas las sesiones revocadas; cookie borrada |

No se expone hash de contraseña ni refresh en el perfil. Respuestas de autenticación: Cache-Control: no-store. Los endpoints existentes de registro, perfil, estadísticas, avatares y eliminación de cuenta se conservan.

## Cookie, CORS y Origin

Cookie refreshToken: httpOnly, host-only (sin Domain), Path=/api/auth, SameSite=Strict, Secure en producción y Expires igual al vencimiento absoluto de la sesión. Borrado con el mismo path y opciones. También se elimina la cookie heredada Path=/ del bloque 1.

Se soporta topología **same-site**: localhost en desarrollo o frontend/API HTTPS del mismo sitio en producción. Orígenes pueden ser distintos y deben figurar exactamente en AUTH_ALLOWED_ORIGINS, sin rutas ni comodines. No se soporta frontend y API en sitios diferentes con esta cookie Strict.

CORS usa lista explícita y credentials=true. Además login, registro, refresh, logout y cambio de contraseña verifican Origin: **ausente, null o no permitido se rechaza con 403**. Clientes de pruebas/CLI deben enviar un Origin configurado; CORS por sí solo no es la protección CSRF.

trust proxy permanece false. El limitador utiliza la IP del socket, no X-Forwarded-For. No activar proxies indiscriminadamente.

## Límites

Ventana fija en memoria por IP y endpoint, con expiración de entradas y límite de tamaño del mapa. Valores normales por 60 segundos: login 10, registro 5, refresh 120, cambio de contraseña 5. Exceso: 429 y Retry-After. No hay bloqueo duradero de cuentas por email ni coordinación entre réplicas. La instancia local es el alcance actual; varias réplicas necesitarían una decisión adicional.

## Cliente y varias pestañas

AuthContext conserva Context API y consume un store pequeño mediante useSyncExternalStore. El token y el perfil están solo en memoria; al inicializar se eliminan accessToken/user heredados de localStorage y sessionStorage. El perfil almacenado anteriormente nunca acredita una sesión.

Al recargar: estado initializing → refresh → GET /auth/me → authenticated. Un 401 termina en anonymous; red/servidor incierto produce error con explicación y acceso seguro a login. PrivateRoute no renderiza contenido privado hasta resolver la inicialización.

Una promesa compartida coordina 401 dentro de la pestaña. Cada petición se reintenta una sola vez; un 401 tardío aprovecha primero el token nuevo ya disponible. Login, registro, refresh, logout, password y account están excluidos de la renovación automática; 403 y errores de red no reenvían mutaciones.

Web Locks serializa operaciones que modifican la cookie entre pestañas. Tras adquirir el bloqueo, BroadcastChannel solicita el token actual a los pares y verifica si otra pestaña ya renovó. Si no recibe respuesta, la rotación sigue serializada: la cookie del reemplazo anterior ya se aplicó antes de liberar el bloqueo.

BroadcastChannel es del mismo origen y transmite únicamente access/perfil y eventos de sesión; nunca refresh. Un nonce no secreto, `synkro.auth.generation`, se guarda en localStorage para que incluso una respuesta tardía recibida antes del evento de otra pestaña pueda detectar un cierre. **Ese marcador no contiene tokens ni datos del usuario ni sirve como autenticación.**

Logout cambia la generación y limpia memoria antes de esperar el Web Lock; después revoca usando la cookie más reciente. Respuestas con otra generación se descartan. El cambio de contraseña comunica el fin de sesión a todas las pestañas. Un fallo al confirmar logout se muestra explícitamente y permite reintentar: no se afirma revocación del servidor si la red falló.

Navegadores soportados: navegadores modernos con Web Locks, BroadcastChannel, crypto.randomUUID y almacenamiento de origen disponible, en contexto seguro (HTTPS o localhost). Verificado en Chromium con Playwright; Firefox/Safari/Edge no se ejecutaron en esta entrega. Sin el mecanismo requerido, se permite login explícito pero no renovación ni recuperación automática: al necesitar acceso nuevo se solicita otro login. No hay fallback que lance refresh paralelos.

## Respuesta de refresh perdida

El servidor puede consumir el token y perderse la respuesta. El cliente no puede saber de forma fiable si la cookie fue sustituida. No repite ciegamente refresh: bloquea la recuperación automática para esa generación, comunica el estado y solicita nuevo login. Es una limitación deliberada de rotación estricta sin gracia. No se expone el refresh para recuperarlo.

## Configuración

| Variable | Normal / validación |
| --- | --- |
| NODE_ENV | development, test o production |
| JWT_SECRET | Requerida, al menos 32 caracteres; generar al menos 32 bytes aleatorios. Sin valor predeterminado |
| JWT_ISSUER / JWT_AUDIENCE | synkro-api / synkro-web; cadenas no vacías |
| ACCESS_TOKEN_TTL_SECONDS | 900, entero entre 1 y 900 |
| SESSION_TTL_SECONDS | 604800, entero entre 1 y 604800 |
| AUTH_ALLOWED_ORIGINS | Requerida, lista separada por comas de orígenes exactos |
| AUTH_RATE_WINDOW_SECONDS | 60, entero entre 1 y 3600 |
| AUTH_LOGIN_LIMIT / AUTH_REGISTER_LIMIT | 10 / 5, enteros positivos |
| AUTH_REFRESH_LIMIT / AUTH_PASSWORD_LIMIT | 120 / 5, enteros positivos |
| VITE_API_URL | Frontend: http://localhost:3000/api en desarrollo |

JWT_REFRESH_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN y FRONTEND_URL ya no controlan estos caminos. No se modificaron archivos .env locales. El ejemplo deja JWT_SECRET vacío a propósito: configura una clave segura fuera del control de versiones. Compose requiere JWT_SECRET mediante sustitución de entorno en lugar de una clave incluida en el archivo.

En producción configura NODE_ENV=production, secreto de un gestor de secretos, HTTPS y orígenes HTTPS exactos. Cookie Secure se activa automáticamente. Esto no convierte Compose ni el instalador pendiente en un despliegue de producción.

## Migración no destructiva (PowerShell)

Las migraciones son:
1. `20261115000000_baseline`: historial del esquema previo, para instalaciones vacías.
2. `20261115000100_auth_sessions`: aditiva; crea auth_sessions/refresh_tokens, índices y claves foráneas. No borra usuarios, proyectos ni tareas.

Configura backend/.env con DATABASE_URL de la instalación elegida y las variables anteriores. Conserva respaldo y configuración existentes. **No ejecutes migrate reset ni db push con aceptación de pérdida de datos.**

Instalación existente del bloque 1 sin historial Prisma:

```powershell
Push-Location backend
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/baseline/schema.prisma --exit-code
if ($LASTEXITCODE -ne 0) { throw 'El esquema no coincide con el baseline. Revisar diferencias; no resolver ni resetear.' }
npx prisma migrate resolve --applied 20261115000000_baseline
if ($LASTEXITCODE -ne 0) { throw 'No se pudo registrar el baseline.' }
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'Migración no aplicada.' }
npx prisma generate
Pop-Location
```

Usa ese resolve solo para la instalación previa cuyo esquema fue verificado. Si ya tiene historial de estas migraciones, o la base está vacía, basta con:

```powershell
Push-Location backend
npx prisma migrate deploy
npx prisma generate
Pop-Location
```

Luego compila/reinicia backend y frontend juntos. Las sesiones anteriores requieren nuevo login. En esta entrega solo se migró PostgreSQL de pruebas; no se aplicó la migración a tu base de desarrollo ni a producción. La suite verifica instalación desde vacío y conservación de datos sintéticos al añadir sesiones.
