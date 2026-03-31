# 📋 Funcionalidades Pendientes

> Documentación de las funcionalidades que faltan en nuestro sistema, identificadas por comparación contra el proyecto de referencia.  
> Se señala qué ya tenemos y puede escalarse para evitar rehacer trabajo.  
> Última actualización: 2026-03-28

---

## 🔐 1. Sistema de Permisos Granulares

**Estado:** No existe. Hay que construirlo desde cero.  
**Lo que ya tenemos y podemos escalar:** El módulo `auth` ya maneja roles (`admin`, `associate`, `customer`). El middleware `authMiddleware` ya protege rutas. Esto se puede extender para que además de validar rol, valide permisos específicos. No hay que rehacer la autenticación — solo agregar una capa de autorización granular encima.

### ¿Qué necesitamos?

Un sistema donde cada usuario tenga permisos heredados de su rol + permisos directos personalizados. Actualmente si alguien es `admin` puede hacer todo; necesitamos poder decir "este admin puede ver créditos pero NO puede eliminarlos".

### Catálogo de Permisos

```
CRÉDITOS:
  CREDITS_VIEW_ALL / CREDITS_VIEW_OWN / CREDITS_CREATE
  CREDITS_UPDATE / CREDITS_DELETE / CREDITS_APPROVE / CREDITS_REJECT

CLIENTES:
  CUSTOMERS_VIEW / CUSTOMERS_VIEW_OWN / CUSTOMERS_CREATE
  CUSTOMERS_UPDATE / CUSTOMERS_DELETE

PAGOS:
  PAYOUTS_CREATE / PAYOUTS_VIEW_ALL / PAYOUTS_VIEW_OWN
  PAYOUTS_UPDATE / PAYOUTS_DELETE

SOCIOS:
  PARTNERS_VIEW_ALL / PARTNERS_VIEW_OWN / PARTNERS_CREATE
  PARTNERS_UPDATE / PARTNERS_DELETE / PARTNERS_VIEW_PROFITS

REPORTES:
  REPORTS_VIEW_ALL / REPORTS_VIEW_OWN / REPORTS_EXPORT

DASHBOARD:
  DASHBOARD_VIEW_GLOBAL / DASHBOARD_VIEW_PERSONAL

USUARIOS:
  USERS_VIEW / USERS_CREATE / USERS_UPDATE
  USERS_DELETE / USERS_MANAGE_ROLES

PERMISOS:
  PERMISSIONS_VIEW / PERMISSIONS_ASSIGN

AUDITORÍA:
  AUDITS_VIEW / AUDITS_VIEW_OWN
```

### Backend

Crear un módulo nuevo `modules/permissions/` siguiendo la misma arquitectura modular que ya usamos:

```
GET    /api/permissions                      — Listar permisos del sistema
GET    /api/permissions/by-module            — Agrupados por módulo
GET    /api/permissions/user/:userId         — Permisos activos (rol + directos)
GET    /api/permissions/user/:userId/direct  — Solo permisos personalizados
GET    /api/permissions/user/:userId/summary — Resumen de qué puede y no puede
POST   /api/permissions/grant               — Conceder permiso directo
POST   /api/permissions/grant-batch         — Conceder permisos a varios usuarios
POST   /api/permissions/revoke              — Revocar permiso
DELETE /api/permissions/direct              — Quitar permiso directo (hereda del rol)
POST   /api/permissions/check               — ¿Tiene este permiso?
POST   /api/permissions/check-multiple      — ¿Tiene estos permisos?
GET    /api/permissions/me                   — Mis permisos
GET    /api/permissions/me/summary           — Mi resumen
```

**Escalar lo existente:** Extender `authMiddleware` para que acepte `{ roles, permissions }` y valide ambos. El decorador `@Auth` del proyecto de referencia hace exactamente esto.

### Frontend

- Página nueva de gestión de permisos (puede ir dentro de `/settings`)
- Toggle por módulo para activar/desactivar permisos por usuario
- Diferenciación visual: permiso heredado del rol vs. asignado manualmente
- El sidebar y las acciones deben respetar los permisos (ocultar lo que no se puede hacer)

**Escalar lo existente:** El componente `Settings.tsx` ya existe. Se puede agregar una pestaña/sección de "Roles y Permisos" dentro de esa misma vista.

