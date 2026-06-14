# Revisión de código — Hallazgos

> Fecha: 2026-06-14
> Alcance: revisión de todos los módulos buscando errores visuales, errores de funcionamiento, código muerto y código mal implementado.
> Método: workflow multi-agente (31 unidades) + verificación adversarial. **El workflow se cortó por el límite de gasto mensual de la organización**, así que la verificación automática no corrió y casi todo el frontend no se revisó. Los hallazgos de mayor impacto se verificaron manualmente leyendo el código real.

## Leyenda de estado

- ✅ **CORREGIDO** — verificado contra el código real y arreglado (con tests en verde).
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

**Validación:** suites enfocadas backend en verde (`payment/auth/audit/reports` y `associates`, más repositorio de `associates`), lint backend limpio, `tsc` frontend limpio y prueba frontend de `AuditLogPage` en verde.

---

## 🟡 Por comprobar — Backend (reportados con evidencia, NO verificados)

> Cada uno trae archivo:línea. **Antes de corregir hay que confirmar leyendo el código** (y, para "código muerto", hacer `grep` global de referencias, incluidos re-exports y claves string).

### Créditos / cálculo / pagos
| Sev | Archivo:línea | Qué comprobar |
|-----|---------------|---------------|
| MEDIA | `credits/application/useCases.js:1059` | Aprobar un crédito resetea `startDate` pero el cronograma (`dueDates`) sigue calculado desde la fecha de creación |
| MEDIA | `credits/application/useCases.js:334-360` | La mora **cotizada** (normalización por día) difiere de la **cobrada** (timestamp wall-clock) |
| MEDIA | `credits/application/loanFinancials.js:139-146` | `getCanonicalLoanView` reconstruye siempre con amortización FRANCESA, ignorando `calculationMethod` del crédito |
| BAJA | `credits/domain/calculation/lateFeeCalculator.js:22-59` | Modos FLAT/TIERED calculan 0 porque ningún caller pasa `flatFeePerDay`/`baseRate` |
| BAJA | `credits/composition.js:42,51` | `paymentRouter` construido y mal cableado, nunca usado |
| BAJA | `credits/index.js:46` | Destructura `_userRepository` pero composition expone `userRepository` → puerto `undefined` |
| BAJA | `credits/infrastructure/outboxEventRepository.js:25-27` | `markAsProcessing`: ternario no-op que pierde el default-a-0 de `_deliveryAttempts` |

### Reportes
| Sev | Archivo:línea | Qué comprobar |
|-----|---------------|---------------|
| MEDIA | `reports/.../createGetExecutiveDashboard.js:44-49` | Desalineación de interés/mora mensual con los meses |
| MEDIA | `reports/.../createGetNextMonthProjection.js:16-62` | Pierde historial del año previo en ene–may; rellena meses faltantes con cero y los cuenta como datos reales (afecta promedio y confianza) |
| MEDIA | `reports/.../createGetForecastAnalysis.js:30-34` | Proyección no acotada → puede mostrar COP negativo |
| MEDIA | `reports/.../createGetCreditEarnings.js:17-26` | Query full-table por cada crédito y se descarta el resultado (N+1 + cómputo muerto) |
| MEDIA | `reports/.../createExportCreditsExcel.js:221` | Conteo de "en mora" con precedencia de estado inconsistente entre Excel y PDF |
| MEDIA | `reports/application/excelExportFormats.js:93-121` | Fechas (solo día) en Excel en UTC mientras fecha-hora usa America/Bogota → corre el día |
| BAJA | `reports/application/reportInternals.js:18-85` | Builders PDF/CSV byte-idénticos duplicados respecto a `reportHelpers.js` |

### Auditoría / eventos
| Sev | Archivo:línea | Qué comprobar |
|-----|---------------|---------------|
| MEDIA | `backend/src/workers/auditRetentionWorker.js:55-82` | El worker de retención nunca se arranca → los logs no se purgan (¿desactivado a propósito?) |
| MEDIA | `audit/application/auditDecorator.js:25-29` | Eventos mal categorizados como TECHNICAL por desajuste plural/singular del prefijo de módulo |
| MEDIA | `shared/events/eventAuditBridge.js:69-110` | `wireEventAuditBridge` exportado e intencionado para persistir auditoría pero nunca cableado en bootstrap |

