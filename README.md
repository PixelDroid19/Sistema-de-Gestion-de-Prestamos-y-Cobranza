# Sistema de Gestion de Prestamos y Cobranza

Guia principal del proyecto para desarrollo, operacion local y evolucion tecnica.

## 1. Que es el sistema

Sistema de Gestion de Prestamos y Cobranza es una aplicacion web para gestionar el ciclo de credito y cobranza de una cartera de prestamos. El sistema cubre autenticacion por roles, originacion de creditos, asignacion de agentes, registro de pagos, notificaciones y reportes operativos.

El proyecto esta dividido en:

- `frontend/`: cliente React + Vite.
- `backend/`: API Node.js + Express + Sequelize sobre PostgreSQL.

Roles principales del negocio:

- `admin`: administra cartera, agentes, asociados y reportes.
- `agent`: trabaja prestamos asignados y actualiza estados de recuperacion.
- `customer`: consulta/solicita prestamos y registra pagos segun permisos del flujo.

## 2. Estado actual y alcance funcional

Estado actual: funcional, con backend recientemente reorganizado hacia un monolito modular y con validaciones de autorizacion/flujo re-verificadas.

Capacidades hoy presentes en el repositorio:

- autenticacion JWT y perfil de usuario
- gestion de clientes, agentes y asociados
- simulacion y creacion de creditos
- consulta de prestamos por contexto de usuario
- asignacion de agentes y actualizacion de `recoveryStatus`
- registro y consulta de pagos
- notificaciones del sistema
- reportes de recuperacion, recuperados y pendientes
- interfaz frontend para dashboard, loans, payments, agents y reports

No es un sistema completamente productizado todavia: hay mejoras pendientes en despliegue, consistencia documental y endurecimiento de infraestructura.

## 3. Arquitectura del sistema

### Vista general

```text
Frontend (React/Vite)
    |
    | HTTP + JSON + Bearer token
    v
Backend API (Express)
    |
    +-- Module registry
    +-- Auth middleware compartido
    +-- Modulos de dominio/aplicacion/presentacion
    |
    v
Sequelize Models -> PostgreSQL
```

### Frontend / backend

- El `frontend/` es una SPA en React 19 montada con Vite.
- El `backend/` expone la API REST, compone modulos y sincroniza esquema al arrancar.
- La comunicacion se hace via `VITE_API_URL` y token JWT en header `Authorization`.

### Backend como monolito modular

El backend corre como un solo proceso y una sola base de datos, pero internamente se organiza por modulos de negocio. No es una arquitectura distribuida ni microservicios; es un monolito modular con separaciones explicitas de responsabilidades.

Registro actual de superficies modulares:

- `auth` -> `/api/auth`
- `customers` -> `/api/customers`
- `credits` -> `/api/loans`
- `payouts` -> `/api/payments`
- `agents` -> `/api/agents`
- `associates` -> `/api/associates`
- `reports` -> `/api/reports`
- `notifications` -> `/api/notifications`

### Organizacion de `backend/`

```text
backend/
  scripts/              utilidades operativas locales
  src/
    app.js              configuracion base de Express
    server.js           arranque del servidor
    bootstrap/          validacion de entorno + sync/verificacion de esquema
    middleware/         auth, validaciones, etc.
    models/             modelos Sequelize y asociaciones
    modules/            modulos de negocio
    services/           servicios compartidos o de soporte
    utils/              logger, manejo de errores y helpers comunes
  tests/                pruebas de modulos, routers, schema y composicion
```

### Como se organiza cada modulo backend

El patron visible en los modulos nuevos es:

```text
modules/<modulo>/
  application/      casos de uso
  infrastructure/   repositorios/adaptadores
  presentation/     router HTTP y mapeo de requests/responses
  index.js          composicion del modulo
```

El modulo `credits` ademas expone seams internos (`composition.js` y `public.js`) para que otros modulos reutilicen capacidades sin volver a depender de servicios raiz ambiguos.

### Estado real de alineacion con Clean / Hexagonal

La alineacion existe, pero es parcial y pragmatica:

