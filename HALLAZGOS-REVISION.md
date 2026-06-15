# Revisión de código — Hallazgos

> Fecha: 2026-06-14
> Alcance: revisión de todos los módulos buscando errores visuales, errores de funcionamiento, código muerto y código mal implementado.
> Método: workflow multi-agente (31 unidades) + verificación adversarial. **El workflow se cortó por el límite de gasto mensual de la organización**, así que la verificación automática no corrió y casi todo el frontend no se revisó. Los hallazgos de mayor impacto se verificaron manualmente leyendo el código real.

## Leyenda de estado

- ✅ **CORREGIDO** — verificado contra el código real y arreglado (con tests en verde).
- 🟢 **VERIFICADO SIN CAMBIO** — revisado contra el código real; el comportamiento reportado era intencional o ya estaba bien cubierto.
- 🔴 **CONFIRMADO** — verificado, pero aún sin corregir.
- 🟡 **POR COMPROBAR** — reportado con evidencia por el revisor, pero **no verificado**. Hay que confirmarlo antes de tocarlo.
- ⚪ **SIN REVISAR** — no llegó a revisarse (frontend, por corte del workflow).

---

## ✅ Corregidos y validados

| # | Sev | Categoría | Archivo | Problema | Fix aplicado |
|---|-----|-----------|---------|----------|--------------|
| 1 | ALTA | seguridad | `backend/src/modules/auth/presentation/router.js:58` | `/auth/refresh` sin `authLimiter` ni auth (a diferencia de `/login`) → sin freno a fuerza bruta | Añadido `authLimiter` |
| 2 | ALTA | funcional | `backend/src/modules/audit/presentation/router.js:15` + `frontend/src/services/useAuditStream.ts:45` | Stream SSE exige `Bearer` pero el cliente usa `EventSource` (no envía headers) → 401 + bucle de reconexión cada 3s | Middleware acepta `?access_token=`; el hook lo envía |
| 3 | MEDIA | funcional | `backend/src/modules/audit/domain/services/AuditService.js:173` | `query` descartaba los filtros `category`/`severity` (el repo ya los soportaba) | Reenvío de ambos filtros |
| 4 | ALTA | funcional/dinero | `backend/src/modules/reports/application/useCases.js:28,51` | Resumen de recuperados/pendientes sumaba solo la página actual pero dividía por el total de todas las páginas → total y promedio erróneos; conteos del bucket inconsistentes | Resumen calculado sobre todo el dataset y el bucket correcto |
| 5 | MEDIA | poor-impl | `backend/src/modules/reports/application/useCases.js:324` | El dashboard tragaba todos los errores y devolvía ceros con `success:true`, sin log | Se loguea el error antes de devolver vacío |
| 6 | ALTA | funcional/dinero | `backend/src/modules/credits/application/paymentApplicationService.js:770-845` | Sobrepago a capital contado doble (`principalApplied` ya incluía el abono y además se enviaba `overpaymentAmount` completo) → falla `assertAllocationIntegrity` | `principalApplied` excluye el abono (cubierto por `overpaymentAmount`) |
| 7 | ALTA | funcional/dinero | `backend/src/modules/credits/application/paymentApplicationService.js:953-1040` | Pago parcial en mora descontaba la mora del monto pero no la registraba → falla integridad y se pierde la mora | La mora se registra en `penaltyApplied` y `paymentMetadata` |
| 8 | ALTA | funcional/dinero | `backend/src/modules/associates/application/useCases.js:429-443` | Contribuciones `pending`/`annulled`/`manual_hold` contaban como capital vigente y además podían disparar cuotas de interés | Solo aportes `completed` cuentan para capital vigente, tracking, detalle financiero y programación de intereses |
| 9 | MEDIA | funcional/dinero | `backend/src/modules/associates/application/useCases.js:1578-1609` | El alta de aportes persistía la contribución y luego proyectaba intereses sin transacción → podía dejar datos a medias | Alta del aporte y proyección de intereses envueltas en `runInTransaction` cuando el repositorio lo soporta |
| 10 | MEDIA | funcional/dinero | `backend/src/modules/reports/application/useCases/createGetForecastAnalysis.js:31` | La proyección financiera podía devolver utilidad negativa para el siguiente mes y la UI terminaba mostrando un ingreso imposible | La proyección mostrada se acota a `0` igual que `next-month-projection`, manteniendo pendiente y tendencia sin tocar |
| 11 | MEDIA | funcional/dinero | `backend/src/modules/reports/application/useCases/createGetExecutiveDashboard.js:38-43` | El dashboard alineaba utilidades con meses normalizados, pero interés y mora salían por índice del array crudo y podían correrse cuando faltaban meses | Interés y mora ahora se resuelven por clave `YYYY-MM` igual que la serie mensual normalizada |
| 12 | MEDIA | poor-impl | `backend/src/modules/reports/application/useCases/createGetCreditEarnings.js:17-23` | El reporte hacía una consulta `listRecoveryLoans()` por cada crédito y luego descartaba el resultado, generando N+1 y cómputo muerto | Se eliminó el escaneo por crédito y el KPI toma directamente el agregado canónico de `getPerformanceMetrics()` |
| 13 | MEDIA | funcional/dinero | `backend/src/modules/reports/application/useCases/createGetNextMonthProjection.js:12-34` | La proyección de enero-mayo perdía meses del año previo al consultar solo el año actual, degradando promedio, confianza y forecast | La ventana histórica ahora carga todos los años que cubren los últimos 6 meses y preserva el historial real en cruces de año |
| 14 | MEDIA | funcional/dinero | `backend/src/modules/reports/application/useCases/createExportCreditsExcel.js:212-531` | Excel y PDF contaban mora con precedencia distinta entre `status` y `recoveryStatus`, así que el mismo crédito podía aparecer vencido en un export y no en el otro | Ambos exports usan ahora la misma regla compartida: si cualquiera de los dos estados marca mora (`late/defaulted/overdue`), el crédito cuenta como vencido |
| 15 | BAJA | poor-impl | `backend/src/modules/reports/application/reportInternals.js:18-85` | `reportInternals` mantenía copias locales de `buildCsv` y `buildPdfBuffer` mientras `reportHelpers` ya tenía las mismas implementaciones, abriendo una ruta de deriva silenciosa | `reportInternals` quedó consolidado sobre los helpers compartidos y se eliminaron exports internos no consumidos |
| 16 | MEDIA | funcional/dinero | `backend/src/modules/credits/application/useCases.js:1059-1063` | Aprobar un crédito reescribía `startDate`/`endDate` con la fecha actual, pero dejaba intacto el cronograma persistido; eso desalineaba desembolso, snapshot y vencimientos | La aprobación ya no toca fechas congeladas del crédito: cambia solo el estado y preserva la fecha de desembolso y el cronograma persistido |
| 17 | MEDIA | funcional/dinero | `backend/src/modules/credits/application/loanFinancials.js:144-150` | La reconstrucción legacy del cronograma ignoraba `calculationMethod`; un crédito `SIMPLE` o `COMPOUND` sin `emiSchedule` persistido se reconstruía como francés | `getCanonicalLoanView` ahora reutiliza el método persistido del crédito/snapshot al regenerar el schedule legacy |
| 18 | MEDIA | funcional/dinero | `backend/src/modules/credits/application/useCases.js:321-366` + `backend/src/modules/credits/application/paymentApplicationService.js:55-104` | La mora de cuotas con `dueDate` persistido como timestamp se calculaba por hora real en vez de día operativo; la cotización y el cobro podían dejar un día vencido sin mora hasta completar 24 horas exactas | Ambos caminos se unificaron sobre fecha operativa sin hora (`normalizeUtcDateOnly`/`normalizeDateOnly`) para cotizar, marcar vencimiento y cobrar la misma mora por día |
| 19 | BAJA | poor-impl | `backend/src/modules/credits/composition.js:1-55` | La composición construía un `paymentRouter` interno que nunca se exponía ni se consumía; el router real se volvía a crear en `presentation/router.js` | Se eliminó el router interno muerto y se fijó con prueba de composición |
| 20 | BAJA | poor-impl | `backend/src/modules/credits/index.js:43-58` | `createCreditsModule` destructuraba `_userRepository` desde la composición aunque el puerto real es `userRepository` y ese valor no participaba en ningún flujo | Se retiró la destructuración muerta para evitar ruido y falsos positivos en revisiones |
| 21 | BAJA | funcional | `backend/src/modules/credits/infrastructure/outboxEventRepository.js:22-30` | `markAsProcessing` dejaba `_deliveryAttempts` en `NaN` cuando el payload traía un valor truthy inválido, contaminando los reintentos del outbox | La normalización ahora cae correctamente a `0` y quedó cubierta con prueba dedicada del repositorio |
| 22 | MEDIA | funcional/operación | `backend/src/workers/auditRetentionWorker.js:50-82` + `backend/src/server.js:35-85` | El worker de retención existía pero no se iniciaba al arrancar el backend, así que la purga periódica de auditoría nunca corría | `startServer` ahora crea, inicia y detiene el `auditRetentionWorker` junto al outbox; además quedó verificado en tests de bootstrap y en runtime de Railway con `audit.retention.started` |
| 23 | MEDIA | funcional/auditoría | `backend/src/modules/audit/application/auditDecorator.js:17-46` | `withAudit` emitía `credits.*`, `customers.*` y `associates.*`, pero el bus resuelve categorías por prefijos singulares (`credit.`, `customer.`, `associate.`); esos eventos caían como `TECHNICAL` y desalineaban el bridge de auditoría | El decorador ahora normaliza módulos conocidos a prefijos canónicos del bus antes de emitir el evento de dominio, con prueba dedicada para créditos, clientes y socios |
| 24 | MEDIA | funcional/auditoría | `backend/src/modules/shared/events/eventAuditBridge.js:1-126` + `backend/src/bootstrap/index.js:39-136` | `wireEventAuditBridge` estaba exportado para persistir eventos de negocio/seguridad/auditoría, pero bootstrap no lo cableaba; además podía suscribirse más de una vez en el mismo proceso | Bootstrap lo conecta explícitamente con `auditService`, y tanto el bridge como el logger quedaron idempotentes por bus para evitar listeners duplicados |
| 25 | BAJA | poor-impl | `backend/src/modules/auth/application/useCases.js:17-22` | La configuración de delay de login arrastraba `maxAttempts`, pero el cálculo real ya satura por `maxDelayMs` con la fórmula exponencial y ese campo no participaba en nada | Se eliminó el campo muerto y se conserva el tope real por `maxDelayMs` |
| 26 | BAJA | poor-impl | `backend/src/modules/auth/application/useCases.js:592-603` + `backend/src/modules/auth/index.js:1-56` | `createRevokeRefreshToken` se componía en el módulo pero no tenía endpoint, caller ni integración real | Se retiró del surface del módulo para evitar código muerto y falsas rutas mentales en mantenimiento |
| 27 | BAJA | poor-impl | `backend/src/modules/auth/infrastructure/refreshTokenRepository.js:1-91` | Existía un repositorio de refresh tokens duplicado del archivo canónico `infrastructure/repositories.js`, sin importadores | Se eliminó el módulo duplicado para dejar una sola fuente de verdad |
| 28 | MEDIA | seguridad/funcional | `backend/src/modules/auth/application/useCases.js:546-593` + `backend/src/modules/auth/infrastructure/repositories.js:66-111` | La rotación de refresh token hacía `revoke` y luego `create` fuera de transacción, y si un token revocado se reusaba el sistema solo devolvía error genérico sin invalidar las demás sesiones activas del usuario | La rotación ahora se ejecuta dentro de una transacción compartida y el reúso de un token ya revocado fuerza `revokeAllForUser` antes de rechazar la sesión |
| 29 | BAJA | poor-impl | `backend/src/modules/associates/application/reportingUseCases.js:587-592` | El export de rentabilidad volvía a consultar aportes y distribuciones aunque `createGetAssociateProfitabilityReport` ya devolvía ese mismo dataset | El export ahora reutiliza `report.data.contributions` y `report.data.distributions`; quedó cubierto asegurando que el repositorio solo se lee una vez por dataset |
| 30 | MEDIA | funcional/notificaciones | `backend/src/modules/notifications/application/notificationService.js:140-170` | Los fallos del proveedor de email quedaban completamente silenciados: la notificación se persistía, pero el operador no tenía rastro técnico del incidente | El fanout de email ahora deja `logger.warn` con `notificationId`, `userId`, `type` y el error del proveedor, manteniendo la persistencia como best-effort |
| 31 | MEDIA | funcional/notificaciones | `backend/src/middleware/validation.js:603-679` + `backend/src/modules/notifications/application/useCases.js:13-25,117-140` + `backend/src/modules/notifications/application/notificationService.js:110-137` | El API aceptaba `fcm`/`apns` aunque el registry real solo tenía `webpush`; esas suscripciones quedaban activas y nunca se entregaban | Se centralizó el contrato de proveedores soportados, se rechazan altas/bajas de proveedores inexistentes y cualquier suscripción legacy sin provider válido se invalida en el próximo fanout |
| 32 | BAJA | poor-impl | `backend/src/modules/notifications/application/notificationService.js:52-60` | `setEmailDeliveryDependencies` no tenía callers ni participaba en la composición del módulo | Se eliminó el setter muerto y la inyección de email queda únicamente por constructor |
| 33 | MEDIA | funcional/auditoría | `backend/src/modules/operatingExpenses/index.js:15-27` + `backend/src/modules/index.js:21-35` + `backend/src/modules/operatingExpenses/application/useCases.js:129-181` | Crear y anular gastos operativos no emitía rastro de auditoría aunque son egresos manuales de caja | El módulo ahora recibe `auditService` y ambos casos de uso (`create` / `annul`) quedan envueltos con `withAudit`, con cobertura verificando `CREATE` y `UPDATE` sobre `OperatingExpense` |
| 34 | MEDIA | funcional/configuración | `backend/src/modules/config/application/useCases.js:641-744` | Las políticas de tasa y mora hacían validaciones y updates multi-paso sin encapsularlas en la transacción compartida; además la guarda de solape de mora ignoraba `options.transaction` y escapaba de la unidad de trabajo | `createUpdateRatePolicy`, `createCreateLateFeePolicy` y `createUpdateLateFeePolicy` ahora corren dentro de `runConfigMutation`, reenvían `options.transaction` a todos los reads/writes y la validación de prioridad de mora ya usa la misma transacción |
| 35 | BAJA | poor-impl | `backend/src/modules/config/infrastructure/repositories.js:54-70` | `findById` y `findActiveByCategoryAndKey` estaban definidos en el repositorio pero no tenían ningún consumidor real | Se eliminaron ambos métodos muertos y quedó una sola superficie de acceso coherente |
| 36 | BAJA | poor-impl | `backend/src/modules/operatingExpenses/application/useCases.js:183-187` | `normalizeExpensePayload` y `normalizeListFilters` se exportaban aunque ningún caller los importaba | Se retiraron los exports muertos; la normalización sigue siendo interna del módulo |
| 37 | BAJA | poor-impl | `backend/src/modules/credits/domain/calculation/creditCalculationEngine.js:1-109` | El engine re-exportaba `calculateInstallmentAmount` aunque el resto del módulo consumía esa utilidad desde `amortizationMethods`/`domain/calculation`; el export y su import local ya no tenían consumidores reales | Se retiró el re-export redundante y se limpió el import sin uso del engine |
| 38 | BAJA | poor-impl | `backend/src/modules/credits/application/creditCalculationService.js:1-63` | El servicio público de cálculo re-exportaba `resolvePolicyAdjustedInput` y helpers de mora (`UNSUPPORTED_LATE_FEE_MODES`, `normalizeLateFeeMode`, `assertSupportedLateFeeMode`) que ningún caller importaba; solo `createCreditCalculationService` formaba parte del contrato real | El módulo quedó reducido a su superficie pública real (`createCreditCalculationService`) y `resolvePolicyAdjustedInput` permanece interno |
| 39 | BAJA | poor-impl | `backend/src/modules/credits/application/paymentApplicationService.js:40-52` | `_INSTALLMENT_STATUSES` permanecía declarado pero no participaba en ninguna validación ni transición del servicio de pagos | Se eliminó la constante muerta y se mantuvieron solo los sets usados (`CANCELLABLE_STATUSES`, aliases de estrategia, etc.) |
| 40 | BAJA | poor-impl | `backend/src/modules/credits/infrastructure/outboxEventRepository.js:1-100` | El repositorio del outbox mantenía un método privado `_getPayload` que nunca era invocado por el worker, los tests ni otros repositorios | Se retiró el helper muerto y el repositorio conserva únicamente las rutas usadas de `create/findPending/markAs*` |
| 41 | BAJA | poor-impl | `backend/src/modules/credits/infrastructure/loanCreation.js:8-179` | `DEFAULT_CALCULATION_SCOPE_KEY` estaba duplicada y exportada desde `loanCreation`, pero la fuente de verdad operativa vive en `domain/calculation/calculationProfiles` y nadie consumía el duplicado local | Se eliminó la constante/export redundante y `loanCreation` mantiene solo el contrato realmente utilizado (`createLoanFromCanonicalData*` y `DEFAULT_FINANCIAL_PRODUCT_NAME`) |
| 42 | BAJA | poor-impl | `backend/src/modules/credits/infrastructure/repositories.js:592-629` + `backend/tests/credits/infrastructureRepositories.test.js:6-45` | El puerto `sendRecoveryAssignment` no tenía callers de producción y arrastraba un helper `formatNotificationMoney` aparte, además de mezclar otro formato monetario en mensajes internos | Se eliminó el puerto muerto de asignación de cobranza, se retiró el helper de formato asociado y la prueba del puerto quedó enfocada solo en los mensajes realmente usados (`loan_reminder`, `payment_registered`, `promise_status`) |
| 43 | BAJA | poor-impl | `backend/src/modules/credits/infrastructure/repositories.js:276-281,630-663` | `createCreditsInfrastructure` devolvía una clave `creditsCalculationService` que no era leída por ninguna composición, use case ni prueba; duplicaba el acceso ya expuesto por `creditDomainService` y `loanCreationService` | Se eliminó la clave muerta para dejar una sola superficie de infraestructura coherente |
| 44 | BAJA | poor-impl | `backend/src/modules/shared/index.js:1-49` + `backend/src/modules/shared/errors.js` | El barrel compartido seguía re-exportando `mapApplicationError`, pero no existía ningún consumidor real del helper y el archivo `shared/errors.js` quedó convertido en passthrough muerto | Se eliminó el re-export y se retiró el archivo muerto para mantener el barrel alineado con helpers realmente usados |
| 45 | BAJA | poor-impl | `backend/src/modules/shared/roles.js:1-46` | `isApplicationRole` e `isCanonicalApplicationRole` eran equivalentes entre sí y no tenían callers en backend ni tests; solo añadían superficie duplicada alrededor de `normalizeApplicationRole` | Se retiraron ambos helpers/export redundantes y se mantuvo únicamente `normalizeApplicationRole` más `isAdministrativeLoginRole`, que son las funciones efectivamente usadas |
| 46 | BAJA | poor-impl | `backend/src/modules/users/application/useCases.js:1-147` | `sanitizeUser` sí sigue siendo necesario internamente en el módulo de usuarios, pero su export público no tenía consumidores reales; era otro caso de surface inflado sin contrato útil | Se conservó la función privada y se retiró el export muerto, dejando solo los casos de uso públicos reales |
| 47 | BAJA | poor-impl | `backend/src/modules/users/infrastructure/repositories.js:1-41` | El repositorio de usuarios exponía `create` y `destroy`, pero el módulo administrativo no tenía ningún flujo que los usara; el alta/borrado real de usuarios ocurre por otros caminos del sistema | Se eliminaron los métodos muertos y el repositorio quedó reducido a `findAll/findPage/findById/findByEmail/update`, que son los únicos puertos actualmente consumidos |