---

## 🔍 2. Módulo de Auditoría

**Estado:** No existe. Hay que construirlo desde cero.  
**Lo que ya tenemos y podemos escalar:** Ya tenemos un logger (`utils/logger.js`) que registra requests HTTP. Se puede extender para que además registre acciones de negocio en la base de datos. No hay que reemplazar el logger — solo agregar un `AuditService` que se llame desde los servicios existentes.

### Modelo de Datos

```
AuditLog {
  id             — PK
  userId         — Quién lo hizo
  userName       — Nombre (cache para evitar JOINs)
  action         — CREATE | UPDATE | DELETE | LOGIN | EXPORT | APPROVE | REJECT
  module         — credits | customers | payouts | partners | users | config
  resourceId     — ID del recurso afectado
  resourceType   — Credit | Customer | Payment | Associate | User
  previousData   — JSON del estado anterior (UPDATE/DELETE)
  newData        — JSON del estado nuevo (CREATE/UPDATE)
  ipAddress      — IP del cliente
  userAgent      — Navegador
  timestamp      — Cuándo pasó (UTC)
  metadata       — JSON libre
}
```

### Backend

Crear módulo `modules/audit/`:

```
GET /api/audits — Filtros: userId, action, module, resourceId, startDate, endDate, page, limit
```

Inyectar `AuditService` en los servicios que ya tenemos:
- `creditDomainService` → auditar creación/modificación/eliminación de créditos
- `paymentApplicationService` → auditar pagos
- `customerRepository` → auditar cambios en clientes
- `associateRepository` → auditar cambios en socios
- Los use cases de `auth` → auditar logins y cambios de contraseña

### Frontend

- Página nueva `/audit-log` o sección dentro de `/settings`
- Tabla paginada con filtros por usuario, acción, módulo, rango de fechas
- Expandir fila para ver diff entre `previousData` y `newData`
- Solo visible para roles admin

**Escalar lo existente:** La barra lateral (`Sidebar.tsx`) ya tiene ítems dinámicos. Solo agregar una nueva entrada. La tabla puede seguir el mismo patrón de las tablas en `Credits.tsx` o `Customers.tsx`.

---

## 📁 3. Exportación de Reportes a Excel

**Estado:** No existe como funcionalidad dedicada.  
**Lo que ya tenemos y podemos escalar:** El módulo `reports` ya tiene use cases que generan datos (`getRecoveryReport`, `getDashboardSummary`, `getCustomerCreditHistory`, etc.). Ya tenemos `exportCustomerHistory`, `exportCustomerCreditProfile`, `exportCustomerCreditHistory`, y `exportRecoveryReport`. Solo falta un reporte general de créditos y un reporte de socios con descarga Excel.

### Backend

Agregar estos endpoints al módulo de reportes que ya existe (`modules/reports/`):

```
GET /api/reports/credits/excel — Reporte Excel de créditos
  Params: customerId, startDate, endDate, creditId (todos opcionales)
  Response: archivo .xlsx descargable
  Contenido:
    - Datos del cliente (nombre, documento)
    - Datos del crédito (monto, tasa, plazo, estado)
    - Tabla de amortización
    - Pagos realizados
    - Estado de mora
    - Totales

GET /api/reports/credits/summary — Resumen JSON de créditos (mismo filtro)

GET /api/reports/associates/excel — Reporte Excel de socios
  Response: archivo .xlsx con datos de socios, contribuciones, distribuciones
```

**Escalar lo existente:** Ya tenemos `exportAssociateProfitabilityReport` en el módulo de reportes. Seguir el mismo patrón para los nuevos reportes. Agregar dependencia `exceljs` si no está.

### Frontend

- Botón "Exportar Excel" en las páginas de `Credits.tsx`, `Reports.tsx`, y `Associates.tsx`
- Descargar archivo directamente al hacer click

**Escalar lo existente:** Los componentes `Credits.tsx` y `Reports.tsx` ya existen con UI funcional. Solo agregar un botón que llame al endpoint y descargue el archivo.

---

## 🧾 4. Voucher PDF de Pagos