- si hay separacion entre casos de uso, infraestructura y presentacion en los modulos principales
- si hay composicion explicita via `create<Module>()`
- si existen puertos/seams internos reutilizados entre modulos (`credits/public`)
- no hay una pureza total de dominio aislado del framework/ORM
- Sequelize sigue siendo una dependencia estructural importante
- todavia hay servicios compartidos y modelos globales fuera de una frontera hexagonal estricta

En otras palabras: el backend ya no esta en el esquema antiguo de controllers/routes dispersos, pero tampoco pretende venderse como Clean Architecture pura.

## 4. Modulos principales del backend y responsabilidades

### `auth`

- registro y login
- emision/validacion de JWT
- consulta y actualizacion de perfil
- middleware de autenticacion compartido

### `customers`

- listado y alta de clientes
- repositorio de datos de cliente usado por otros flujos

### `agents`

- listado y alta de agentes
- soporte para asignacion operativa desde creditos

### `associates`

- CRUD de asociados
- relacion de asociado con prestamos

### `credits`

- simulacion de credito
- alta y consulta de prestamos
- consulta por cliente y por agente
- cambio de estado de prestamo
- asignacion de agente
- actualizacion de `recoveryStatus`
- borrado de prestamos segun politica de acceso

Es el modulo con mayor peso funcional y uno de los centros actuales del backend.

### `payouts`

- consulta global de pagos
- consulta de pagos por prestamo
- creacion/aplicacion de pagos

Consume puertos publicos de `credits` para respetar acceso y vista canonica del prestamo.

### `reports`

- prestamos recuperados
- prestamos pendientes
- reporte agregado de recuperacion

Tambien consume capacidades publicas de `credits` en lugar de depender de servicios legacy sueltos.

### `notifications`

- listar notificaciones
- marcar una o todas como leidas
- contador de no leidas
- limpiar notificaciones

## 5. Flujo de trabajo recomendado para el equipo

### Desarrollo local

1. configurar variables de entorno de backend y frontend
2. levantar PostgreSQL local o via Docker
3. instalar dependencias en `backend/` y `frontend/`
4. arrancar backend y frontend por separado
5. probar primero cambios acotados del modulo tocado y luego el suite backend completo si el cambio impacta flujos centrales

### Pruebas

Recomendacion operativa:

- cambios pequenos de backend: correr tests del modulo afectado
- cambios de autorizacion, creditos, pagos o reportes: correr el suite backend completo
- cambios de infraestructura o schema: validar `bootstrap/` y reset local si hace falta
- cambios frontend: al menos `lint` y validacion manual del flujo UI afectado

### Cambios arquitectonicos

Para cambios estructurales:

- preferir extraer seams claros antes que hacer reescrituras amplias
- mantener ownership por modulo
- evitar volver a introducir `controllers/` y `routes/` legacy como capa principal
- si un modulo necesita capacidades de otro, exponer un puerto/seam interno estable antes que importar implementaciones internas al azar

### Uso de SDD y Engram

El proyecto ya viene trabajando con SDD (Spec-Driven Development) y Engram como store de artefactos/memoria.

Uso recomendado para cambios medianos o grandes:

1. explorar el cambio
2. redactar propuesta
3. escribir spec
4. escribir design
5. descomponer en tasks
6. aplicar por lotes pequenos
7. verificar
8. archivar

Cuando se descubra una decision importante, bug o convencion nueva, guardarla en Engram para no perder contexto entre sesiones.

## 6. Como levantar el proyecto

## Requisitos

- Node.js 18+ recomendado
- npm disponible
- PostgreSQL 12+ o compatible

## Opcion A: levantar con Postgres local

### Backend

```bash
cd backend
npm install
npm run dev
```

API por defecto: `http://localhost:5000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI por defecto: `http://localhost:5173`

### Health / discovery

- `GET /health`
- `GET /api`

## Opcion B: levantar base con Docker Compose

En `backend/docker-compose.yml` existe una composicion para Postgres y backend.

```bash
cd backend
docker compose up --build
```

Usarla con cuidado y con variables `DB_*` coherentes con tu entorno local.

## 7. Variables de entorno y dependencias principales

### Backend requeridas

El bootstrap actual exige:

```env
DB_NAME=loan_recovery_system
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
JWT_SECRET=replace_me
```

### Backend opcionales/utiles

