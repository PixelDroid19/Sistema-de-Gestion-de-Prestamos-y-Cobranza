# CrediCobranza

CrediCobranza es una plataforma de backoffice para originar, administrar y cobrar créditos. El sistema combina un frontend React/Vite, una API Node.js/Express y PostgreSQL para controlar clientes, créditos, pagos, socios inversionistas, flujo de caja, reportes y permisos internos.

## Producto

El panel administrativo está diseñado para dos perfiles internos:

- `admin`: dueño o administrador con acceso total.
- `employee`: operador interno con permisos asignados por módulo.

`customer` y `socio` son registros financieros, no usuarios del panel administrativo. No deben tener rutas administrativas, dashboards propios ni permisos de backoffice dentro de esta aplicación.

El producto actual cubre:

- Clientes y documentación.
- Créditos, simulación, creación, seguimiento y cierre.
- Parametrización de tasas por rango de monto.
- Políticas de mora separadas de la tasa del crédito.
- Pagos de cuota, pagos parciales, pago total y abonos a capital.
- Reestructuración por abono a capital con reducción de plazo o reducción de cuota.
- Socios inversionistas, capital aportado, intereses, movimientos y estado de deuda.
- Flujo de caja mensual, rentabilidad, cartera viva y reportes.
- Exportaciones Excel/PDF con datos normalizados para operación y auditoría.
- Calendario de pagos, alertas, compromisos de pago e historial operativo.
- Usuarios, roles, permisos y auditoría.

## Contratos financieros vigentes

Estos comportamientos son parte del producto y deben preservarse cuando se hagan cambios.

### Tasas de crédito

- Las tasas se configuran desde `/settings` mediante rangos de monto.
- Los rangos activos no pueden solaparse ni generar ambigüedad.
- Puede haber huecos de configuración, pero un crédito que caiga en un hueco debe bloquearse hasta que exista una regla activa que lo cubra.
- La tasa se asigna automáticamente al crear el crédito según el monto.
- La tasa aplicada queda congelada en el crédito mediante snapshot financiero.
- No se permite editar manualmente la tasa de un crédito ya creado.
- La mora es una política independiente; no debe confundirse visual ni técnicamente con la tasa del crédito.

### Abonos a capital

- Un abono a capital solo se permite después de que exista al menos la primera cuota pagada.
- El abono reduce capital vivo y reconstruye el plan futuro.
- No debe marcar cuotas futuras como pagadas o parciales.
- Si hay cuotas vencidas, intereses por pagar, cuotas parciales operativas, bloqueos financieros, crédito cerrado o saldo de capital cero, el abono debe bloquearse.
- Estrategias soportadas:
  - `reduce_term`: mantiene la cuota y reduce el plazo.
  - `reduce_payment`: descuenta capital y vuelve a diferir el saldo restante con el nuevo número de cuotas elegido por el cliente.

### Pagos y comprobantes

- Las acciones críticas del detalle de crédito son `Registrar pago`, `Abono a capital` y `Pago total`.
- El comprobante de pago debe estar disponible después de registrar una cuota.
- Los comprobantes PDF deben mostrar fechas, valores, método de pago y componentes del pago de forma legible.
- Los métodos de pago se muestran en lenguaje operativo en español, no como claves internas.

### Reportes y exportaciones

- Los reportes se derivan de datos canónicos del backend, no de cálculos duplicados del frontend.
- Los Excel deben usar encabezados en español, dinero normalizado, fechas legibles y porcentajes entendibles.
- El historial de créditos debe incluir cartera/capital vivo cuando aplica.
- Los reportes principales de créditos deben conservar una estructura operativa con hojas como `Resumen General`, `Detalle de Créditos` y hojas por crédito cuando corresponda.
- La rentabilidad por cliente exportada debe coincidir con los valores visibles en pantalla.

## Arquitectura

### Frontend

El frontend vive en `frontend/`.

Tecnologías principales:

