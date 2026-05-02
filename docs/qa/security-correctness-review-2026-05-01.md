# Revisión de seguridad y correctitud del sistema de créditos - 2026-05-01

## Alcance

- Repositorio local en rama `master`.
- Backend Railway: `https://backend-production-4d24.up.railway.app`.
- Frontend Railway: `https://frontend-production-3058.up.railway.app`.
- Roles QA usados:
  - `admin`: `qa.admin.20260427@test.local`
  - `customer`: `qa.customer.20260427@test.local`
  - `socio`: `qa.socio.20260427@test.local`
- En Railway se verificó que producción corre con `DAG_ROLLOUT_MODE=primary` y `ALLOWED_ORIGINS` definido para el frontend productivo y localhost de QA. Los secretos se revisaron sin documentar valores.

## Resultado ejecutivo

No se confirmaron hallazgos `P0` ni `P1` durante esta pasada. Se confirmó y corrigió un hallazgo `P2` en la dependencia usada para exportar Excel. Los controles principales de autenticación, permisos por rol, ownership de créditos, pagos, idempotencia, abonos a capital, payoff, reportes Excel, adjuntos y configuración tienen pruebas automatizadas enfocadas pasando y checks vivos en Railway.

## Hallazgos

### P2 - Dependencia vulnerable en exportes Excel del backend

- **Archivo afectado:** `backend/package.json`, `backend/src/modules/reports/application/useCases.js`, `backend/src/modules/reports/presentation/router.js`.
- **Evidencia:** `npm audit --omit=dev --audit-level=high --json` reportó vulnerabilidad `high` en `xlsx@0.18.5` por advisories de prototype pollution/ReDoS. La dependencia se usaba directamente para generar reportes Excel.
- **Impacto real:** medio. El producto no parseaba archivos Excel de usuario con esa dependencia, pero mantener un parser vulnerable en producción dentro del backend financiero dejaba una superficie innecesaria y podía bloquear auditorías de seguridad.
- **Causa raíz:** uso de `xlsx` como generador genérico de workbooks, aunque el sistema solo necesitaba escritura server-side de reportes.
- **Fix exacto:** se reemplazó `xlsx` por `exceljs` y se creó `backend/src/modules/reports/application/workbookBuilder.js` como helper writer-only. El helper normaliza celdas primitivas, fechas, `BigInt`, objetos anidados y referencias circulares antes de escribir el workbook.
- **Prueba obligatoria:** `npm audit --omit=dev --audit-level=high --json`, tests de reportes Excel, backend lint, backend full test y smoke Railway de `/api/reports/credits/excel`, `/api/reports/payouts/excel` y `/api/reports/dashboard/excel`.
- **Estado:** corregido y desplegado en Railway. Audit actual: `0 high`, `0 critical`; quedan solo vulnerabilidades `moderate` transitivas de `uuid` vía `sequelize/exceljs`.

### P3 - Rutas públicas intencionales deben mantenerse documentadas

- **Ruta afectada:** `/health`, `/api`, `/api/docs/openapi.json`, `/api/config/roles`.
- **Evidencia:** inspección de `backend/src/app.js` y `backend/src/modules/config/presentation/router.js`; check Railway confirmó `GET /api/config/roles -> 200` sin autenticación.
- **Impacto real:** bajo. No expone datos financieros ni secretos, pero sí publica metadata operativa y catálogo de roles.
- **Causa raíz:** estas rutas son parte del contrato público actual.
- **Fix exacto:** no se aplicó cambio porque el plan las declaró rutas públicas intencionales. Si se decide endurecer, mover `/api/config/roles` detrás de autenticación o servirlo solo desde login con payload mínimo.
- **Prueba obligatoria si se cambia:** validar login/registro, documentación OpenAPI y guards frontend.
- **Estado:** aceptado como comportamiento intencional.

### P3 - Adaptadores JWT de pruebas deben mantenerse fuera de contratos públicos

- **Archivo afectado:** `backend/src/modules/shared/auth/tokenService.js`.
- **Evidencia:** `generateTokenPair` emite access token de 15 minutos y refresh token separado; `sign()` y `verify()` se conservan como adaptadores internos usados por middleware/tests.
- **Impacto real:** bajo mientras login use `generateTokenPair`, como ocurre en `backend/src/modules/auth/application/useCases.js`.
- **Causa raíz:** los tests y el middleware comparten una interfaz mínima de firma/verificación JWT.
- **Fix exacto:** se dejó documentado como adaptador interno. No es una ruta pública ni un flujo visible.
- **Prueba obligatoria si se cambia:** `authModule`, `authRouter`, `tokenService` y login Railway.
- **Estado:** aceptado como interfaz interna controlada.

## Controles confirmados

### Auth, sesión y perímetro HTTP

- `JWT_SECRET` requerido y validado contra secretos inseguros en producción.
- Access token emitido con expiración de 15 minutos; refresh token aleatorio de 64 caracteres, hasheado y revocable.
- Login protegido por rate limit específico; navegación/lectura y pagos tienen clases separadas de rate limit.
- `helmet`, CORS con allowlist, payload JSON limitado a `2mb` y errores con envelope seguro.