```env
PORT=5000
NODE_ENV=development
DB_RESET_ON_BOOT=false
LOG_LEVEL=info
```

Notas:

- `DB_RESET_ON_BOOT=true` fuerza recreacion local del esquema al arrancar; no debe usarse en produccion.
- el codigo actual usa variables `DB_*` individuales; no usa `DATABASE_URL` como fuente principal de conexion.

### Frontend

```env
VITE_API_URL=http://localhost:5000
```

### Dependencias principales

Backend:

- `express`
- `sequelize`
- `pg`
- `jsonwebtoken`
- `bcryptjs`
- `winston`

Frontend:

- `react`
- `vite`
- `lucide-react`
- `lottie-react` / `@dotlottie/react-player`

## 8. Como correr tests y validar backend

### Test suite backend

```bash
cd backend
npm test
```

El suite actual cubre, entre otras cosas:

- registro modular
- composicion del app
- routers por modulo
- politicas de acceso/autorizacion
- schema bootstrap y verificacion de tablas/columnas
- pagos, reportes, auth, notificaciones, agentes, asociados y creditos

### Reset local de esquema

```bash
cd backend
npm run db:reset-local
```

Esto esta pensado para entornos locales y usa la logica de `backend/src/bootstrap/schema.js`.

### Validacion minima recomendada antes de cerrar cambios backend

1. `npm test` en `backend/`
2. smoke manual de `GET /health` y `GET /api`
3. smoke del flujo afectado si el cambio toca auth, loans, payments o reports

## 9. Riesgos y limitaciones conocidas

- la alineacion arquitectonica aun es parcial; conviven modulos bien separados con piezas globales compartidas
- el backend depende de `sequelize.sync()`; no hay estrategia formal de migraciones versionadas todavia
- `render.yaml` no refleja por completo la forma real de configuracion del backend actual, porque el codigo requiere `DB_*` y no consume `DATABASE_URL`
- hay documentacion historica en ingles y archivos heredados que pueden quedar desactualizados respecto al estado modular mas reciente
- el frontend sigue siendo una SPA ligera con estado local/manual, sin una capa mas robusta de routing o state management
- el repositorio puede contener artefactos locales de desarrollo (`.env`, sqlite local, logs, dist`) que conviene revisar antes de automatizar despliegues

## 10. Convenciones y buenas practicas para contribuir

- mantener separacion por modulo dentro de `backend/src/modules/`
- agregar casos de uso en `application/`, acceso a datos/adaptadores en `infrastructure/` y HTTP en `presentation/`
- preferir seams publicos entre modulos antes que imports cruzados de implementaciones internas
- no reintroducir capas legacy de `controllers/`/`routes/` como patron principal
- si un cambio modifica permisos, ownership o visibilidad de datos, agregar test de regresion
- si un cambio toca schema o bootstrap, validar tanto sincronizacion como verificacion de columnas/tablas
- mantener README y docs de soporte alineados cuando cambie la arquitectura o el proceso operativo
- registrar decisiones, hallazgos y bugs relevantes en Engram

## 11. Roadmap tecnico sugerido

Prioridades recomendadas:

1. formalizar migraciones de base de datos y dejar de depender tanto de `sequelize.sync()` en runtime
2. actualizar `render.yaml` y la documentacion operativa para que reflejen la configuracion real del backend modular
3. seguir cerrando fronteras entre modulos, especialmente donde aun existan servicios/utilidades globales ambiguas
4. fortalecer validacion end-to-end de flujos criticos de auth, creditos, pagos y reportes
5. mejorar el frontend con routing/estado mas explicitamente estructurado si el producto sigue creciendo
6. limpiar artefactos locales y endurecer pipeline de despliegue/pruebas

## 12. Archivos de referencia utiles

- `README.md`: guia principal del proyecto
- `setup.md`: setup historico del proyecto
- `ERROR_HANDLING.md`: notas de manejo de errores
- `DEPLOYMENT.md`: material de despliegue a revisar/actualizar
- `backend/src/modules/`: referencia principal de la arquitectura backend actual
- `backend/tests/`: referencia principal de cobertura y comportamiento esperado

---

Si vas a tocar arquitectura, permisos o flujos core, toma este README como punto de partida y valida siempre contra el codigo del modulo afectado.