- React 19
- Vite 8
- TypeScript
- Sass
- TanStack Query
- Zustand
- `react-i18next`
- Vitest + Testing Library + MSW

Puntos importantes:

- Entradas: `frontend/src/main.tsx` y `frontend/src/App.tsx`.
- Rutas y protección por rol/permisos: `frontend/src/App.tsx` y `frontend/src/components/ProtectedRoute.tsx`.
- La mayoría de pantallas operativas viven en `frontend/src/components/`.
- Servicios HTTP viven en `frontend/src/services/`.
- El cliente API usa `/api` relativo y Vite lo proxya a `VITE_API_URL`.
- Reusar `frontend/src/services/queryKeys.ts` para claves de TanStack Query.
- Reusar componentes compartidos para inputs, botones, superficies, tablas y modales. No crear estilos aislados por pantalla si el patrón ya existe.
- Todo texto visible debe pasar por i18n cuando se agregue o modifique UI.

### Backend

El backend vive en `backend/` y funciona como monolito modular.

Tecnologías principales:

- Node.js
- Express 5
- Sequelize 6
- PostgreSQL
- JWT
- `bcryptjs`
- `multer`
- `xlsx`
- Node test runner

Flujo de arranque:

```text
backend/src/server.js
-> backend/src/bootstrap/index.js
-> backend/src/app.js
-> backend/src/modules/index.js
```

APIs montadas actualmente:

- `/api/auth`
- `/api/customers`
- `/api/associates`
- `/api/loans`
- `/api/payments`
- `/api/reports`
- `/api/notifications`
- `/api/users`
- `/api/permissions`
- `/api/audits`
- `/api/config`

Reglas de arquitectura backend:

- Mantener lógica dentro de `backend/src/modules/<domain>/`.
- No crear carpetas globales nuevas de controllers/routes fuera del esquema modular.
- Usar alias `@/` para imports que cruzan módulos o capas.
- Mantener errores, validaciones y permisos en backend aunque exista validación frontend.
- Las operaciones financieras deben ser trazables; no borrar físicamente movimientos o pagos como atajo.

## Motor de cálculo de créditos

El cálculo financiero vive en:

```text
backend/src/modules/credits/domain/calculation/
```

El servicio público de cálculo es:

```text
backend/src/modules/credits/application/creditCalculationService.js
```

El endpoint `/api/loans/calculations` devuelve `data.calculation` con:

- `calculationVersionId`
- `calculationProfileVersionId`
- `method`
- `inputs`
- `schedule`
- `summary`
- `policySnapshot`
- `explanation`

La creación de créditos debe recalcular con este servicio y persistir `calculationProfileVersionId` y `policySnapshot`.

## Estructura del repositorio

```text
.
|- backend/
|  |- scripts/
|  |- src/
|  |  |- bootstrap/
|  |  |- db/
|  |  |- models/
|  |  |- modules/
|  |  `- workers/
|  `- tests/
|- frontend/
|  |- src/
|  |  |- api/
|  |  |- components/
|  |  |- constants/
|  |  |- hooks/
|  |  |- i18n/
|  |  |- lib/
|  |  |- services/
|  |  |- store/
|  |  `- styles/
|  `- tests/
|- AGENTS.md
|- agent.md
|- README.md
`- package.json
```

## Requisitos

- Node.js 18 o superior recomendado.
- npm.
- Docker para levantar PostgreSQL local.
- PostgreSQL local/remoto si no se usa Docker.

## Variables de entorno

### Backend (`backend/.env`)

Mínimas:

```env
DB_NAME=loan_recovery_system
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5433
JWT_SECRET=replace_me_with_32_chars_minimum
```

Comunes:

```env
PORT=5000
NODE_ENV=development
DB_SCHEMA_MODE=alter
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DB_RESET_ON_BOOT=false
LOG_LEVEL=info
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_VAPID_SUBJECT=
```

Notas:

- El backend lee variables `DB_*`; no depende de `DATABASE_URL`.
- `ALLOWED_ORIGINS` debe configurarse en producción con las URLs reales del frontend.
- `DB_SCHEMA_MODE=reset` y `DB_RESET_ON_BOOT=true` son destructivos. Usarlos solo en local o entornos explícitamente permitidos.

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000
PORT=3000
```

