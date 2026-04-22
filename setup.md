# CrediCobranza - Guia de Instalacion

Sistema de Gestion de Prestamos y Cobranza con frontend React/Vite y backend Node.js/Express.

## Opcion 1: Todo local (sin Docker)

### Requisitos

- Node.js 18+
- PostgreSQL 12+ corriendo localmente
- npm

### Paso 1: PostgreSQL local

Asegurate de tener PostgreSQL corriendo y accesible en `localhost:5432`.

Crea la base de datos:

```bash
psql -U postgres -c "CREATE DATABASE loan_recovery_system;"
```

### Paso 2: Variables de entorno

**Backend** — crea `backend/.env`:

```env
DB_NAME=loan_recovery_system
DB_USER=postgres
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=5432
JWT_SECRET=cambia_esto_en_produccion
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

**Frontend** — crea `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
```

### Paso 3: Instalar dependencias

```bash
cd backend && npm install
cd ../frontend && npm install
```

### Paso 4: Arrancar

**Backend** (terminal 1):

```bash
cd backend
npm run dev
```

Queda en `http://localhost:5000`. El boot hace:
- Conecta a PostgreSQL
- Sincroniza/esquema las tablas
- Seeda productos financieros y grafo DAG base
- Inicia worker de outbox y alertas vencidas

**Frontend** (terminal 2):

```bash
cd frontend
npm run dev
```

Queda en `http://localhost:3000` (puerto fijo, no configurable).

### Paso 5: Crear tu primer usuario

El sistema no trae usuarios pre-creados. Registrate por la API o crea uno directamente:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@test.com","password":"admin123","role":"admin"}'
```

Roles validos: `admin`, `customer`, `socio`.

---

## Opcion 2: Backend con Docker + Frontend local

Esta es la opcion recomendada si no queres instalar PostgreSQL local.

### Paso 1: Levantar PostgreSQL con Docker

```bash
docker run -d \
  --name pg-credicobranza \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=loan_recovery_system \
  postgres:16
```

Espera 5 segundos a que arranque.

### Paso 2: Variables de entorno

Igual que en Opcion 1:

**Backend** (`backend/.env`):

```env
DB_NAME=loan_recovery_system
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
JWT_SECRET=cambia_esto_en_produccion
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

**Frontend** (`frontend/.env`):

```env
VITE_API_URL=http://localhost:5000
```

### Paso 3: Instalar y arrancar

```bash
cd backend && npm install && npm run dev
```

En otra terminal:

```bash
cd frontend && npm install && npm run dev
```

### Paso 4: Crear usuario

Igual que en Opcion 1.

### Apagar

```bash
docker stop pg-credicobranza
docker rm pg-credicobranza
```

---

## Opcion 3: Docker Compose (backend + PostgreSQL)

Si tu Docker tiene el plugin `docker compose` instalado:

```bash
cd backend
docker compose up --build
```

Esto levanta:
- PostgreSQL en `localhost:5432`
- Backend en `http://localhost:5000`

El frontend lo corres aparte:

```bash
cd frontend
npm install
npm run dev
```

### Nota sobre Docker Compose

Algunas instalaciones de Docker no incluyen el plugin `docker compose`. Si te da error, usa la **Opcion 2** (Docker puro para Postgres + backend local).

---

## Verificacion rapida

### Backend

```bash
curl http://localhost:5000/api
```

Deberia devolver la lista de rutas montadas.

### Frontend

Abri `http://localhost:3000` en el navegador. Deberia mostrar la pantalla de login.

### Tests

Backend:

```bash
cd backend
NODE_ENV=test node --require module-alias/register --test
```

Frontend:

```bash
cd frontend
npm test
npm run build
```

---

## Solucion de problemas

### "ECONNREFUSED localhost:5432"

PostgreSQL no esta corriendo o no escucha en ese puerto. Verifica con:

```bash
docker ps | grep postgres
```

o

```bash
ps aux | grep postgres
```

### "Port 3000 is already in use"

El frontend usa puerto 3000 fijo. Mata el proceso que lo ocupa:

```bash
lsof -ti:3000 | xargs kill -9
```

### El backend arranca pero no crea tablas

El sync de esquema es automatico en `development`. Si no crea tablas, revisa los logs del backend. A veces hay un error silencioso de conexion a Postgres.

### Frontend no puede hablar con backend

Verifica que:
1. El backend este en `http://localhost:5000`
2. `ALLOWED_ORIGINS` en backend `.env` incluya `http://localhost:3000`
3. `VITE_API_URL` en frontend `.env` sea `http://localhost:5000` (sin `/api` al final)

---

## Estructura de puertos

| Servicio   | Puerto | Configurable |
|------------|--------|--------------|
| Frontend   | 3000   | No (fijo en Vite) |
| Backend    | 5000   | Si (PORT en .env) |
| PostgreSQL | 5432   | Si (docker run -p) |

---

## Comandos utiles

### Backend

```bash
cd backend
npm run dev            # nodemon, recarga en cambios
npm start              # node directo, sin recarga
npm test               # tests con node --test
npm run lint           # eslint
npm run db:reset-local # resetea esquema local (destructivo)
```

### Frontend

```bash
cd frontend
npm run dev         # Vite dev server
npm run build       # build produccion
npm run preview     # preview del build
npm run lint        # tsc --noEmit
npm test            # vitest run
npm run test:watch  # vitest watch
```

---

## Notas importantes

- **No hay usuarios default.** Tenes que registrarte via `/api/auth/register` o insertar directo en la BD.
- **Frontend puerto 3000 fijo.** No es 5173 como en Vite por defecto; esta hardcodeado en `vite.config.ts`.
- **Backend en Docker requiere `DB_HOST=db`** (nombre del servicio en docker-compose), no `localhost`.
- **DAG es la unica fuente de verdad.** El motor financiero usa grafos persistidos; no hay fallback legacy.
- **Schema sync automatico.** En `development`, el backend crea/ajusta tablas al arrancar. No uses migraciones manuales.