### Auth
| Sev | Archivo:línea | Qué comprobar |
|-----|---------------|---------------|
| MEDIA | `auth/application/useCases.js:549-585` | Rotación de refresh token revoke-then-create no transaccional y sin detección de reúso |
| BAJA | `auth/application/useCases.js:17-22` | Config de delay de login con topes inalcanzables y campo muerto; el delay máximo nunca dispara |
| BAJA | `auth/application/useCases.js:594-603` | `createRevokeRefreshToken` cableado pero nunca alcanzable (endpoint muerto) |
| BAJA | `auth/infrastructure/refreshTokenRepository.js:1-91` | Módulo duplicado sin importadores (código muerto) |

### Socios
| Sev | Archivo:línea | Qué comprobar |
|-----|---------------|---------------|
| BAJA | `associates/application/reportingUseCases.js:587-592` | El export de rentabilidad re-consulta contribuciones/distribuciones ya devueltas por el reporte |
| BAJA | `associates/application/useCases.js:2078-2090` | `displayAmount` del calendario es código muerto y salta el formateo COP centralizado |

### Notificaciones
| Sev | Archivo:línea | Qué comprobar |
|-----|---------------|---------------|
| MEDIA | `notifications/application/notificationService.js:157-169` | Errores de envío de email totalmente tragados sin log ni persistencia |
| MEDIA | `notifications/infrastructure/push/providerRegistry.js:3-22` | Suscripciones fcm/apns se aceptan y guardan activas pero nunca se entregan ni se marcan |
| MEDIA | `notifications/infrastructure/repositories.js:117-132` | Fallos permanentes de push nunca desactivan la suscripción rota |
| BAJA | `notifications/application/notificationService.js:61-69` | `setEmailDeliveryDependencies` nunca se llama (código muerto) |

### Config / gastos operativos / clientes
| Sev | Archivo:línea | Qué comprobar |
|-----|---------------|---------------|
| MEDIA | `operatingExpenses/index.js:15-27` | Crear/anular gastos operativos sin rastro de auditoría (egresos de caja no trazables) |
| MEDIA | `config/application/useCases.js:689-731` | Update de políticas de mora/tasa sin la transacción que sí usa el create |
| BAJA | `config/infrastructure/repositories.js:63-85` | Métodos muertos: `findActiveByCategoryAndKey` y `findById` |
| BAJA | `operatingExpenses/application/useCases.js:154-160` | Exports de normalizador sin uso |
| BAJA | `customers/application/useCases.js:88-95` | Ruta de listado de clientes sin paginación inalcanzable |

### Código muerto adicional reportado
- `credits/domain/calculation/creditCalculationEngine.js:107-111` — re-export redundante sin uso de `calculateInstallmentAmount`.
- `credits/application/creditCalculationService.js:67-73` — `resolvePolicyAdjustedInput` y helpers de mora re-exportados sin consumir.
- `credits/application/paymentApplicationService.js:50` — constante `_INSTALLMENT_STATUSES` sin uso.
- `credits/infrastructure/outboxEventRepository.js:99-102` — método privado `_getPayload` sin uso.
- `credits/infrastructure/loanCreation.js:9,180` — constante/export `DEFAULT_CALCULATION_SCOPE_KEY` muerta.
- `credits/infrastructure/repositories.js:647` — clave `creditsCalculationService` muerta en el objeto de infraestructura.
- `credits/infrastructure/repositories.js:600-608` — puerto `sendRecoveryAssignment` y helper `formatNotificationMoney` muertos en producción; el resto formatea dinero de forma inconsistente.

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

Unidades backend que tampoco llegaron a ejecutarse: `be-models`, `be-users-shared`, `be-payouts-permissions`, `be-bootstrap-workers`.

---

## Cómo continuar

1. Reanudar el workflow cuando se reponga el límite de gasto (cachea lo ya hecho, solo corre lo que faltó) para cubrir el frontend y verificar la sección 🟡.
2. Verificar los 🟡 leyendo el código (y `grep` global para los de código muerto) antes de corregir.
3. Corregir por orden de severidad; prioridad: contribuciones anuladas que generan interés (ALTA, dinero) y las proyecciones de reportes.