`VITE_API_URL` debe ser el origen del backend, no una URL terminada en `/api`.

## Desarrollo local

Instalar dependencias:

```bash
npm install
npm run install:all
```

Levantar PostgreSQL local en Docker, backend y frontend:

```bash
npm run dev:local
```

Servicios:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- PostgreSQL local: `localhost:5433`

Reiniciar solo la base local:

```bash
npm run db:reset-local
```

Crear o actualizar usuarios locales de QA:

```bash
npm run seed:local-users
```

Credenciales locales:

- Admin: `qa.admin.20260427@test.local` / `Admin123!`
- Empleado: `qa.employee.20260427@test.local` / `Admin123!`

El empleado se crea sin permisos amplios por defecto. Para probar permisos reales, entra como admin y asigna permisos desde el panel.

smoke API local:

```bash
SMOKE_ADMIN_EMAIL=qa.admin.20260427@test.local \
SMOKE_ADMIN_PASSWORD='Admin123!' \
SMOKE_EMPLOYEE_EMAIL=qa.employee.20260427@test.local \
SMOKE_EMPLOYEE_PASSWORD='Admin123!' \
npm run smoke:local
```

Este smoke valida health/OpenAPI, cálculo de crédito, módulos core con admin, permisos del empleado local y denegaciones 403 para APIs sensibles cuando el empleado no tiene permisos amplios.

Smoke local de navegador:

```bash
npm run dev:local
npm run seed:local-users
npm run smoke:browser:local
```

Este smoke usa `agent-browser` para abrir `http://127.0.0.1:3000/login`, iniciar sesión con el admin local de QA y confirmar que llega al dashboard administrativo. Si necesitas revisar la secuencia sin abrir navegador:

```bash
BROWSER_SMOKE_DRY_RUN=true npm run smoke:browser:local
```

Para ampliar la cobertura local sin tocar datos remotos:

```bash
BROWSER_SMOKE_INCLUDE_NEW_CREDIT=true \
BROWSER_SMOKE_INCLUDE_ADMIN_ROUTES=true \
BROWSER_SMOKE_INCLUDE_REPORTS=true \
BROWSER_SMOKE_INCLUDE_SETTINGS=true \
BROWSER_SMOKE_INCLUDE_EMPLOYEE_GUARDS=true \
BROWSER_SMOKE_CHECK_ERRORS=true \
BROWSER_SMOKE_CHECK_A11Y=true \
npm run smoke:browser:local
```

Ese modo valida originación de crédito, shells de rutas administrativas, reportes y configuración con admin, cierra sesión, entra con el empleado local sin permisos amplios, confirma que las rutas protegidas vuelven a `/profile` y falla si el navegador captura errores de página o problemas básicos de accesibilidad en el DOM auditado.

Para repetir el smoke en un tamaño responsive específico:

```bash
BROWSER_SMOKE_VIEWPORT=390x844 npm run smoke:browser:local
```

Variables útiles:

- `BROWSER_SMOKE_FRONTEND_URL`: origen del frontend, por defecto `http://127.0.0.1:3000`.
- `BROWSER_SMOKE_ADMIN_EMAIL` y `BROWSER_SMOKE_ADMIN_PASSWORD`: credenciales admin de QA.
- `BROWSER_SMOKE_EMPLOYEE_EMAIL` y `BROWSER_SMOKE_EMPLOYEE_PASSWORD`: credenciales del empleado local de QA.
- `BROWSER_SMOKE_TIMEOUT_MS`: timeout por paso, por defecto `30000`.
- `BROWSER_SMOKE_VIEWPORT`: viewport opcional en formato `ANCHOxALTO`, por ejemplo `390x844`, para repetir el smoke en móvil o escritorio compacto.
- `BROWSER_SMOKE_MOBILE_MENU_BUTTON`: texto del botón que abre el menú móvil, por defecto `Abrir menú`.
- `BROWSER_SMOKE_CHECK_ERRORS`: limpia errores de página al inicio y falla antes de cerrar si el navegador capturó excepciones.
- `BROWSER_SMOKE_CHECK_A11Y`: presiona `Tab` y audita título, idioma, labels, nombres accesibles, ids duplicados, referencias ARIA, imágenes y foco visible en las pantallas recorridas.
- `BROWSER_SMOKE_ARTIFACT_DIR`: carpeta para capturas de fallo, por defecto `artifacts/browser-smoke`.
- `BROWSER_SMOKE_INCLUDE_ADMIN_ROUTES`: recorre los shells principales con admin (`/dashboard`, clientes, créditos, cálculo, reportes, socios, pagos, notificaciones, auditoría, perfil y configuración).
- `BROWSER_SMOKE_INCLUDE_NEW_CREDIT`: abre `/credits/new` y verifica que cargue el formulario inicial de originación.
- `BROWSER_SMOKE_INCLUDE_REPORTS`: abre reportes y verifica la pestaña de flujo de caja.
- `BROWSER_SMOKE_INCLUDE_SETTINGS`: abre configuración, entra a métodos de pago y valida que el modal de crear método abra y cierre sin guardar.
- `BROWSER_SMOKE_INCLUDE_EMPLOYEE_GUARDS`: verifica redirecciones de rutas protegidas para el empleado sin permisos amplios.
- `AGENT_BROWSER_BIN`: ruta del binario si `agent-browser` no está en `PATH`.

El smoke rechaza URLs no locales salvo que se defina `BROWSER_SMOKE_ALLOW_REMOTE=true`; si falla después de abrir el navegador, intenta guardar una captura en `artifacts/browser-smoke`. Para producción sigue siendo obligatorio validar primero variables, despliegues y permisos.

## Desarrollo manual

```bash
# Terminal 1
npm run docker:db

# Terminal 2
cd backend
DB_HOST=localhost DB_PORT=5433 DB_SCHEMA_MODE=alter npm run dev

# Terminal 3
cd frontend
VITE_API_URL=http://localhost:5000 npm run dev
```

## Docker Compose completo

```bash
cd backend
docker compose up --build
```

En este modo el backend suele quedar en `http://localhost:5001`. Para conectar el frontend local:

```bash
cd frontend
VITE_API_URL=http://localhost:5001 npm run dev
```

## Comandos útiles

Desde la raíz:

```bash
npm run dev:local
npm run lint
npm run test
npm run docker:db
npm run docker:stop
```

Backend:

```bash
cd backend
npm run dev
npm run lint
NODE_ENV=test node --require module-alias/register --test
NODE_ENV=test node --require module-alias/register --test tests/schema.test.js
```

Frontend:

```bash
cd frontend
npm run dev
npm run lint
npm test -- --run
npm run build
```

## Validación antes de entregar cambios

Para cambios de producto o financieros, ejecutar según alcance:

```bash
cd backend && npm run lint
cd backend && NODE_ENV=test node --require module-alias/register --test
cd frontend && npm run lint
cd frontend && npm test -- --run
cd frontend && npm run build
```

Además, validar manualmente en navegador los flujos modificados. En este producto no basta con que compile: hay que comprobar la experiencia real, los cálculos, permisos y exportaciones.

## Railway

Servicios conocidos del entorno Railway:

- Frontend: `https://frontend-production-3058.up.railway.app`
- Backend: `https://backend-production-4d24.up.railway.app/api`

Antes de asumir que producción refleja el código local:

1. Confirmar que el último commit esté en `master`.
2. Revisar estado de deployments en Railway.
3. Validar login y al menos un flujo crítico desde el frontend desplegado.

