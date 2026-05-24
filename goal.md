
# Roles y acceso administrativo

Crear roles:
- administrador
- empleado

Definiciones:
- socio:
  - persona que entrega capital a la empresa para ser utilizado en préstamos
  - recibe una rentabilidad o interés sobre el dinero aportado
  - puede tener pagos de intereses mensuales o anuales
  - debe tener historial financiero individual
  - no tiene acceso administrativo
  - no puede modificar configuraciones del sistema
  - no puede gestionar usuarios ni permisos

Verificar:
- sistema dinámico de permisos para empleados
- middleware de permisos
- protección de rutas backend
- protección de endpoints API
- ocultar módulos restringidos en frontend
- validaciones globales de acceso
- panel administrativo para gestión de permisos

Validar:
- tests de permisos
- acceso restringido por API
- acceso restringido por frontend
- bloqueo de rutas privadas
- persistencia correcta de permisos

# Gestión de socios inversionistas

Verificar:
- registro de socios
- registro de capital aportado
- configuración de rentabilidad
- configuración de pago mensual o anual
- cálculo automático de intereses
- historial de pagos realizados
- historial de intereses pendientes
- calendario de fechas de pago
- alertas de pagos próximos o vencidos

Reglas:
- cada socio puede tener múltiples aportes de capital
- cada aporte debe conservar su porcentaje de rentabilidad histórico
- permitir pagos de intereses mensuales
- permitir pagos de intereses anuales
- registrar fecha programada de cada pago
- registrar fecha real de pago
- registrar estado del pago:
  - pendiente
  - pagado
  - vencido
- no permitir eliminar pagos históricos
- pagos realizados deben afectar flujo de caja
- intereses pendientes deben reflejarse en reportes financieros

Mostrar:
- capital total aportado por socio
- intereses generados
- intereses pagados
- intereses pendientes
- próximas fechas de pago
- historial completo de pagos

Validar:
- tests de cálculo de intereses
- validación de fechas de pago
- validación de flujo financiero
- persistencia histórica de pagos
- consistencia entre pagos y reportes

# Parametrización de tasas

Verificar:
- tabla de rangos de tasas
- CRUD administrativo de tasas
- cálculo automático de tasas al crear créditos
- almacenamiento permanente de la tasa aplicada al crédito

Reglas:
- permitir múltiples rangos configurables
- ejemplo:
  - 0 -> 1.000.000 = tasa configurable
  - 1.000.001 -> 5.000.000 = otra tasa configurable
  - >5.000.000 = otra tasa configurable
- no permitir rangos solapados
- no permitir rangos vacíos
- no permitir eliminar rangos utilizados por créditos existentes
- créditos antiguos deben conservar la tasa original aunque la configuración cambie

Validar:
- tests de cálculo
- tests de rangos
- validación de migraciones
- validación de persistencia histórica

# Créditos y restricciones de capital

Verificar:
- validación backend para abonos a capital
- validación frontend para abonos a capital
- mensajes de error claros
- protección vía API
- historial de abonos a capital

Reglas:
- cuando no se haya pagado ninguna cuota no debe permitir abonar a capital
- para permitir abono a capital mínimo debe estar pagada la primera cuota
- no permitir abonos superiores al saldo pendiente
- recalcular saldo automáticamente después del abono
- registrar fecha y valor de cada abono a capital
- registrar usuario que realizó el movimiento

Validar:
- tests unitarios
- tests API
- pruebas frontend
- validación de cálculos
- validación de restricciones

# Flujo financiero y caja

Verificar:
- registro de entradas financieras
- registro de salidas financieras
- cálculo automático de caja disponible
- historial financiero mensual
- resumen financiero diario y mensual
- dashboard financiero

Reglas:
- cuotas pagadas aumentan caja disponible
- préstamos desembolsados disminuyen caja disponible
- pagos de intereses a socios disminuyen caja disponible
- gastos operativos disminuyen caja disponible
- pagos reversados deben revertir movimientos financieros
- movimientos eliminados deben recalcular caja automáticamente

Lógica financiera esperada:
- si ingresan 50 millones por cuotas pagadas
- y se desembolsan 50 millones en préstamos
- entonces caja disponible no debe generar ganancia disponible

- si existen 50 millones en caja
- y se prestan 40 millones
- entonces caja disponible debe quedar en 10 millones

- si ingresan 50 millones en cuotas
- y se desembolsan 40 millones en préstamos
- entonces el reporte financiero debe mostrar:
  - ingresos = 50 millones
  - egresos = 40 millones
  - caja disponible = 10 millones

Mostrar en reportes:
- total recibido por cuotas
- total desembolsado en préstamos
- total pagado a socios
- caja disponible actual
- ingresos mensuales
- egresos mensuales
- ganancias
- pérdidas
- cartera activa
- cartera vencida

Validar:
- tests financieros
- recalculo automático de caja
- consistencia entre reportes y base de datos
- validación de movimientos reversados

# Reportes y exportaciones

Verificar:
- reportes financieros
- exportación Excel
- exportación PDF
- filtros por fecha
- filtros por estado
- filtros por socio
- filtros por cliente
- filtros por tipo de movimiento

Reportes requeridos:
- préstamos realizados
- historial mensual de créditos
- cuotas recibidas
- flujo de caja
- ganancias
- pérdidas
- cartera
- movimientos financieros
- historial mensual
- pagos realizados a socios
- intereses pendientes de socios
- cronograma de pagos de socios

Historial de créditos mensual:
- mostrar cuánto dinero se prestó por mes
- mostrar cuánto dinero ingresó por cuotas
- mostrar pérdidas del mes
- mostrar ganancias del mes
- mostrar capital disponible en caja
- permitir exportar historial mensual en Excel y PDF
- permitir consultar historial por rango de fechas

Validar:
- exportaciones correctas
- datos consistentes con base de datos
- totales financieros exactos
- filtros funcionando correctamente
- cálculos financieros auditables

Restricciones globales:
- no debe existir forma de saltar restricciones desde frontend ni API
- frontend y backend deben compartir las mismas reglas de negocio
- todas las rutas administrativas deben estar protegidas
- todos los cálculos financieros deben ser determinísticos y auditables

Done when:
- permisos funcionando correctamente
- gestión de socios funcionando
- pagos de intereses funcionando
- historial de pagos persistente
- tasas parametrizadas funcionando
- créditos conservan su tasa histórica
- flujo financiero consistente
- reportes correctos
- caja disponible calculada correctamente
- restricciones de capital funcionando
- exportaciones funcionando
- historial mensual de créditos funcionando
- tests pasando
- build sin errores

# Avance 2026-05-24 - Gastos operativos y permisos de finanzas

Brecha cerrada:
- Se agregó el módulo administrativo de gastos operativos como salida financiera auditable.
- Los gastos operativos quedan protegidos por permisos de finanzas:
  - ver gastos
  - registrar gastos
  - anular gastos
- La pestaña `Gastos operativos` aparece en reportes solo para usuarios con permiso financiero.
- La UI permite filtrar, registrar, listar y anular gastos con motivo obligatorio.
- Los gastos anulados permanecen visibles en el historial y dejan de afectar el flujo de caja.
- El flujo de caja mensual integra gastos operativos como egresos.
- El dashboard/reportes invalidan caché después de crear o anular gastos.
- El catálogo de permisos y el modelo `Permission` quedaron alineados con el módulo `FINANZAS`.
- El arranque de esquema ahora asegura que el enum PostgreSQL de módulos de permisos incluya `FINANZAS` antes de sembrar permisos.
- Se agregó migración para incorporar `FINANZAS` al enum de permisos en bases existentes.

