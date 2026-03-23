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
- `/api/agents`
- `/api/associates`
- `/api/loans`
- `/api/payments`
- `/api/reports`
- `/api/notifications`
- `/api/users`

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
DB_RESET_ON_BOOT=false
LOG_LEVEL=info
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_VAPID_SUBJECT=
```

Notas:

- El backend usa variables `DB_*` individuales.
- `DB_RESET_ON_BOOT=true` solo debe usarse en escenarios locales de reinicio.
- Las claves de web push son opcionales; si faltan, ese canal queda deshabilitado.

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000
PORT=5173
```

## Instalacion local

### 1. Instalar dependencias

```bash
cd backend
npm install
```

```bash
cd frontend
npm install
```

### 2. Levantar backend

```bash
cd backend
npm run dev
```

El backend queda disponible por defecto en `http://localhost:5000`.

Endpoints utiles:

- `GET /health`
- `GET /api`

### 3. Levantar frontend

```bash
cd frontend
npm run dev
```

El frontend queda disponible por defecto en `http://localhost:5173`.

## Opcion con Docker Compose

Existe un compose en `backend/docker-compose.yml` para levantar PostgreSQL y el backend:

```bash
cd backend
docker compose up --build
```

Usa las mismas variables `DB_*` del backend.

## Comandos disponibles

### Backend

```bash
cd backend
npm run dev            # inicia con nodemon
npm start              # inicia con node
npm test               # ejecuta pruebas node --test
npm run lint           # ejecuta eslint
npm run lint:fix       # corrige lint donde sea posible
npm run db:reset-local # reinicia el esquema local
```

### Frontend

```bash
cd frontend
npm run dev         # inicia Vite
npm run build       # build de produccion
npm run preview     # preview local del build
npm run lint        # ejecuta eslint
npm test            # ejecuta Vitest una vez
npm run test:watch  # ejecuta Vitest en modo watch
```

## Validacion recomendada

```bash
cd backend
npm test
```

```bash
cd frontend
npm test
npm run build
```

## Notas para desarrollo

- No existe hoy un workspace root con scripts compartidos; frontend y backend se gestionan por separado.
- El backend sigue usando sincronizacion de esquema y seeds, no migraciones versionadas.
- `frontend/dist/` contiene artefactos generados del cliente.
- El shell del frontend y la landing ya muestran la marca CrediCobranza en superficies visibles del producto.
