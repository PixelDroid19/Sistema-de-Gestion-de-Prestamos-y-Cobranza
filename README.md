# CrediCobranza

CrediCobranza es un Sistema de Gestion de Prestamos y Cobranza con frontend React/Vite y backend Node.js/Express. El producto actual cubre clientes, prestamos, pagos, socios, agentes, notificaciones, reportes y un workspace por rol para operacion interna y acceso externo.

## Panorama general

- `frontend/`: SPA en React 19 con Vite, Sass, TanStack Query, Zustand e i18n en espanol/ingles.
- `backend/`: API modular en Express 5 con Sequelize sobre PostgreSQL.
- Dominios visibles: originacion, seguimiento de cartera, cobranza, pagos, reportes, socios, clientes y notificaciones.
- Motor financiero: simulacion de prestamos, workbench DAG, reglas de calculo y aplicacion de pagos.

## Funcionalidades actuales

- Autenticacion con JWT y carga de sesion por rol.
- Workspace segmentado para `admin`, `customer` y `socio`, con roster operativo de agentes administrado por `admin`.
- Dashboard con resumen de cartera, recuperacion y balances.
- Gestion de clientes, agentes, socios y usuarios.
- Solicitud, simulacion, aprobacion, rechazo, asignacion y seguimiento de prestamos.
- Registro de pagos, pagos parciales, pagos a capital, liquidaciones y anulacion de cuotas.
- Seguimiento operativo con alertas, promesas de pago, adjuntos y documentos del cliente.
- Reportes de recuperacion, historial crediticio, rentabilidad por cliente/prestamo y exportaciones.
- Notificaciones con contador no leido y soporte de web push.

## Arquitectura

### Frontend

La aplicacion cliente vive en `frontend/` y hoy funciona como una SPA sin un esquema de rutas complejo. La vista activa se resuelve desde estado persistido y el rol del usuario autenticado.

Tecnologias principales:

- React 19
- Vite 8
- Sass
- `@tanstack/react-query`
- Zustand
- `react-i18next`
- Vitest + Testing Library + MSW

Areas principales del frontend:

- `src/components/`: shell, layout y UI compartida.
- `src/features/`: workspaces y secciones por dominio.
- `src/pages/`: entradas principales como Home, App, Dashboard, Loans, Payments y Reports.
- `src/store/`: estado global de sesion, UI y workbench DAG.
- `tests/`: pruebas de interfaz y flujos principales.

### Backend

La API vive en `backend/` y esta compuesta como un monolito modular.

Tecnologias principales:

- Node.js
- Express 5
- Sequelize 6
- PostgreSQL
- `jsonwebtoken`
- `bcryptjs`
- `multer`
- `web-push`
- `xlsx`
- Node test runner

Comportamientos relevantes del backend:

- valida variables de entorno al iniciar
- autentica la conexion de base de datos
- sincroniza esquema y ejecuta seeds financieros/grafos
- monta modulos bajo `/api/*`
- inicia sincronizacion programada de alertas vencidas
- levanta un worker de outbox para eventos diferidos

Modulos expuestos actualmente:

- `/api/auth`
- `/api/customers`
- `/api/associates`
- `/api/loans`
- `/api/payments`
- `/api/reports`
- `/api/notifications`
- `/api/users`
- `/api/config`

## Dominio financiero

El dominio de prestamos es la parte mas rica del sistema y hoy incluye:

- simulacion de credito
- ciclo de vida completo del prestamo
- workbench DAG para grafo, validacion y simulacion
- pipeline de calculo basado en grafo
- aplicacion canonica de pagos y liquidaciones
- alertas de mora, promesas de pago y seguimiento operativo
- adjuntos del prestamo y documentos del cliente

## Roles disponibles

- `admin`: acceso completo a operacion, reportes, usuarios, socios, prestamos, pagos y dashboard.
- `customer`: consulta de sus prestamos, pagos, documentos y notificaciones.
- `socio`: visibilidad de socios, reportes de rentabilidad y notificaciones asociadas.

Los agentes se conservan como roster operativo e historial de asignacion (`Agent`, `Loan.agentId`), pero ya no existen como rol autenticado de la aplicacion.

## Estructura del repositorio

```text
.
|- frontend/
|  |- src/
|  |  |- components/
|  |  |- features/
|  |  |- hooks/
|  |  |- lib/
|  |  |- pages/
|  |  |- services/
|  |  |- store/
|  |  `- styles/
|  `- tests/
`- backend/
   |- scripts/
   |- src/
   |  |- bootstrap/
   |  |- core/
   |  |- middleware/
   |  |- models/
   |  |- modules/
   |  |- services/
   |  |- utils/
   |  `- workers/
   `- tests/
```

## Requisitos

- Node.js 18+ recomendado
- npm
- PostgreSQL disponible localmente o por Docker

## Variables de entorno

### Backend (`backend/.env`)

Minimas requeridas por el bootstrap:

```env
DB_NAME=loan_recovery_system
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
JWT_SECRET=replace_me
```

Valores opcionales comunes:

```env
PORT=5000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
DB_RESET_ON_BOOT=false
LOG_LEVEL=info
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_VAPID_SUBJECT=
```

Notas:

- El backend usa variables `DB_*` individuales.
- `ALLOWED_ORIGINS` debe configurarse explicitamente en produccion con la o las URLs del frontend separadas por comas.
- `DB_RESET_ON_BOOT=true` solo debe usarse en escenarios locales de reinicio.
- Las claves de web push son opcionales; si faltan, ese canal queda deshabilitado.

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000
PORT=3000
```

El frontend se ejecuta en el puerto 3000 por defecto (configurable via variable PORT).

## Instalacion rapida

Ver `setup.md` para la guia completa con Docker y local.

### Local (requiere PostgreSQL)

```bash
# Terminal 1 — backend
cd backend && npm install && npm run dev

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```

### Con Docker (solo Postgres) + local

```bash
# 1. Postgres en Docker
docker run -d --name pg-credicobranza -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=loan_recovery_system postgres:16

# 2. Backend local
cd backend && npm install && npm run dev

# 3. Frontend local
cd frontend && npm install && npm run dev
```

### Con Docker Compose

Si tu Docker tiene el plugin `docker compose`:

```bash
cd backend
docker compose up --build
```

El frontend corre aparte:

```bash
cd frontend && npm install && npm run dev
```

## Primer usuario

El sistema no trae usuarios pre-creados. Registrate via API:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@test.com","password":"admin123","role":"admin"}'
```

## Comandos utiles

### Backend

```bash
cd backend
npm run dev            # nodemon, recarga en cambios
npm start              # node directo
npm test               # node --test
npm run lint           # eslint
npm run lint:fix       # auto-fix eslint
npm run db:reset-local # resetea esquema (destructivo)
```

### Frontend

```bash
cd frontend
npm run dev         # Vite en localhost:3000
npm run build       # build produccion
npm run preview     # preview del build
npm run lint        # tsc --noEmit
npm test            # vitest run
npm run test:watch  # vitest watch
```

## Validacion

```bash
cd backend && npm test
cd frontend && npm test && npm run build
```

## Notas para desarrollo

- Frontend siempre en puerto `3000` (fijo en `vite.config.ts`).
- Backend en puerto `5000` (configurable via `PORT`).
- No hay workspace root; cada lado se gestiona por separado.
- El backend usa sincronizacion de esquema automatica, no migraciones versionadas.
- `frontend/dist/` contiene artefactos generados.
- El shell del frontend ya muestra la marca CrediCobranza.