Validación ejecutada:
- `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx`
- `cd frontend && npm run lint`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`
- `cd backend && npm run lint`
- `cd backend && NODE_ENV=test node --require module-alias/register --test tests/schema.test.js tests/operatingExpensesModule.test.js tests/moduleRegistry.test.js tests/jsdocVerification.test.js`
- `cd backend && NODE_ENV=test node --require module-alias/register --test`
- QA visual en Brave con admin local: pestaña visible, gasto persistido renderizado, modal de anulación funcional y estado final `Anulado`.

Pendiente del objetivo integral:
- Validar manualmente el alta completa desde el formulario con datos reales de operación, aunque la ruta está cubierta por prueba frontend y API.
- Continuar revisión de exportaciones PDF/Excel específicas para gastos operativos si se requiere un reporte independiente.
- Ejecutar validación Railway solo cuando el cambio sea desplegado o se sospeche una diferencia de entorno.

# QA real con agent-browser - 2026-05-24

Evidencia guardada en `qa-output/agent-browser/report.md` y `qa-output/agent-browser/screenshots/`.

Validado en navegador real contra backend local:
- login admin y dashboard
- clientes: lista, detalle, documentos e historial
- socios: navegación corregida, creación, lista, detalle, detalles financieros, cuotas y calendario
- créditos: lista, detalle, calendario, restricciones de abono a capital, pago de cuota, actualización de historial y comprobante PDF
- pagos y cobranza: pago registrado visible en listado
- reportes: dashboard y endpoints financieros principales con 200
- configuración: métodos, tasas, mora y empleados/permisos cargando desde backend
- empleado QA: acceso limitado a perfil/notificaciones, settings redirige a perfil

Ajuste realizado durante QA:
- corregido sidebar para evitar superposición de acciones de cuenta sobre módulos administrativos en viewports bajos
- agregadas pruebas en `frontend/src/components/__tests__/Sidebar.terminology.test.tsx`

Pendiente de cierre:
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (696/696)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (216/216)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance filtros cliente y credito en exportaciones contextuales - 2026-05-24

Brecha cerrada:
- el formulario contextual de reportes ahora permite filtrar exportaciones de historial de creditos por cliente y credito
- el formulario contextual de reportes ahora permite filtrar exportaciones de pagos por cliente y credito
- los filtros se normalizan como enteros positivos antes de enviarse al servicio
- los filtros invalidos bloquean la exportacion y muestran mensajes operativos desde i18n
- las etiquetas nuevas son especificas del exportador para evitar ambiguedad con los filtros internos de otras pestañas
- `exportContextualReport` recibe `customerId` y `loanId` para `credits` y `payouts`, alineado con los contratos backend existentes

Validacion:
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque no existian campos `Cliente del reporte` ni `Credito del reporte`
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (21/21)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (228/228)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance trazabilidad de operador en pagos financieros - 2026-05-24

Brecha cerrada:
- los pagos de cuota ahora persisten `createdByUserId` con el operador que registró el movimiento
- los pagos parciales ahora persisten `createdByUserId` con el operador que registró el movimiento
- los pagos totales ahora persisten `createdByUserId` con el operador que ejecutó el cierre
- el abono a capital conserva la trazabilidad que ya existía y queda alineado con los otros movimientos de caja
- el historial de pagos puede relacionar todos estos movimientos con `createdBy`, usando la asociación existente del modelo

Validacion:
- completado: prueba roja backend en `tests/paymentApplicationService.test.js`; fallo porque `createdByUserId` era `undefined` en pagos de cuota, parciales y pago total
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/paymentApplicationService.test.js` (31/31)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/paymentApplicationService.test.js tests/payoutsModule.test.js tests/payoutsRouter.test.js tests/reportsExcelExport.test.js tests/reportsRepository.test.js tests/schema.test.js` (112/112)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (731/731)
- completado: `git diff --check`

# Avance flujo de caja y socios - 2026-05-24

Brecha cerrada:
- los pagos de intereses a socios ahora se descuentan de la caja disponible mensual
- el reporte JSON de flujo de caja expone `totalAssociateInterestPaid`
- el Excel de flujo de caja incluye la columna `Intereses Pagados a Socios`
- el PDF de flujo de caja incluye el total pagado a socios
- la pestaña frontend de flujo de caja muestra `Pagado a socios` en resumen y tabla mensual

Validación:
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/monthlyCashFlowReport.test.js` (5/5)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (697/697)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (15/15)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (216/216)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance cuotas vencidas de socios - 2026-05-24

Brecha cerrada:
- las cuotas de intereses de socios vencidas ahora salen con estado operativo `overdue` en la respuesta de cuotas
- el total pendiente ya no duplica cuotas vencidas; `totalPending` y `totalOverdue` quedan separados
- el Excel de socios etiqueta cuotas de interés vencidas como `Vencido`
- los administradores pueden marcar como pagadas las cuotas de socios vencidas desde el frontend

Validación:
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/associatesModule.test.js tests/reportsExcelExport.test.js` (52/52)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (698/698)
- completado: `cd frontend && npx vitest run src/components/__tests__/AssociateDetails.behavior.test.tsx` (7/7)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (217/217)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance protección de tasas usadas - 2026-05-24

Brecha cerrada:
- no se permite eliminar una política/rango de tasa cuando ya fue usada por créditos existentes
- el bloqueo se valida en backend contra `Loan.ratePolicyId`
- la eliminación de tasas conserva el historial financiero de créditos ya originados con tasa congelada

Validación:
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/configModule.test.js` (15/15)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (699/699)

# Avance filtros de fecha en flujo de caja - 2026-05-24

Brecha cerrada:
- el reporte JSON de flujo de caja mensual acepta `fromDate` y `toDate`
- los endpoints Excel y PDF de flujo de caja mensual aplican el mismo rango de fechas
- el backend filtra préstamos, pagos de cuotas y pagos de intereses a socios dentro del rango solicitado
- las fechas `YYYY-MM-DD` incluyen todo el día final para evitar excluir movimientos del cierre
- la pestaña frontend de flujo de caja permite seleccionar `Desde flujo de caja` y `Hasta flujo de caja`
- las consultas y exportaciones del frontend envían el rango seleccionado al servicio de reportes