**Validación:** suites enfocadas backend en verde (`payment/auth/audit/reports`, `associates`, `associatesReporting`, `reportsExcelExport`, `reportsModule`, `creditsModule`, `paymentApplicationService`, `credits/composition`, `credits/outboxEventRepository`, `credits/loanLifecycle`, `credits/infrastructureRepositories`, `overdueAlertSyncService`, `bootstrap`, `auditInjection`, `authModule`, `authRouter`, `tokenService`, `notificationService`, `notificationsService`, `notificationsModule`, `notificationsRouter`, `notificationsRepositories`, `configModule`, `operatingExpensesModule`, `customersModule`, `usersModule`, `usersRouter`, `sharedAuthMiddleware`, `permissionsAuthMiddleware`, `authLoginSecurity`, repositorio de `associates` y analítica financiera), lint backend limpio, `tsc` frontend limpio y prueba frontend de `AuditLogPage` en verde. En Railway producción el backend también quedó verificado arrancando `OutboxRelay` y registrando `audit.retention.started`.

---

## 🟢 Verificados sin cambio

| # | Sev | Categoría | Archivo | Verificación | Resultado |
|---|-----|-----------|---------|--------------|-----------|
| A | MEDIA | fecha/export | `backend/src/modules/reports/application/excelExportFormats.js:93-121` | La fecha `dd/mm/yyyy` usa extracción UTC a propósito para preservar el día operativo cuando el origen llega como `YYYY-MM-DD` o `00:00:00Z`; la fecha-hora sí se localiza a `America/Bogota` | Se conserva la implementación actual y se añadió cobertura que fija ambos comportamientos en `reportsExcelExport.test.js` |
| B | BAJA | cálculo/mora | `backend/src/modules/credits/domain/calculation/lateFeeCalculator.js:22-59` | El motor conserva ramas `FLAT` y `TIERED`, pero la configuración operativa, las validaciones y el contrato OpenAPI solo aceptan `NONE`, `SIMPLE` y `COMPOUND`; además `configModule.test.js` ya cubre el rechazo explícito de `FLAT/TIERED` | No es un bug activo del producto: esos modos no soportados se bloquean antes de persistirse, así que no se cambia el motor en esta pasada |
| C | BAJA | socios/calendario | `backend/src/modules/associates/application/useCases.js:2096-2111` | El `displayAmount` del calendario sí se consume en frontend (`AssociateDetails.tsx` lo usa en la key de fila y otros flujos de socios mantienen el campo), mientras que el monto visible del calendario ya se renderiza con el formateo centralizado del frontend (`formatSignedCurrency`) | No se cambia en backend en esta pasada; el reporte de “código muerto” era incorrecto y la presentación visible sigue centralizada en UI |
| D | MEDIA | notificaciones/push | `backend/src/modules/notifications/infrastructure/repositories.js:101-132` | `recordDeliveryResult` ya desactiva las suscripciones `invalid` y marca `expired` cuando el detalle lo indica; el fallo real estaba en aceptar proveedores inexistentes, no en este repositorio | Se conserva la implementación actual y se añadió prueba unitaria directa para `invalid -> inactive` y `expired -> expired` |
| E | BAJA | clientes/listado | `backend/src/modules/customers/application/useCases.js:85-95` | La rama sin paginación no está expuesta por el router HTTP principal, pero sigue siendo una vía válida del contrato del use case y del repositorio (`customerRepository.list`) | No se elimina: quedó verificada con cobertura directa en `customersModule.test.js` y sigue sirviendo como contrato reutilizable para callers no HTTP |
| F | BAJA | bootstrap/workers | `backend/src/bootstrap/index.js:1-111`, `backend/src/server.js:1-74`, `backend/src/workers/auditRetentionWorker.js:1-71`, `backend/src/workers/outboxRelayWorker.js:1-198` | La unidad de arranque y workers todavía figuraba como “sin revisar”, pero el cableado actual sí valida entorno, arranca `OutboxRelay` y `auditRetentionWorker`, aplica backoff/reintentos del outbox y mantiene la retención de auditoría con manejo de errores | Se conserva sin cambio: quedó verificada manualmente contra el código real y con suites dedicadas `bootstrap.test.js` + `credits/outboxRelayWorker.test.js` en verde |