**Estado:** No existe.  
**Lo que ya tenemos y podemos escalar:** El módulo `payouts` ya tiene `listPaymentsByLoan` con datos completos de pagos. Solo falta un servicio que tome esos datos y genere un PDF.

### Backend

Agregar al módulo `payouts`:

```
GET /api/payments/:paymentId/voucher/pdf
  Response: archivo PDF descargable
  Contenido:
    - Número de comprobante
    - Fecha de emisión
    - Datos del cliente
    - Datos del crédito
    - Detalle: cuota, capital, interés, mora, total pagado
    - Método de pago, observaciones
    - Saldo restante
```

Crear un `VoucherService` que use `pdfkit` o similar para generar el PDF.

### Frontend

- Botón "Descargar Comprobante" en la vista de pagos (`Payouts.tsx`) y en el detalle de crédito (`CreditDetails.tsx`)
- Abrir PDF en nueva pestaña o descargar directamente

**Escalar lo existente:** `CreditDetails.tsx` ya muestra historial de pagos. Solo agregar un ícono/botón por cada pago para descargar su voucher.

---

## 📊 5. Reportes Financieros Avanzados

**Estado:** Parcial. Tenemos reportes de recovery, outstanding y dashboard summary. Faltan los reportes de ganancias, pronósticos y análisis.  
**Lo que ya tenemos y podemos escalar:** El módulo `modules/reports/` ya tiene la arquitectura completa con `reportRepository`, `paymentRepository`, y `loanViewService`. Los nuevos reportes usan las mismas fuentes de datos—solo necesitan nueva lógica de agregación.

### Backend — Agregar al módulo `reports` existente:

#### 5.1 Ganancias de Créditos
```
GET /api/reports/credit-earnings
  → totalCredits, totalLoanAmount, totalInterestEarnings, profitMargin
```

#### 5.2 Ganancias por Intereses
```
GET /api/reports/interest-earnings
  → Desglose de ganancias solo por intereses
```

#### 5.3 Ganancias Mensuales con Tendencias
```
GET /api/reports/monthly-earnings?year=2026&month=3
  → Por cada mes: totalEarnings, trend (up/down/stable), changePercent, movingAverage
```

#### 5.4 Intereses Mensuales
```
GET /api/reports/monthly-interest?year=2026
  → Análisis mensual detallado solo de intereses
```

#### 5.5 Análisis de Rendimiento
```
GET /api/reports/performance-analysis
  → collectionRate, defaultRate, averageTicket, portfolioRotation, riskLevel
```

#### 5.6 Dashboard Ejecutivo
```
GET /api/reports/executive-dashboard
  → KPIs (créditos activos, valor portafolio, ingreso mensual, eficiencia cobranza)
  → Tendencias últimos 6 meses con trayectoria
  → Alertas (críticas, warnings, oportunidades)
  → Recomendaciones (inmediatas, corto plazo, largo plazo)
```

#### 5.7 Analytics Comprensivo
```
GET /api/reports/comprehensive-analytics?year=2026
  → Combina credit-earnings + interest + monthly-trend + performance en un solo call
  → Genera insights de negocio automáticos
```

#### 5.8 Análisis Comparativo
```
POST /api/reports/comparative-analysis
  Body: { currentPeriod: {startDate, endDate}, previousPeriod: {startDate, endDate} }
  → Compara métricas entre dos períodos con cambios absolutos y porcentuales
```

#### 5.9 Pronóstico Financiero
```
GET /api/reports/forecast-analysis?months=6
  → Datos históricos + predicciones con escenarios (optimista/realista/pesimista)
  → Nivel de confianza, volatilidad, fuerza de tendencia
```

#### 5.10 Proyección Próximo Mes
```
GET /api/reports/next-month-projection
  → projectedEarnings, confidenceLevel (0-100), basedOnMonths
```

**Escalar lo existente:** Todos estos endpoints van dentro de `modules/reports/`. Crear nuevos use cases (`createGetCreditEarnings`, `createGetMonthlyEarnings`, etc.) siguiendo el mismo patrón de `createGetDashboardSummary` que ya funciona. Registrarlos en el `index.js` y agregarlos al router existente.

### Frontend

- Ampliar el componente `Dashboard.tsx` existente con los nuevos KPIs y gráficas
- Ampliar `Reports.tsx` con secciones de ganancias, trends y pronósticos
- Usar los mismos patrones de charts/gráficas que ya tenemos en el dashboard