Validación:
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/monthlyCashFlowReport.test.js` (6/6)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (700/700)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (15/15)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (217/217)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance filtro por tipo de movimiento en reportes - 2026-05-24

Brecha cerrada:
- la pestaña `Pagos y desembolsos` permite filtrar el reporte por `Tipo de movimiento`
- el filtro usa valores operativos soportados por el backend: cuota, pago parcial, abono a capital y pago total
- al cambiar filtros de pagos se reinicia la paginación a la primera página
- la consulta frontend envía `paymentType` a `usePayoutsReport`, que ya lo transmite al endpoint `/api/reports/payouts`

Validación:
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (16/16)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (218/218)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance filtro por estado en reporte de pagos - 2026-05-24

Brecha cerrada:
- la pestaña `Pagos y desembolsos` permite filtrar por `Estado de pago`
- el filtro conserva el estado operativo por defecto de pagos completados
- el operador puede consultar pagos reversados desde el mismo reporte
- al cambiar el estado se reinicia la paginación a la primera página y se envía `status` a `usePayoutsReport`

Validación:
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (17/17)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (219/219)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance filtro por tipo de movimiento en exportación de pagos - 2026-05-24

Brecha cerrada:
- la exportación contextual `Pagos por rango` permite seleccionar `Tipo de movimiento`
- el filtro de exportación usa los mismos tipos operativos que el reporte en pantalla
- `exportContextualReport` envía `paymentType` al endpoint Excel de pagos
- la exportación de pagos por rango queda alineada con el filtro visible de `Pagos y desembolsos`

Validación:
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (16/16)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (218/218)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance gastos operativos en flujo de caja - 2026-05-24

Brecha cerrada:
- el cálculo mensual de flujo de caja ahora descuenta gastos operativos completados además de préstamos e intereses pagados a socios
- el reporte JSON expone `totalOperatingExpenses` y cada mes expone `operatingExpenses`
- el Excel de flujo de caja incluye `Gastos Operativos` en resumen e historial mensual
- el PDF de flujo de caja incluye el total de gastos operativos y los descuenta en la línea mensual
- la agrupación mensual del reporte usa UTC para evitar que movimientos de medianoche caigan en el mes anterior por zona horaria local
- la pestaña frontend de flujo de caja muestra `Gastos operativos` en el detalle financiero y en la tabla mensual

Pendiente explícito:
- no existe todavía un módulo canónico persistente de gastos operativos; el repositorio de reportes deja `operatingExpenses: []` hasta que se implemente esa fuente de movimientos

Validación:
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/monthlyCashFlowReport.test.js` (7/7)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (17/17)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (701/701)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (219/219)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance fuente persistente de gastos operativos - 2026-05-24

Brecha cerrada:
- se agregó el modelo canónico `OperatingExpense` para gastos operativos completados o anulados
- el esquema requerido de arranque ahora incluye la tabla `OperatingExpenses`
- se agregó migración segura para crear `OperatingExpenses` con monto, fecha, categoría, descripción, método, referencia, usuario creador y datos de anulación
- el repositorio de reportes ya lee gastos operativos completados por rango de fechas desde `OperatingExpense`
- el flujo de caja mensual deja de depender de una lista vacía y puede descontar gastos persistidos reales

Pendiente explícito:
- todavía falta exponer CRUD/API/UI administrativa para registrar y anular gastos operativos desde el producto

Validación:
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/schema.test.js tests/reportsRepository.test.js tests/monthlyCashFlowReport.test.js` (21/21)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (702/702)
- completado: `git diff --check`

# Avance API de gastos operativos - 2026-05-24

Brecha cerrada:
- se agregó el módulo backend `operatingExpenses` montado en `/api/operating-expenses`
- la API permite listar gastos operativos con filtros de fecha y estado
- la API permite registrar gastos operativos completados con monto, fecha, categoría, descripción, método, referencia, notas y usuario creador
- la API permite anular gastos operativos conservando historial, usuario de anulación, fecha y motivo
- no existe endpoint de eliminación física para gastos operativos
- se agregaron permisos dinámicos `FINANCE_VIEW_ALL`, `FINANCE_CREATE` y `FINANCE_ANNUL` bajo el módulo `FINANZAS`
- el registry modular del backend incluye la nueva superficie financiera

Pendiente explícito:
- falta construir la UI administrativa para consultar, registrar y anular gastos operativos desde el frontend
- falta QA navegador del flujo completo cuando la UI exista

Validación:
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/operatingExpensesModule.test.js tests/moduleRegistry.test.js tests/schema.test.js tests/jsdocVerification.test.js` (24/24)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (707/707)
- completado: `git diff --check`

# Avance exportación de gastos operativos - 2026-05-24

Brecha cerrada:
- se agregó exportación canónica de gastos operativos desde `/api/reports/operating-expenses/export`
- el reporte acepta filtros de fecha y estado (`completed` o `annulled`)
- el Excel usa encabezados operativos en español y valores monetarios numéricos
- el PDF resume cantidad de registros, total reportado y estados operativos
- los estados exportados usan etiquetas de negocio como `Completado` y `Anulado`, no enums crudos
- la exportación incluye trazabilidad de registro y anulación cuando aplica
- la pestaña `Gastos operativos` permite exportar el historial filtrado en Excel o PDF
- la ruta de exportación queda protegida por permiso financiero `FINANCE_VIEW_ALL`

