# Auditoría QA del sistema de créditos - 2026-04-30

## Entorno

- Rama: `codex/credit-system-audit-railway`
- Backend Railway: `https://backend-production-4d24.up.railway.app`
- Frontend QA local: `http://127.0.0.1:3000` apuntando al backend Railway mediante proxy Vite.
- Nota histórica: esta auditoría fue ejecutada antes del retiro del workbench visual. El cálculo vigente ya no usa rollout DAG.
- Usuario QA principal: `qa.admin.20260427@test.local`

## Hallazgos corregidos

### Fecha de primer pago

- Problema: si una integración enviaba `startDate` como fecha-hora con zona horaria, la persistencia podía guardar el día UTC resultante y no el día operativo seleccionado.
- Corrección: la creación de crédito normaliza la fecha seleccionada como fecha UTC pura usando el prefijo `YYYY-MM-DD`, igual que el motor de cálculo financiero.
- Prueba agregada: `createLoanFromCanonicalData stores the selected payment date without timezone drift`.

### Abono a capital y cronograma afectado

- Problema de datos en Railway: el crédito `#6` conservaba cuotas futuras en estado `Parcial` por una aplicación anterior de abono a capital.
- Reporte previo de reparación:
  - crédito afectado: `#6`
  - primera cuota afectada: `#4`
  - abono aplicado: `$2.000.000`
  - estrategia: `reduce_term`
  - cuotas antes: `12`
  - cuotas después: `8`
- Acción aplicada: `backend/scripts/repairCapitalPaymentSchedules.js --loan-id=6 --apply` dentro del contenedor backend Railway.
- Verificación browser: `/credits/6` muestra cuotas futuras como `Pendiente`; no quedan cuotas futuras `Parcial` causadas por el abono.

### Acciones del calendario operativo

- Problema: las acciones por cuota podían verse apiladas o desalineadas en la tabla de detalle.
- Corrección: la celda de acciones se presenta como toolbar horizontal compacta, con ancho estable, colores por tipo de acción y `aria-label` por cuota.
- Prueba agregada: `renders installment row actions as a compact horizontal toolbar`.

### Ayuda en dashboard

- Mejora: se agregaron tooltips operativos a las gráficas principales del dashboard para explicar desembolsado, recuperado y diferencia de cartera.
- Prueba ajustada: `uses terminology labels in dashboard widgets and chart legends`.

## Evidencia técnica ejecutada

- Backend enfocado:
  - `NODE_ENV=test node --require module-alias/register --test tests/paymentApplicationService.test.js tests/credits/paymentApplicationService.test.js tests/creditFormulaHelpers.test.js tests/creditDomain.test.js`
  - Resultado: `61` pruebas pasando.
- Frontend enfocado:
  - `npx vitest run src/components/__tests__/CreditDetails.behavior.test.tsx --testNamePattern "compact horizontal toolbar"`
  - Resultado: prueba pasando.
  - `npx vitest run src/components/__tests__/Dashboard.behavior.test.tsx --testNamePattern "terminology labels"`
  - Resultado: prueba pasando.

## Pendiente para cierre total

- Ejecutar suite completa backend y frontend.
- Ejecutar QA browser por rol `customer` y `socio`.
- Validar exportes UI reales en `/reports`.
- Validar configuración QA nueva sin tocar políticas activas reales.