---

## 🟡 Por comprobar — Backend (reportados con evidencia, NO verificados)

> Cada uno trae archivo:línea. **Antes de corregir hay que confirmar leyendo el código** (y, para "código muerto", hacer `grep` global de referencias, incluidos re-exports y claves string).

### Créditos / cálculo / pagos
Sin hallazgos pendientes verificados en esta categoría por ahora; la pasada adicional de limpieza ya cerró los exports y puertos muertos confirmados del módulo de créditos.

### Reportes
Sin hallazgos pendientes verificados en esta categoría por ahora; los hallazgos backend confirmados de reportes ya quedaron corregidos o reclasificados arriba.

### Auditoría / eventos
Sin hallazgos pendientes en esta categoría por ahora; bootstrap, bridge y decorador ya quedaron verificados contra el código real y con cobertura.

### Auth
Sin hallazgos pendientes en esta categoría por ahora; refresh token, código muerto y delay de login ya quedaron verificados/corregidos en backend.

### Socios
Sin hallazgos pendientes en esta categoría por ahora; el export duplicado ya se corrigió y el `displayAmount` del calendario quedó reclasificado con verificación de uso real.

### Notificaciones
Sin hallazgos pendientes en esta categoría por ahora; el fanout de email ya deja rastro operativo, el contrato de push quedó alineado con los providers reales y `recordDeliveryResult` quedó cubierto como `invalid/inactive` y `expired/expired`.