Validación:
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/reportsExcelExport.test.js tests/reportsRouter.test.js tests/monthlyCashFlowReport.test.js` (39/39)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (19/19)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (710/710)
- completado: `cd frontend && npm test -- --run` (221/221)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance resumen financiero diario - 2026-05-24

Brecha cerrada:
- se agregó reporte backend diario de flujo de caja sobre la misma fuente canónica del reporte mensual
- el endpoint `/api/reports/cash-flow/daily` permite consultar un día operativo o un rango de fechas
- el cálculo diario descuenta préstamos desembolsados, pagos a socios y gastos operativos completados
- pagos anulados y gastos anulados quedan excluidos del flujo diario disponible
- el reporte diario expone ingresos, egresos, gastos operativos, flujo neto y caja disponible acumulada por día
- OpenAPI documenta el nuevo endpoint y los filtros `date`, `fromDate` y `toDate`
- la pestaña `Flujo de caja` muestra un selector de fecha, resumen diario y tabla diaria con etiquetas i18n

Validación:
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/monthlyCashFlowReport.test.js` (10/10)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/monthlyCashFlowReport.test.js tests/reportsRouter.test.js tests/appComposition.test.js tests/jsdocVerification.test.js` (36/36)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (19/19)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (713/713)
- completado: `cd frontend && npm test -- --run` (221/221)
- completado: `cd frontend && npm run build`
- completado: QA navegador local con Vite y API stub; verificado `Resumen diario de caja`, `Fecha de resumen diario`, caja `$700.000`, fila `2026-03-15` y `Gastos operativos`
- completado: `git diff --check`

# Avance consulta frontend de historial mensual de créditos - 2026-05-24

Brecha cerrada:
- la pantalla `Reportes` ahora tiene una pestaña `Historial mensual` para consultar el historial mensual de créditos sin depender solo de exportaciones
- la consulta usa el endpoint canónico `/api/reports/credit-history/monthly`
- el operador puede filtrar por `Desde historial`, `Hasta historial` y `Estado del crédito`
- el resumen muestra créditos creados, capital prestado, cuotas recibidas y ganancias
- la tabla muestra por mes capital prestado, total recibido, pérdidas, ganancias y caja disponible
- las exportaciones Excel/PDF de historial de créditos se mantienen en la barra contextual existente

Validación:
- completado: prueba roja verificada en `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx`; falló porque no existía el botón `Historial mensual`
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (20/20)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (222/222)
- completado: `cd frontend && npm run build`
- completado: QA navegador local con Vite y API stub; verificado `Historial mensual de créditos`, filtro de estado, mes `2026-04`, capital `$4.000.000`, recibido `$2.500.000` y caja `-$1.500.000`

# Avance filtros por cliente y crédito en historial mensual - 2026-05-24

Brecha cerrada:
- el historial mensual avanzado de créditos acepta filtros `customerId` y `loanId` en JSON, Excel y PDF
- los filtros se normalizan como enteros positivos y rechazan valores ambiguos antes de consultar datos
- el repositorio aplica los filtros tanto a créditos originados como a pagos completados relacionados
- OpenAPI documenta los filtros de cliente y crédito para consulta y exportación
- la pestaña frontend `Historial mensual` expone controles `Cliente` y `Crédito`
- la UI solo envía ids enteros válidos para evitar coerciones como exponentes

Validación:
- completado: prueba roja backend en `tests/creditHistoryAuditReport.test.js`; falló porque `filters.customerId` no se propagaba
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; falló porque no existía el filtro `Cliente`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditHistoryAuditReport.test.js` (6/6)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditHistoryAuditReport.test.js tests/reportsRouter.test.js tests/appComposition.test.js tests/jsdocVerification.test.js` (32/32)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditHistoryAuditReport.test.js tests/monthlyCashFlowReport.test.js tests/reportsExcelExport.test.js` (36/36)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (714/714)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (20/20)
- completado: `cd frontend && npm test -- --run` (222/222)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm run build`
- completado: QA navegador local con Vite y API stub; verificado `Historial mensual de créditos`, `Cliente`, `Crédito`, `2026-05`, `$1.200.000`, `$400.000` y `-$800.000`
- completado: evidencia visual en `qa-output/monthly-credit-history-filters-browser.png`
- completado: `git diff --check`

# Avance snapshot histórico de rentabilidad por aporte - 2026-05-24

Brecha cerrada:
- cada aporte de capital de socio guarda la periodicidad de rentabilidad vigente al momento del aporte
- cada aporte de capital de socio guarda la tasa de rentabilidad vigente al momento del aporte
- el capital inicial registrado al crear un socio conserva el snapshot de tasa y periodicidad
- los aportes posteriores y reinversiones conservan el snapshot de tasa y periodicidad
- el esquema runtime exige las columnas históricas en `AssociateContributions`
- se agregó migración segura para bases existentes
- el historial de aportes del frontend muestra la rentabilidad pactada por aporte
- el modal soporta respuestas backend con `contributionDate` además del formato frontend anterior `date`

Validación:
- completado: prueba roja backend en `tests/associatesModule.test.js`; falló porque `interestTypeSnapshot` e `interestRateSnapshot` no se guardaban
- completado: prueba roja de schema en `tests/schema.test.js`; falló porque `AssociateContributions` no exigía columnas de snapshot
- completado: prueba roja frontend en `ContributionModal.behavior.test.tsx`; falló porque el modal no mostraba `Rentabilidad pactada`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/associatesModule.test.js tests/schema.test.js` (48/48)
- completado: `cd frontend && npx vitest run src/components/__tests__/ContributionModal.behavior.test.tsx` (2/2)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (714/714)
- completado: `cd frontend && npm test -- --run` (223/223)
- completado: `cd frontend && npm run build`
- completado: QA navegador local con Vite y API stub; verificado `Historial de aportes`, `$ 1.200.000` y `Rentabilidad pactada: 2,5% mensual`
- completado: evidencia visual en `qa-output/associate-contribution-rate-snapshot-browser.png`
- completado: `git diff --check`

# Avance rentabilidad histórica de aportes en exportación de socios - 2026-05-24

Brecha cerrada:
- la exportación administrativa de socios incluye `Rentabilidad del Aporte`
- la exportación administrativa de socios incluye `Tasa Histórica del Aporte %`
- los renglones de `Aporte` usan el snapshot histórico de `AssociateContributions`, no la tasa actual mutable del socio
- los renglones de distribución, resumen e intereses no inventan tasas de aporte cuando el movimiento no es un aporte
- las columnas quedan en la hoja operativa `Detalle de Socios` con encabezados en español