**Escalar lo existente:** `Dashboard.tsx` ya tiene widgets con datos del backend. Solo agregar más widgets que consuman los nuevos endpoints. `Reports.tsx` ya tiene estructura de reportes—añadir nuevas pestañas/secciones.

---

## 🔄 6. Refresh Token

**Estado:** No existe. Solo hay un JWT sin renovación.  
**Lo que ya tenemos y podemos escalar:** El módulo `auth` ya genera JWT con `tokenService`. Solo hay que extenderlo para que genere un par de tokens (access + refresh) y agregar un endpoint de renovación.

### Backend

Modificar `modules/auth/`:
- `tokenService` → generar `accessToken` (15min) + `refreshToken` (7 días)
- Login retorna ambos tokens
- Nuevo endpoint:

```
POST /api/auth/refresh
  Body: { refreshToken: "..." }
  Response: { accessToken, refreshToken, expiresIn }
```

- Almacenar refresh tokens hasheados en DB para poder revocarlos
- Rotar refresh token en cada uso (el anterior se invalida)

**Escalar lo existente:** El `createLoginUser` use case ya existe. Extenderlo para retornar el par de tokens. Agregar un nuevo use case `createRefreshToken` y registrarlo en el `index.js` del módulo auth.

### Frontend

- Interceptor en la capa de API (`api/` o `services/`) que detecte 401
- Automáticamente llame a `/api/auth/refresh`
- Si falla → redirigir a `/login`
- Actualizar `Login.tsx` y `ProtectedRoute.tsx` para manejar ambos tokens

**Escalar lo existente:** Ya tenemos servicios API en `frontend/src/api/` y `frontend/src/services/`. Agregar un interceptor al cliente HTTP. `ProtectedRoute.tsx` ya verifica autenticación—extenderlo para intentar refresh antes de redirigir.

---

## 🏢 7. Funcionalidades Faltantes de Socios

**Estado:** Parcial. Tenemos CRUD, contribuciones, distribución de ganancias y reinversión.  
**Lo que ya tenemos y podemos escalar:** `modules/associates/` ya tiene 9 use cases funcionales y el `associateRepository` con acceso completo a datos.

### Backend — Agregar al módulo `associates` existente:

#### 7.1 Plan de Pagos de Rendimientos
```
GET /api/associates/:id/installments
  → Lista de cuotas que la cooperativa le debe al socio
  → installmentNumber, amount, dueDate, status (pending/paid/overdue), paidAt, paidBy
```

#### 7.2 Pagar Cuota de Rendimiento
```
POST /api/associates/:id/installments/:installmentNumber/pay
  Body: { paymentDate?: "ISO date" }
  → Marca cuota como pagada con trazabilidad
```

#### 7.3 Calendario Unificado
```
GET /api/associates/:id/calendar-events
  → Combina: pagos de clientes + distribuciones al socio + aportes
  → Cada evento: { date, type, amount, details }
```

**Escalar lo existente:** Crear nuevos use cases (`createGetAssociateInstallments`, `createPayAssociateInstallment`, `createGetAssociateCalendar`) y registrarlos en el `index.js` del módulo. El router ya acepta nuevas rutas.

### Frontend

- En `AssociateDetails.tsx`: agregar pestaña/sección de "Plan de Rendimientos" con tabla de cuotas y botón "Marcar como pagado"
- En `AssociateDetails.tsx`: agregar sección de "Calendario" con vista mensual de eventos
- En `Associates.tsx`: agregar botón "Exportar Reporte Excel"

**Escalar lo existente:** `AssociateDetails.tsx` ya muestra información detallada del socio. Solo agregar secciones adicionales al mismo componente.

---

## 📈 8. Estadísticas y Filtros Avanzados de Créditos

**Estado:** Parcial. Listamos créditos y filtramos por cliente. Falta paginación server-side, filtros avanzados y estadísticas.  
**Lo que ya tenemos y podemos escalar:** `modules/credits/` ya tiene `listLoans`, `getLoanById`, `listLoansByCustomer`. El repositorio ya consulta la DB—solo hay que agregar queries más elaboradas.

