SYNKRO — Gestión de Proyectos & Microservicios
SYNKRO es una plataforma Fullstack diseñada para la gestión colaborativa de equipos. A diferencia de un simple CRUD, el sistema implementa una arquitectura de microservicios, seguridad avanzada con rotación de tokens y un motor de reglas de acceso (RBAC) granular por proyecto.

🛠️ Core Stack
Frontend: React 18, TypeScript, Vite, Context API, @dnd-kit (Kanban).

Backend Principal: Node.js, Express, TypeScript, Prisma ORM.

Microservicio: Python 3.10, FastAPI, APScheduler (Notificaciones asíncronas).

Base de Datos: PostgreSQL (Queries nativas con $queryRaw para analíticas).

Infraestructura: Docker & Docker Compose (4 servicios orquestados).

Storage: Cloudinary SDK (Gestión de assets).

🏗️ Arquitectura y Decisiones Técnicas
El proyecto se rige bajo una arquitectura en capas estricta (Routes → Middlewares → Controllers → Services → Prisma), garantizando que la lógica de negocio esté aislada de la infraestructura.

🔐 Seguridad & Auth
Estrategia de Doble Token: Implementación de Access Token (15m) y Refresh Token (7d) en cookies httpOnly.

Interceptores de Axios: Renovación automática de sesión transparente para el usuario ante respuestas 401.

RBAC Dinámico: Los permisos no son globales; se definen por membresía de proyecto (OWNER, MEMBER) con banderas granulares como canEditTasks.

⚡ Optimización y UI
Tablero Kanban: Implementado con @dnd-kit con actualizaciones optimistas en el cliente para latencia cero percibida.

Zero-Lib Dark Mode: Sistema de temas basado puramente en CSS Custom Properties y data-themes, evitando el overhead de librerías externas.

Dashboard de Alto Rendimiento: Uso de agregaciones SQL nativas para calcular KPIs y actividad reciente sin sobrecargar el ORM.

📦 Estructura del Ecosistema

├── backend/               # Node.js API (Arquitectura Layered)
├── frontend/              # React SPA (Pattern: Context + Hooks)
├── notification-service/  # Python (Polling & SMTP)
├── docker-compose.yml     # Orquestación de infraestructura
└── iniciar_proyecto.bat   # Script de despliegue rápido