Validación:
- completado: prueba roja en `tests/reportsExcelExport.test.js`; falló porque faltaba la columna `Rentabilidad del Aporte`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/reportsExcelExport.test.js` (20/20)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (714/714)
- completado: `git diff --check`

# Avance PDF global de socios inversionistas - 2026-05-24

Brecha cerrada:
- el reporte administrativo global de socios ahora se puede exportar desde `/api/reports/associates/export`
- `format=pdf` genera un PDF operativo con encabezado `REPORTE DE SOCIOS INVERSIONISTAS`
- el PDF resume pagos realizados a socios, intereses pendientes y cronograma de pagos pendientes
- `format=xlsx` conserva la exportación Excel existente desde el nuevo endpoint sin romper `/api/reports/associates/excel`
- OpenAPI documenta la exportación global de socios en Excel/PDF
- la pantalla `Reportes` permite elegir `Socios inversionistas` y formato Excel/PDF desde la barra de exportación contextual
- el frontend descarga el PDF desde `/reports/associates/export` y usa textos i18n para el nuevo tipo de reporte

Validación:
- completado: prueba roja backend en `tests/reportsExcelExport.test.js`; falló porque `createExportAssociatesPdf` no existía
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; falló porque al elegir socios no existía selector `Formato`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/reportsExcelExport.test.js` (22/22)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (21/21)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (716/716)
- completado: `cd frontend && npm test -- --run` (224/224)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`
- no completado: QA navegador local de la pantalla `Reportes`; Vite devolvió 502 en `/api/*` porque el backend local no estaba levantado

# Avance filtro por socio en exportaciones de socios - 2026-05-24

Brecha cerrada:
- la exportación global de socios acepta `associateId` para filtrar por un socio inversionista específico
- el filtro aplica tanto a `/api/reports/associates/excel` como a `/api/reports/associates/export?format=pdf`
- la ruta valida `associateId` como entero positivo y no depende de coerciones parciales
- el caso de uso evita recorrer todos los socios cuando se exporta un único socio
- OpenAPI documenta el filtro `associateId` en los reportes de socios
- la barra contextual de `Reportes` muestra el campo `Socio` cuando se elige `Socios inversionistas`
- el frontend envía `associateId` como número entero al servicio de exportación y bloquea IDs inválidos en la UI

Validación:
- completado: prueba roja backend en `tests/reportsExcelExport.test.js`; falló porque el exportador usaba la lista global de socios aunque se pasara `associateId`
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; falló porque no existía el campo `Socio`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/reportsExcelExport.test.js` (24/24)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (21/21)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (718/718)
- completado: `cd frontend && npm test -- --run` (224/224)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance filtros de fecha en exportaciones de socios - 2026-05-24

Brecha cerrada:
- las exportaciones globales de socios aceptan filtros `fromDate` y `toDate`
- el filtro aplica a aportes por `contributionDate`
- el filtro aplica a distribuciones por `distributionDate`
- el filtro aplica a cuotas de interés por `paidAt` cuando están pagadas y por `dueDate` cuando están pendientes
- los totales de capital, intereses pagados, intereses pendientes y cronograma se calculan sobre los movimientos del rango filtrado
- `/api/reports/associates/excel` y `/api/reports/associates/export?format=pdf` propagan el mismo rango al caso de uso
- OpenAPI documenta `fromDate` y `toDate` en las exportaciones de socios
- el servicio frontend envía `fromDate` y `toDate` al endpoint de exportación de socios

Validación:
- completado: prueba roja backend en `tests/reportsExcelExport.test.js`; falló porque movimientos de marzo/mayo aparecían en un rango de abril
- completado: prueba roja de ruta en `tests/reportsExcelExport.test.js`; falló porque la ruta no propagaba `fromDate` y `toDate`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/reportsExcelExport.test.js` (26/26)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (720/720)
- completado: `cd frontend && npm test -- --run` (224/224)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance trazabilidad de abonos a capital - 2026-05-24

Brecha cerrada:
- los abonos a capital ahora persisten el usuario administrativo que registró el movimiento en `Payments.createdByUserId`
- se agregó migración segura para incorporar `createdByUserId` a pagos existentes y futuros
- el esquema runtime exige la columna de trazabilidad en `Payments`
- el modelo `Payment` quedó asociado con `User` como `createdBy`
- el historial de crédito carga el operador que registró cada pago
- la pestaña `Historial de pagos` muestra la columna `Registrado por`
- el flujo mantiene la fecha, valor, tipo, método y estado del abono a capital junto con el usuario responsable

Validación:
- completado: prueba roja backend en `tests/paymentApplicationService.test.js`; falló porque `createdByUserId` no se enviaba al crear el pago de capital
- completado: prueba roja de schema en `tests/schema.test.js`; falló porque `Payments` no exigía `createdByUserId`
- completado: prueba roja frontend en `src/components/__tests__/CreditDetails.behavior.test.tsx`; falló porque el historial no mostraba `Operadora Caja`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/paymentApplicationService.test.js` (31/31)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/schema.test.js` (14/14)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/reportsRepository.test.js` (3/3)
- completado: `cd frontend && npx vitest run src/components/__tests__/CreditDetails.behavior.test.tsx` (26/26)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (722/722)
- completado: `cd frontend && npm test -- --run` (225/225)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance alertas de pagos de socios - 2026-05-24

Brecha cerrada:
- las cuotas de intereses de socios ahora devuelven alertas operativas para pagos vencidos
- las cuotas de intereses de socios ahora devuelven alertas operativas para pagos próximos dentro de una ventana de 7 días
- las alertas incluyen tipo, severidad, número de cuota, fecha programada, monto y días vencidos o faltantes
- las cuotas pagadas no generan alertas aunque su fecha programada sea anterior
- la pantalla de detalle del socio muestra `Alertas de pagos a socio` en el resumen cuando hay pagos próximos o vencidos
- las alertas se muestran con texto operativo en español y sin exponer claves internas

Validación:
- completado: prueba roja backend en `tests/associatesModule.test.js`; falló porque `result.alerts` no existía
- completado: prueba roja frontend en `src/components/__tests__/AssociateDetails.behavior.test.tsx`; falló porque no se mostraba `Alertas de pagos a socio`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/associatesModule.test.js` (35/35)
- completado: `cd frontend && npx vitest run src/components/__tests__/AssociateDetails.behavior.test.tsx` (8/8)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (723/723)
- completado: `cd frontend && npm test -- --run` (226/226)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance filtro por estado en exportaciones de socios - 2026-05-24

Brecha cerrada:
- las exportaciones de socios aceptan filtro `status` para socios activos o inactivos
- el filtro se aplica antes de consultar movimientos financieros del socio, evitando mezclar aportes, distribuciones o cuotas de estados no seleccionados
- `/api/reports/associates/excel` y `/api/reports/associates/export` propagan `status` al caso de uso compartido
- OpenAPI documenta `status=active|inactive` en las exportaciones de socios
- el servicio frontend envía `status` al endpoint de exportación de socios
- la pantalla de reportes permite seleccionar estado para exportaciones de socios en Excel o PDF

Validación:
- completado: prueba roja backend en `tests/reportsExcelExport.test.js`; falló porque el exportador consultaba socios activos e inactivos al filtrar por `inactive`
- completado: prueba roja de ruta en `tests/reportsExcelExport.test.js`; falló porque la ruta no propagaba `status`
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; falló porque no existía selector `Estado` para socios
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/reportsExcelExport.test.js` (28/28)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (21/21)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (725/725)
- completado: `cd frontend && npm test -- --run` (226/226)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance exportación filtrada desde listado de socios - 2026-05-24

Brecha cerrada:
- el listado de socios usa el filtro visible `Estado` también al exportar Excel
- `Exportar Excel` envía `status=active|inactive` cuando el operador filtra la lista
- el helper `exportAssociatesExcel` acepta filtros y descarga `/api/reports/associates/excel` con query params
- el endpoint ya comparte el mismo constructor de filtros de reportes de socios, por lo que el Excel directo y el reporte contextual usan la misma regla de estado

Validación:
- completado: prueba roja frontend en `src/components/__tests__/Associates.behavior.test.tsx`; falló porque `exportAssociatesExcel` se llamaba sin argumentos
- completado: `cd frontend && npx vitest run src/components/__tests__/Associates.behavior.test.tsx` (6/6)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (21/21)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (227/227)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance desactivación histórica de socios - 2026-05-24

Brecha cerrada:
- `DELETE /api/associates/:id` ya no ejecuta borrado físico del socio inversionista
- el caso de uso `deleteAssociate` conserva el registro y cambia el estado a `inactive`
- la operación queda auditada como actualización de estado, no como eliminación destructiva
- el repositorio de socios ya no expone `destroy()` para este flujo
- el contrato HTTP responde `Socio desactivado correctamente` y devuelve el socio inactivo
- el listado frontend elimina la acción visual `Eliminar` y mantiene la acción operativa de activar/desactivar
- se preserva el historial financiero del socio y sus aportes, cuotas, intereses y movimientos asociados

Validación:
- completado: prueba roja backend en `tests/associatesModule.test.js`; falló porque el caso de uso llamaba `destroy()`
- completado: prueba roja frontend en `src/components/__tests__/Associates.behavior.test.tsx`; falló porque existía el botón `Eliminar`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/associatesModule.test.js` (36/36)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/associatesRouter.test.js` (11/11)
- completado: `cd frontend && npx vitest run src/components/__tests__/Associates.behavior.test.tsx` (7/7)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (726/726)
- completado: `cd frontend && npm test -- --run` (228/228)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance filtro de estado en exportación de pagos - 2026-05-24

Brecha cerrada:
- el exportador contextual de `Pagos por rango` ahora permite filtrar por estado de pago
- el filtro usa el mismo lenguaje operativo que la tabla de pagos: completado por defecto y reversado cuando se selecciona explicitamente
- `exportContextualReport('payouts')` recibe `status` junto con formato, rango de fechas y tipo de movimiento
- el backend ya aceptaba `status` en `/api/reports/payouts/export`, por lo que la UI queda alineada con el contrato API

Validacion:
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque no existia el selector `Estado de pago` en el exportador contextual
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (21/21)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (228/228)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance PDF de pagos y movimientos - 2026-05-24

Brecha cerrada:
- `Pagos por rango` ahora puede exportarse en Excel o PDF desde el contrato canonico `/api/reports/payouts/export`
- la exportacion PDF reutiliza los mismos filtros operativos de pagos: rango de fechas, cliente, credito, estado y tipo de movimiento
- se mantiene `/api/reports/payouts/excel` para compatibilidad con el flujo Excel existente
- el PDF resume pagos incluidos, total recibido, capital aplicado, interes aplicado, mora aplicada y detalle operativo de pagos
- OpenAPI documenta el nuevo contrato de exportacion de pagos `format=xlsx|pdf`
- la pantalla de reportes muestra el selector `Formato` tambien para `Pagos por rango`
- el servicio frontend envia `format` y descarga `reporte_pagos_<rango>.pdf` o `.xlsx` segun corresponda

Validacion:
- completado: prueba roja backend en `tests/reportsExcelExport.test.js`; fallo porque `/payouts/export?format=pdf` devolvia 404
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque `Formato` no existia para pagos
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/reportsExcelExport.test.js` (29/29)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (21/21)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (727/727)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (228/228)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance intereses pendientes de socios en flujo de caja - 2026-05-24

Brecha cerrada:
- los reportes de flujo de caja mensual y diario ahora exponen intereses pendientes de socios como obligacion financiera informativa
- los intereses pendientes no reducen caja disponible hasta que sean pagados
- el repositorio de reportes lee cuotas de socios pagadas por `paidAt` y cuotas pendientes por `dueDate` dentro del rango consultado
- el resumen mensual/diario incluye `totalAssociateInterestPending`
- las filas mensuales y diarias incluyen `associateInterestPending`
- la exportacion Excel de flujo de caja agrega la columna `Intereses Pendientes a Socios`
- la exportacion PDF de flujo de caja agrega la linea `Intereses pendientes de socios`
- la UI de reportes muestra `Pendiente a socios` en tarjetas de detalle y en tablas mensual/diaria

Validacion:
- completado: prueba roja backend en `tests/monthlyCashFlowReport.test.js`; fallo porque el flujo de caja no acumulaba intereses pendientes de socios
- completado: prueba roja backend en `tests/reportsRepository.test.js`; fallo porque el dataset solo consultaba cuotas de socios pagadas
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque la UI no mostraba `Pendiente a socios`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/monthlyCashFlowReport.test.js tests/reportsRepository.test.js` (13/13)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (21/21)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (727/727)
- completado: `cd frontend && npm test -- --run` (228/228)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance cálculo histórico de intereses por aporte de socio - 2026-05-24

Brecha cerrada:
- las nuevas cuotas programadas de intereses de socios ya no calculan todo el capital con la tasa actual del socio
- el cálculo suma el interés de cada aporte usando `interestRateSnapshot` cuando existe
- los aportes antiguos sin snapshot conservan compatibilidad usando la tasa vigente del socio como respaldo
- la cuota programada conserva el capital base total aportado
- la cuota programada guarda una tasa efectiva ponderada para auditoría del cálculo
- el flujo mantiene la programación mensual/anual existente y corrige el monto financiero generado por múltiples aportes con tasas históricas distintas

Validacion:
- completado: prueba roja backend en `tests/associatesModule.test.js`; fallo porque dos aportes de $1.000.000 al 2.5% y $500.000 al 1.5% generaban $22.500 en vez de $32.500
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/associatesModule.test.js` (37/37)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/associatesModule.test.js tests/reportsExcelExport.test.js tests/monthlyCashFlowReport.test.js` (76/76)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (728/728)
- completado: `git diff --check`

# Avance estado vencido persistente en cuotas de socios - 2026-05-24

Brecha cerrada:
- `AssociateInstallment.status` ahora admite el estado persistente `overdue`
- se agregó migración para incorporar `overdue` al enum PostgreSQL de cuotas de socios
- el arranque del backend asegura que el enum `enum_AssociateInstallments_status` tenga todos los valores esperados antes de operar
- al consultar cuotas de un socio, las cuotas pendientes vencidas se actualizan a `overdue` en el repositorio
- la respuesta de cuotas conserva la separación entre pendiente, pagado y vencido
- los detalles financieros de socios tratan `pending` y `overdue` como deuda de intereses, y reportan `debtStatus: overdue` cuando aplica
- los reportes de flujo de caja y exportaciones de socios incluyen cuotas `overdue` como obligaciones de intereses pendientes hasta que sean pagadas

Validacion:
- completado: prueba roja backend en `tests/associatesModule.test.js`; fallo porque la cuota vencida solo se calculaba como `overdue` en lectura y no se persistia
- completado: prueba roja backend en `tests/schema.test.js`; fallo porque el enum de `AssociateInstallment.status` no incluia `overdue`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/associatesModule.test.js` (37/37)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/schema.test.js tests/bootstrap.test.js tests/associatesModule.test.js` (61/61)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/reportsRepository.test.js tests/reportsExcelExport.test.js tests/monthlyCashFlowReport.test.js` (42/42)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (730/730)

# Avance estado anulado en reportes de pagos - 2026-05-24

Brecha cerrada:
- los filtros de reportes de pagos usan `annulled`, el estado real persistido por el modelo `Payment`
- el backend normaliza el filtro heredado `reversed` a `annulled` para mantener compatibilidad con enlaces o solicitudes antiguas
- el reporte JSON de pagos y las exportaciones Excel/PDF consultan pagos anulados con el mismo contrato
- la UI de reportes y la pestaña de pagos muestran el filtro operativo `Anulado`
- las llaves i18n de reportes incluyen el estado de pagos anulados sin exponer etiquetas internas en la interfaz

Validacion:
- completado: prueba roja backend en `tests/reportsModule.test.js`; fallo porque el filtro heredado `reversed` llegaba al repositorio sin normalizar
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque los selectores no aceptaban el valor `annulled`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/reportsModule.test.js tests/reportsExcelExport.test.js` (59/59)
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (21/21)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (731/731)
- completado: `cd frontend && npm test -- --run` (228/228)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance cancelacion trazable de creditos rechazados - 2026-05-24

Brecha cerrada:
- la ruta administrativa `DELETE /api/loans/:id` ya no borra fisicamente creditos rechazados
- los creditos rechazados se conservan como `cancelled` con `closureReason: cancelled` y `closedAt`
- la operacion guarda el cambio por el repositorio y conserva historial financiero/operativo
- el mensaje HTTP y la regla frontend usan semantica de cancelacion, no eliminacion irreversible
- el frontend bloquea la accion para creditos no rechazados, alineado con la regla backend

Validacion:
- completado: prueba roja backend en `tests/creditsModule.test.js` y `tests/creditsRouter.test.js`; fallo porque se ejecutaba `destroy` y el mensaje decia eliminado
- completado: prueba roja frontend en `src/services/__tests__/operationalGuards.test.ts`; fallo porque el guard seguia hablando de eliminar y permitia estados no rechazados
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditsModule.test.js tests/creditsRouter.test.js` (71/71)
- completado: `cd frontend && npx vitest run src/services/__tests__/operationalGuards.test.ts` (12/12)
- completado: `cd frontend && npx vitest run src/components/__tests__/Credits.behavior.test.tsx src/services/__tests__/operationalGuards.test.ts` (18/18)
- completado: `cd backend && npm run lint`
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (731/731)
- completado: `cd frontend && npm test -- --run` (229/229)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance fecha real en pagos de intereses a socios - 2026-05-24

Brecha cerrada:
- el frontend ya no marca cuotas de intereses de socios como pagadas sin capturar datos del pago real
- la pantalla de detalle del socio abre un modal operativo antes de pagar una cuota pendiente o vencida
- el operador registra `Fecha real de pago`, `Método de pago` y `Notas`
- `useAssociateDetails().payInstallment` envia `paymentDate`, `paymentMethod` y `notes` al endpoint `/api/associates/:id/installments/:installmentNumber/pay`
- se mantienen las invalidaciones de cuotas, calendario y detalle financiero del socio luego del pago
- los textos nuevos usan i18n en español e ingles

Validacion:
- completado: prueba roja frontend en `src/components/__tests__/AssociateDetails.behavior.test.tsx`; fallo porque no existia el modal `Registrar pago de interés`
- completado: `cd frontend && npx vitest run src/components/__tests__/AssociateDetails.behavior.test.tsx` (9/9)
- completado: `cd frontend && npx vitest run src/components/__tests__/AssociateDetails.behavior.test.tsx src/services/__tests__/associateService.test.tsx` (11/11)
- completado: `cd frontend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/associatesModule.test.js tests/associatesRouter.test.js` (48/48)
- completado: `cd frontend && npm test -- --run` (231/231)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance caja consistente en historial mensual de creditos - 2026-05-24

Brecha cerrada:
- el historial mensual avanzado de creditos ya no calcula `Caja Disponible` solo con pagos recibidos menos capital prestado
- el reporte descuenta intereses de socios efectivamente pagados dentro del rango
- el reporte descuenta gastos operativos completados dentro del rango
- cuotas pendientes de socios y gastos anulados no reducen la caja disponible
- la exportacion Excel del historial mensual agrega columnas operativas para `Intereses Pagados a Socios` y `Gastos Operativos`
- el repositorio de reportes entrega al historial mensual los movimientos financieros necesarios para reconciliar la caja con el flujo financiero

Validacion:
- completado: prueba roja backend en `tests/creditHistoryAuditReport.test.js`; fallo porque `totalAssociateInterestPaid` no existia y la caja no descontaba socios/gastos
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditHistoryAuditReport.test.js` (7/7)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditHistoryAuditReport.test.js tests/reportsRepository.test.js` (11/11)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (733/733)
- completado: `git diff --check`

# Avance auditoria visual de socios y gastos en historial mensual - 2026-05-24

Brecha cerrada:
- la pestaña frontend de historial mensual de creditos ahora muestra los intereses pagados a socios que descuenta el backend
- la misma vista muestra los gastos operativos completados que reducen la caja disponible
- el resumen operativo incluye `Pagado a socios` y `Gastos operativos` con textos i18n
- la tabla mensual agrega columnas visibles para esas salidas financieras junto al total recibido, ganancias, perdidas y caja disponible
- la UI queda alineada con la exportacion Excel/PDF y con el calculo backend de caja disponible del historial mensual

Validacion:
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque no existia el texto `Pagado a socios` en la vista de historial mensual
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (21/21)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (231/231)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance PDF auditado de historial mensual de creditos - 2026-05-24

Brecha cerrada:
- el PDF del historial mensual de creditos ahora imprime `Intereses pagados a socios`
- el mismo PDF imprime `Gastos operativos`
- el resumen PDF queda alineado con la caja disponible que ya descuenta pagos a socios y gastos completados
- la exportacion PDF ya no oculta salidas financieras que explican por que la caja disponible puede ser menor que pagos recibidos menos capital prestado

Validacion:
- completado: prueba roja backend en `tests/creditHistoryAuditReport.test.js`; fallo porque el PDF contenia `Caja disponible` pero no `Intereses pagados a socios`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditHistoryAuditReport.test.js` (7/7)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditHistoryAuditReport.test.js tests/reportsExcelExport.test.js tests/reportsModule.test.js` (66/66)
- completado: `cd backend && npm run lint`
- completado: `git diff --check`

# Avance detalle mensual en PDF de historial de creditos - 2026-05-24

Brecha cerrada:
- el PDF de historial mensual de creditos ya no queda solo en resumen general
- la exportacion PDF incluye una seccion `Detalle mensual`
- cada fila mensual expone capital prestado, total recibido, intereses pagados a socios, gastos operativos y caja disponible
- el PDF queda mas alineado con la tabla frontend y la hoja Excel `Historial Mensual`
- el operador puede auditar por mes por que la caja disponible cambia con salidas a socios y gastos

Validacion:
- completado: prueba roja backend en `tests/creditHistoryAuditReport.test.js`; fallo porque el PDF no contenia `Detalle mensual`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditHistoryAuditReport.test.js` (7/7)
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditHistoryAuditReport.test.js tests/reportsExcelExport.test.js tests/reportsModule.test.js` (66/66)
- completado: `cd backend && npm run lint`
- completado: `git diff --check`

# Avance validacion de IDs en historial mensual frontend - 2026-05-24

Brecha cerrada:
- los filtros `Cliente` y `Credito` del historial mensual ya no aceptan notacion exponencial
- la UI evita que `2e3` se convierta en `2000` dentro del navegador
- un valor invalido ya no reemplaza un filtro valido previo ni amplia la consulta mensual sin querer
- los campos usan entrada textual con teclado numerico y validacion de digitos enteros
- el frontend queda alineado con las validaciones backend de IDs positivos para reportes

Validacion:
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque `2e3` reemplazaba el cliente visible por `2000`
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (22/22)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (232/232)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance validacion de IDs en exportacion contextual - 2026-05-24

Brecha cerrada:
- los filtros `Cliente del reporte`, `Credito del reporte` y `Socio` de la barra de exportacion ya no aceptan notacion exponencial
- la UI evita que `2e3`, `1e5` o `4e2` reemplacen IDs validos previos
- los filtros contextuales de creditos, pagos y socios quedan alineados con la validacion de IDs positivos del backend
- se evita que una exportacion contextual se dispare con un ID convertido implicitamente por el navegador

Validacion:
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque `2e3` reemplazaba `Cliente del reporte`
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (23/23)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (233/233)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance rango valido en historial mensual frontend - 2026-05-24

Brecha cerrada:
- la pestaña `Historial mensual` ya no permite invertir el rango de fechas visible
- si `Hasta historial` queda antes de `Desde historial`, la UI conserva el valor anterior valido
- el frontend evita construir consultas que el backend rechaza con `startDate must be before or equal to endDate`
- el operador mantiene un rango mensual consistente antes de consultar JSON o exportaciones relacionadas

Validacion:
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque `Hasta historial` aceptaba `2026-04-30` cuando `Desde historial` era `2026-05-01`
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (24/24)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (234/234)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance rango valido en flujo de caja frontend - 2026-05-24

Brecha cerrada:
- la pestaña `Flujo de caja` ya no permite invertir el rango de fechas mensual
- si `Hasta flujo de caja` queda antes de `Desde flujo de caja`, la UI conserva el valor anterior valido
- el frontend evita consultar o exportar flujo de caja con rangos inconsistentes
- el control queda alineado con la validacion aplicada al historial mensual y con los contratos backend de reportes

Validacion:
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque `Hasta flujo de caja` aceptaba `2026-02-28` cuando `Desde flujo de caja` era `2026-03-01`
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (25/25)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (235/235)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance rango valido en gastos operativos frontend - 2026-05-24

Brecha cerrada:
- la pestaña `Gastos operativos` ya no permite invertir el rango de fechas del historial de gastos
- si `Hasta gastos` queda antes de `Desde gastos`, la UI conserva el valor anterior valido
- el frontend evita consultar o exportar gastos operativos con rangos inconsistentes
- el control queda alineado con flujo de caja, historial mensual y contratos backend de reportes

Validacion:
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque `Hasta gastos` aceptaba `2026-04-30` cuando `Desde gastos` era `2026-05-01`
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (26/26)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (236/236)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance rango valido en gastos operativos backend - 2026-05-24

Brecha cerrada:
- el listado backend de gastos operativos ya no acepta `fromDate` posterior a `toDate`
- la exportacion backend de gastos operativos ya no acepta rangos invertidos aunque se llame directo por API
- ambas validaciones ocurren antes de consultar repositorios financieros
- la restriccion queda alineada con la UI y con la regla global de no saltarse controles desde frontend ni API

Validacion:
- completado: prueba roja backend en `tests/operatingExpensesModule.test.js`; fallo porque el listado no rechazaba `fromDate=2026-05-31&toDate=2026-05-01`
- completado: prueba roja backend en `tests/reportsExcelExport.test.js`; fallo porque la exportacion de gastos no rechazaba el rango invertido
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/operatingExpensesModule.test.js tests/reportsExcelExport.test.js` (35/35)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (735/735)
- completado: `git diff --check`

# Avance rango valido en exportacion contextual frontend - 2026-05-24

Brecha cerrada:
- la barra global de exportacion de reportes ya no permite dejar `Hasta` antes de `Desde`
- si el operador intenta invertir el rango, la UI conserva el ultimo valor valido
- las exportaciones contextuales de creditos, pagos, socios y rentabilidad evitan filtros de fecha inconsistentes desde pantalla
- el comportamiento queda alineado con historial mensual, flujo de caja y gastos operativos

Validacion:
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque `Hasta` aceptaba `2026-05-31` cuando `Desde` era `2026-06-01`
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (27/27)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (237/237)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance rango valido en exportaciones contextuales backend - 2026-05-24

Brecha cerrada:
- las exportaciones backend de creditos rechazan `startDate` posterior a `endDate` antes de leer prestamos
- las exportaciones backend de pagos rechazan rangos invertidos antes de leer movimientos
- las exportaciones backend de socios rechazan rangos invertidos antes de leer registros de socios
- la exportacion de rentabilidad rechaza rangos invertidos antes de leer datos financieros
- la validacion queda centralizada para reportes que usan `parseDateRange` y conectada en exportadores con normalizacion propia

Validacion:
- completado: pruebas rojas backend en `tests/reportsExcelExport.test.js`; fallaron creditos, pagos y socios porque aceptaban rangos invertidos
- completado: prueba roja backend en `tests/reportsModule.test.js`; fallo rentabilidad porque aceptaba `fromDate=2026-05-31&toDate=2026-05-01`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/reportsExcelExport.test.js tests/reportsModule.test.js` (64/64)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (739/739)
- completado: `git diff --check`

# Avance rango valido en filtros de pagos frontend - 2026-05-24

Brecha cerrada:
- la pestaña `Pagos y desembolsos` ya no permite invertir su rango de fechas propio
- si el operador intenta poner `Hasta` antes de `Desde`, la UI conserva el ultimo valor valido
- la consulta paginada de pagos evita enviar filtros inconsistentes al backend
- el filtro queda alineado con la barra global de exportacion, historial mensual, flujo de caja y gastos operativos

Validacion:
- completado: prueba roja frontend en `src/components/__tests__/Reports.behavior.test.tsx`; fallo porque el filtro de pagos aceptaba `Hasta=2026-06-30` cuando `Desde=2026-07-01`
- completado: `cd frontend && npx vitest run src/components/__tests__/Reports.behavior.test.tsx` (28/28)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (238/238)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance rango valido en calendario de socios backend - 2026-05-24

Brecha cerrada:
- el calendario backend de socios ya no acepta `startDate` posterior a `endDate`
- la validacion ocurre antes de leer eventos financieros de socios
- el rango se normaliza como fecha operacional antes de consultar aportes, distribuciones e intereses programados
- la restriccion protege el calendario de pagos de socios aunque se llame directo por API

Validacion:
- completado: prueba roja backend en `tests/associatesModule.test.js`; fallo porque el calendario leia eventos con `startDate=2026-12-31&endDate=2026-01-01`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/associatesModule.test.js tests/associatesRouter.test.js` (49/49)
- completado: `cd backend && npm run lint`
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test` (740/740)
- completado: `git diff --check`

# Avance filtros de calendario de socios frontend - 2026-05-24

Brecha cerrada:
- el detalle frontend del socio ahora permite filtrar el calendario por `Desde calendario` y `Hasta calendario`
- la pantalla conserva el ultimo rango valido si el operador intenta dejar `Hasta calendario` antes de `Desde calendario`
- el hook administrativo de socios envia `startDate` y `endDate` al endpoint `/associates/:id/calendar-events`
- la query key del calendario incluye los filtros para evitar reutilizar datos de otro rango

Validacion:
- completado: prueba roja frontend en `src/services/__tests__/associateService.test.tsx`; fallo porque el calendario se consultaba sin parametros de rango
- completado: prueba roja frontend en `src/components/__tests__/AssociateDetails.behavior.test.tsx`; fallo porque no existian controles `Desde calendario` ni `Hasta calendario`
- completado: `cd frontend && npx vitest run src/services/__tests__/associateService.test.tsx src/components/__tests__/AssociateDetails.behavior.test.tsx` (13/13)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (240/240)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance rango valido en calendario operativo de creditos frontend - 2026-05-24

Brecha cerrada:
- el calendario operativo de creditos ya no permite dejar `Hasta` antes de `Desde`
- si el operador intenta invertir el rango, la pantalla conserva el ultimo valor valido
- la proteccion vive en el estado dueño de la pantalla de creditos y evita consultas inconsistentes a `/loans/calendar/overview`
- el filtro queda alineado con reportes, calendario de socios y la regla global de no enviar rangos financieros invalidos

Validacion:
- completado: prueba roja frontend en `src/components/__tests__/Credits.behavior.test.tsx`; fallo porque el calendario aceptaba `Hasta=2026-06-30` cuando `Desde=2026-07-01`
- completado: `cd frontend && npx vitest run src/components/__tests__/Credits.behavior.test.tsx` (7/7)
- completado: `cd frontend && npm run lint`
- completado: `cd frontend && npm test -- --run` (241/241)
- completado: `cd frontend && npm run build`
- completado: `git diff --check`

# Avance validación de rango calendario de creditos backend - 2026-05-24

Brecha cerrada:
- el endpoint backend `/loans/calendar/overview` rechaza `startDate` posterior a `endDate` antes de resolver calendario
- la regla de orden de fechas vive en `parseCalendarOverviewFilters` y se ejecuta en el caso de uso `getPaymentCalendarOverview`
- se evita calcular agenda cuando el rango recibido es inválido, evitando consultas inconsistentes desde backend

Validacion:
- completado: prueba roja en `backend/tests/creditsModule.test.js`; fallo porque el rango invertido no era validado
- completado: prueba roja en `backend/tests/creditsRouter.test.js`; fallo porque el endpoint devolvía contrato inválido sin bloqueo
- completado: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditsModule.test.js tests/creditsRouter.test.js` (73/73)
- completado: `git diff --check`

# Cierre objetivo integral financiero - 2026-05-24

Estado:
- Se ejecutó verificación completa de los escenarios críticos definidos en el objetivo (`permisos`, `socios`, `tasas`, `abonos a capital`, `flujo de caja`, `reportes`, validaciones de rango/ID y persistencia operativa) con la suite activa del repositorio.

Validación ejecutada:
- `cd backend && NODE_ENV=test node --require module-alias/register --test` (742/742)
- `cd backend && npm run lint`
- `cd frontend && npm run lint`
- `cd frontend && npm test -- --run` (241/241)
- `cd frontend && npm run build`