### Permisos por rol

- `admin` conserva operación completa.
- `customer` solo ve créditos propios y no puede acceder a configuración, reportes administrativos, permisos, abonos a capital ni pagos parciales internos.
- `socio` accede al portal asociado y reportes permitidos, pero no puede ejecutar cobranza ni pagos de cliente.
- `loanAccessPolicy` es el punto compartido usado por créditos, pagos, documentos y reportes contextuales.

### Créditos, pagos y fórmulas

- Creación de crédito exige DAG primario y guarda snapshot financiero con versión de fórmula.
- Mutaciones financieras requieren `Idempotency-Key` en router.
- La aplicación de pagos usa transacción `SERIALIZABLE`, bloqueo de fila del crédito y reintentos ante serialización/deadlock.
- Reuso de idempotency key con payload distinto falla; replay exacto devuelve resultado cacheado.
- Abono a capital reconstruye cronograma futuro sin marcar cuotas futuras como pagadas.
- Payoff rechaza quotes stale, mora/bloqueos financieros y saldos ya cerrados.

### Configuración, reportes y archivos

- Métodos de pago y políticas de tasa/mora bloquean duplicados o solapes ambiguos en backend.
- Exportes Excel de créditos, pagos, dashboard y socios están protegidos por rol.
- Adjuntos restringen MIME, tamaño, ownership, visibilidad del cliente y resolución de rutas dentro del storage local.

## QA Railway ejecutado

### API viva

- Login `admin/customer/socio`: `200`.
- `GET /api/config/roles` sin token: `200`.
- `GET /api/config/payment-methods` sin token: `401`.
- `GET /api/permissions/me` sin token: `401`.
- `GET /api/config/payment-methods` como customer: `403`.
- `GET /api/reports/credits/excel` como customer: `403`.
- `POST /api/permissions/grant` como customer: `403`.
- `POST /api/payments/partial` como customer/socio: `403`.
- `POST /api/payments/capital` como customer/socio: `403`.
- `GET /api/config/payment-methods` como admin: `200`.
- `GET /api/reports/credits/excel` como admin: `200`.
- `GET /api/reports/payouts/excel` como admin: `200`.
- `GET /api/reports/dashboard/excel` como admin: `200`.

### Browser QA con agent-browser

- Admin: login Railway y carga de `/dashboard` con navegación administrativa visible.
- Customer: login Railway redirige a `/credits`; solo aparecen módulos de cliente (`Créditos`, `Notificaciones`, `Perfil`) y créditos propios. Acciones de créditos cerrados aparecen deshabilitadas con razón visible.
- Socio: login Railway redirige a `/associates/1`; portal muestra créditos participados y no muestra módulos administrativos completos ni acciones de cobranza.
- Capturas locales de evidencia:
  - `artifacts/security-audit/admin-dashboard.png`
  - `artifacts/security-audit/customer-home.png`
  - `artifacts/security-audit/socio-home.png`

## Pruebas enfocadas ejecutadas

```bash
cd backend && NODE_ENV=test node --require module-alias/register --test tests/loanAccessPolicy.test.js tests/payoutsModule.test.js tests/payoutsRouter.test.js
cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditsModule.test.js tests/creditsRouter.test.js tests/paymentApplicationService.test.js
cd backend && NODE_ENV=test node --require module-alias/register --test tests/authModule.test.js tests/authRouter.test.js tests/tokenService.test.js tests/permissionsModule.test.js tests/configModule.test.js tests/reportsExcelExport.test.js
cd backend && NODE_ENV=test node --require module-alias/register --test tests/credits/paymentApplicationService.test.js tests/associatesModule.test.js tests/associatesRouter.test.js tests/appComposition.test.js tests/bootstrap.test.js tests/attachmentUpload.test.js
cd backend && NODE_ENV=test node --require module-alias/register --test tests/reportsExcelExport.test.js tests/reportsModule.test.js tests/reportsRouter.test.js
cd backend && npm audit --omit=dev --audit-level=high --json
```

Resultados enfocados:

- `39/39` pagos/payouts/access policy.
- `78/78` créditos, payoff, abono, adjuntos, router y payment service.
- `63/63` auth, token, permisos, configuración y reportes Excel.
- `65/65` idempotencia concurrente, socios, CORS/preflight, bootstrap y adjuntos.
- `41/41` reportes y exportes Excel tras reemplazar `xlsx`.
- `npm audit --omit=dev --audit-level=high`: `0 high`, `0 critical`.

## Gates completos ejecutados

```bash
cd backend && npm run lint
cd backend && NODE_ENV=test node --require module-alias/register --test
cd frontend && npm run lint
cd frontend && npm test -- --run
cd frontend && npm run build
```

Resultados:

- Backend lint: OK.
- Backend full test: `675/675` pruebas pasando.
- Frontend lint: OK.
- Frontend full test: `165/165` pruebas pasando.
- Frontend build: OK.

## Pendiente recomendado

- Si se endurece `/api/config/roles`, coordinarlo con login/registro para no romper onboarding.
- Rotar secretos si alguna salida de terminal o bitácora externa llegó a almacenarlos fuera del entorno controlado.