### Backend — Agregar al módulo `credits` existente:

#### 8.1 Estadísticas
```
GET /api/loans/statistics
  → totalCredits, activeCredits, paidCredits, overdueCredits
  → totalLoanAmount, totalCollected, totalPending
  → averageLoanAmount, averageTerm, collectionRate
```

#### 8.2 Créditos por Vencer
```
GET /api/loans/due-payments?date=2026-03-28
  → Créditos cuya próxima cuota vence en/hasta esa fecha
```

#### 8.3 Búsqueda con Paginación Server-Side
```
GET /api/loans/search?page=1&limit=20&status=active&minAmount=1000&maxAmount=50000&startDate=...&endDate=...
  → { credits, total, totalPages, currentPage, limit }
```

**Escalar lo existente:** Agregar nuevos use cases al módulo de créditos y registrarlos en el router. El `loanRepository` ya tiene acceso a la tabla de préstamos—solo agregar métodos de consulta con filtros.

### Frontend

- `Credits.tsx`: agregar paginación server-side (actualmente carga todo en memoria)
- `Credits.tsx`: agregar filtros por estado, rango de monto, rango de fecha
- `Dashboard.tsx`: agregar widget de estadísticas de créditos

**Escalar lo existente:** `Credits.tsx` ya tiene una tabla con filtros básicos. Extender los filtros y cambiar la lógica para paginar desde el servidor en vez de cargar todo.

---

## 👥 9. Gestión Avanzada de Usuarios

**Estado:** Parcial. Tenemos CRUD de usuarios (listar, ver, actualizar, desactivar, reactivar).  
**Lo que ya tenemos y podemos escalar:** `modules/users/` ya funciona con 5 use cases. `modules/auth/` ya crea usuarios.

### Backend

#### 9.1 Crear Usuario con Permisos (requiere módulo de permisos primero)
```
POST /api/auth/register-with-permissions
  Body: { name, email, password, role, permissions: [...] }
  → Crea usuario + asigna permisos en un solo paso
```

#### 9.2 Listar Roles
```
GET /api/config/roles
  → ["SUPER_ADMIN", "ADMINISTRATOR", "PARTNER", "CUSTOMER"]
```

#### 9.3 Restaurar Cliente Eliminado
```
PATCH /api/customers/:id/restore
  → Restaura soft-delete
```

**Escalar lo existente:** El endpoint 9.1 se agrega al módulo `auth`. El 9.2 al módulo `config` que ya tiene otros catálogos (`listAdminCatalogs`). El 9.3 al módulo `customers`.

### Frontend

- Página de gestión de roles/permisos (vinculada al módulo de permisos #1)
- En la lista de clientes, opción de restaurar eliminados
- En formulario de crear usuario, selector de permisos

**Escalar lo existente:** `Settings.tsx` ya existe y puede alojar la gestión de roles. `Customers.tsx` ya tiene la tabla—agregar filtro "mostrar eliminados" con botón restaurar.

---

## 📌 Prioridades de Implementación

| # | Funcionalidad | Prioridad | Se escala de... |
|---|--------------|-----------|-----------------|
| 1 | Permisos Granulares | 🔴 Crítico | `authMiddleware` existente |
| 2 | Auditoría | 🔴 Crítico | `utils/logger.js` existente |
| 3 | Refresh Token | 🔴 Crítico | `tokenService` existente |
| 4 | Reportes Financieros | 🔴 Alto | `modules/reports/` existente |
| 5 | Voucher PDF | 🔴 Alto | `paymentApplicationService` existente |
| 6 | Exportación Excel | 🔴 Alto | Use cases de export existentes |
| 7 | Socios: Installments | 🟡 Medio | `modules/associates/` existente |
| 8 | Estadísticas Créditos | 🟡 Medio | `modules/credits/` existente |
| 9 | Gestión Usuarios | 🟡 Medio | `modules/users/` + `auth` existentes |

> **Nota importante:** La arquitectura modular que ya tenemos facilita mucho agregar estas funcionalidades. Cada módulo tiene su propia carpeta con `application/`, `infrastructure/`, `presentation/` y un `index.js` compositor. Los nuevos features se integran creando use cases y registrándolos—no hay que tocar los módulos existentes.