Variables mínimas esperadas en producción:

Backend:

```env
NODE_ENV=production
DB_HOST=<host-postgres>
DB_PORT=<puerto-postgres>
DB_NAME=<base-postgres>
DB_USER=<usuario-postgres>
DB_PASSWORD=<password-postgres>
JWT_SECRET=<secreto-de-32-caracteres-o-mas>
ALLOWED_ORIGINS=https://frontend-production-3058.up.railway.app
DB_SCHEMA_MODE=verify
```

Frontend:

```env
VITE_API_URL=https://backend-production-4d24.up.railway.app
```

`VITE_API_URL` debe ser el origen del backend. El frontend agrega `/api` internamente para las llamadas HTTP. Si se necesita definir una ruta API completa por runtime, usar `VITE_API_BASE_URL`.
El contenedor frontend rechaza `VITE_API_URL` terminado en `/api` para evitar dobles rutas o configuración ambigua en producción.

Smoke no destructivo contra producción:

```bash
SMOKE_API_BASE_URL=https://backend-production-4d24.up.railway.app \
SMOKE_ORIGIN=https://frontend-production-3058.up.railway.app \
SMOKE_ADMIN_EMAIL=<admin> \
SMOKE_ADMIN_PASSWORD=<password> \
SMOKE_EMPLOYEE_EMAIL=<empleado> \
SMOKE_EMPLOYEE_PASSWORD=<password> \
npm run smoke:remote
```

Antes de ejecutar llamadas remotas, validar que las variables del smoke apuntan a los orígenes correctos:

```bash
SMOKE_API_BASE_URL=https://backend-production-4d24.up.railway.app \
SMOKE_ORIGIN=https://frontend-production-3058.up.railway.app \
SMOKE_ADMIN_EMAIL=<admin> \
SMOKE_ADMIN_PASSWORD=<password> \
SMOKE_EMPLOYEE_EMAIL=<empleado> \
SMOKE_EMPLOYEE_PASSWORD=<password> \
npm run smoke:remote:check
```

`SMOKE_ORIGIN` debe coincidir con una URL permitida en `ALLOWED_ORIGINS`; en producción el backend rechaza peticiones privadas sin `Origin`.
Cuando `SMOKE_ORIGIN` está definido, el smoke valida que el backend responda `Access-Control-Allow-Origin` con ese mismo origen.
El smoke usa un timeout HTTP de 15 segundos por petición; si el entorno remoto necesita otro valor, definir `SMOKE_TIMEOUT_MS=<milisegundos>`.

Antes de desplegar, ejecutar la compuerta local de contratos de producción:

```bash
npm run verify:production
```

Esta verificación bloquea regresiones de configuración como volver a usar `DATABASE_URL`/`CORS_ORIGIN`, definir `VITE_API_URL` con `/api`, omitir `SMOKE_ORIGIN` del smoke remoto o quitar el modo seguro `DB_SCHEMA_MODE=verify`.

Para una verificación local completa antes de publicar, ejecutar:

```bash
npm run verify:release
```

Este comando encadena contratos de producción, lint backend/frontend, tests backend/frontend y build frontend. Después de desplegar, sigue siendo obligatorio validar el entorno remoto con `npm run smoke:remote` y navegador real.

No resetear una base de datos remota como atajo. Solo hacerlo cuando se haya pedido explícitamente y se haya confirmado que el entorno es de QA/desarrollo.

## Instrucciones para agentes

`AGENTS.md` es la fuente canónica para Codex y otros agentes de desarrollo. `agent.md` existe como compatibilidad y apunta al mismo contrato.

La guía oficial de OpenAI indica que Codex descubre instrucciones mediante archivos `AGENTS.md` por capas desde el alcance global hasta el directorio actual. Por eso las reglas específicas de este repo deben mantenerse en `AGENTS.md`.

Referencia: https://developers.openai.com/codex/guides/agents-md