### Config / gastos operativos / clientes
Sin hallazgos pendientes en esta categoría por ahora; gastos operativos ya audita altas/anulaciones, las políticas de tasa/mora quedaron transaccionales, el repositorio y los exports muertos se limpiaron y la rama sin paginación de clientes quedó reclasificada como contrato aún válido.

### Código muerto adicional reportado
Sin hallazgos pendientes en esta categoría por ahora; la limpieza confirmada del módulo de créditos ya retiró los exports, claves y puertos muertos que seguían abiertos.

---

## ⚪ Sin revisar — Frontend (el workflow se cortó antes de llegar)

Unidades que **no llegaron a ejecutarse** y deben revisarse al reanudar:

- `fe-credits-list` — `Credits.tsx`, `credits/CreditsCalendarView.tsx`, `CreditsListView.tsx`, `creditsHelpers.ts`
- `fe-credit-details` — `CreditDetails.tsx` + todo `components/creditDetails/*`
- `fe-credit-simulator` — `CreditSimulator.tsx`, `NewCredit.tsx`, simulación compartida, `useActiveCreditSimulation`, `creditCalculationService.ts`
- `fe-customers` — `Customers.tsx`, `CustomerDetails.tsx`, `NewCustomer.tsx`
- `fe-associates` — `Associates.tsx`, `AssociateDetails.tsx`, `AssociateTracking.tsx`, `NewAssociate.tsx`, `ContributionModal.tsx`
- `fe-reports` — `Reports.tsx` + todo `components/reports/*`
- `fe-audit` — `AuditLogPage/Table/Filters/DetailModal`
- `fe-settings` — `Settings.tsx` + `components/settings/*` (¡ojo no-solape de políticas de tasa en UI!)
- `fe-dashboard-misc` — `App.tsx`, `Dashboard`, `Notifications`, `Payouts`, `Profile`, `PermissionsTab`, `Header`, `Sidebar`, `Login`, `ProtectedRoute`, `InstallmentsModal`, `PaymentSchedule`
- `fe-shared-inputs` — `components/shared/inputs/*`, `moneyInput`, `numericInputState`, `dateInput`
- `fe-shared-tables` — `components/shared/tables/*`, `TableShell`
- `fe-shared-components` — `Surfaces`, `AppCalendar`, `FloatingActionDock`, `HelpSupport`, `MeasuredChart`, `ParametersIllustration`
- `fe-services` — `api/client.ts`, todos los `services/*Service.ts`, `crudHooks`, `queryKeys`, `idempotency`, guards/invalidation
- `fe-hooks-store-state` — `components/hooks/*`, `store/*`
- `fe-lib-i18n` — `i18n/*`, `lib/*`, `constants/*` (paridad de claves es/en, formateo COP, texto hardcodeado)

Unidades backend que tampoco llegaron a ejecutarse: `be-models`, `be-payouts-permissions`.

---

## Cómo continuar

1. Reanudar el workflow o continuar manualmente sobre las unidades `⚪ SIN REVISAR`, con prioridad en frontend (`fe-credit-details`, `fe-credit-simulator`, `fe-reports`, `fe-settings`, `fe-shared-inputs`, `fe-shared-tables`) porque concentran riesgo funcional y visual alto.
2. Cubrir las unidades backend todavía no revisadas (`be-models`, `be-payouts-permissions`) antes de cerrar el documento como auditoría completa.
3. Mantener la regla de esta revisión: cada nuevo hallazgo debe quedar respaldado por lectura directa del código actual y, si se corrige, por suites enfocadas o evidencia runtime equivalente.
