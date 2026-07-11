# Rediseño de operaciones financieras

## Objetivo

Rehacer Socios, Analítica y Reportes como un flujo financiero coherente para CrediCobranza. La plataforma debe explicar de dónde sale cada cifra, permitir operar desde el contexto correcto y presentar la misma verdad en pantalla, API, Excel y PDF.

## Fuente de verdad

Esta especificación toma como fuente de verdad los acuerdos descritos en el hilo y los movimientos financieros canónicos actuales. No se conservarán contratos, etiquetas, rutas o cálculos legacy por compatibilidad.

## Principios funcionales

- Socios administra inversionistas mediante capital aportado, capital devuelto, reinversiones, rentabilidad pactada, obligaciones de interés y pagos reales.
- Analítica resume posición, riesgo y tendencia; no crea movimientos ni reconstruye cifras en el navegador.
- Reportes concilia movimientos registrados y exporta exactamente la misma información mostrada.
- Cada métrica debe enlazarse conceptualmente con el conjunto de registros que la explica.
- Backend calcula agregados financieros. Frontend formatea y presenta, pero no replica fórmulas.
- Todas las fechas son fechas operativas de Colombia y todos los montos usan COP.

## Socios

### Creación

El formulario solicita únicamente nombre, correo, teléfono, estado, capital inicial, periodicidad de rentabilidad, tasa y día/mes de pago según aplique. Un capital inicial crea el aporte y la primera obligación dentro de una transacción.

### Lista

La lista muestra identidad, capital vigente, términos pactados, próximo vencimiento, estado y acciones. El resumen superior contiene capital vigente total, intereses abiertos, próximos vencimientos y socios activos. La búsqueda y el filtro se aplican en backend.

### Seguimiento

La vista principal muestra obligaciones vencidas y próximas. Desde cada obligación se registra el pago solicitando solo fecha real y método. La actividad separa aportes, pagos programados, pagos manuales, reinversiones y devoluciones.

### Detalle

El detalle se divide en Resumen, Capital, Rentabilidad y Calendario. Capital muestra aportes, reinversiones y devoluciones. Rentabilidad muestra pagos programados, pagos manuales y obligaciones abiertas. Ninguna devolución o reinversión se contabiliza como interés pagado.

## Analítica

El Dashboard presenta cuatro niveles:

1. Posición actual: caja disponible, cartera por cobrar, capital colocado y obligaciones con socios.
2. Operación del período: recaudo, desembolsos, gastos y pagos a socios.
3. Riesgo: créditos en mora, capital en riesgo y obligaciones vencidas con socios.
4. Tendencia: serie mensual de entradas, salidas, cartera y mora.

Cada indicador consume un read-model backend explícito con valor, comparación, unidad y destino operativo. Los widgets configurables se conservan solo si no ocultan las métricas críticas ni producen alturas arbitrarias.

## Reportes

Los informes canónicos son:

- Cierre contable: entradas por cuotas, préstamos desembolsados, pagos a socios, gastos, flujo neto, caja y cartera.
- Créditos del período: créditos creados y desembolsados, estado y saldos.
- Recaudo: pagos completados, capital, interés, mora, método y responsable.
- Cartera por cobrar: saldos abiertos, atraso y capital en riesgo.
- Movimientos de socios: aportes, pagos manuales, reinversiones, devoluciones, intereses pagados y pendientes.
- Gastos operativos: movimientos completados o anulados con trazabilidad.

Los filtros de período, estado y búsqueda se comparten. Excel y PDF deben respetar filtros, etiquetas y totales. No se admiten Participación %, Total Proporcional, Monto Asignado, `proportional`, `participationPercentage` ni “no clasificado”.

## Arquitectura

- `backend/src/modules/associates`: escritura y lectura operativa de socios.
- `backend/src/modules/reports`: read-models de analítica, conciliación y exportaciones.
- `frontend/src/components/shared`: superficies, métricas, filtros, tablas, modales y estados reutilizables.
- `frontend/src/components/associates`: navegación y vistas específicas del dominio.
- `frontend/src/components/reports`: pestañas y paneles de informes.
- `frontend/src/components/dashboard`: composición de indicadores y tendencias cuando la extracción reduzca responsabilidad de `Dashboard.tsx`.

No se crearán endpoints alias. Los contratos retirados responderán 400.

## Dirección visual

La interfaz adopta una estética de libro mayor operativo: fondo neutro, superficies blancas, divisores finos, números tabulares y color reservado para estado y acción. El acento teal existente identifica selección y acción primaria, sin barras decorativas, resplandores o tarjetas coloreadas.

La firma visual es la línea de conciliación: grupos compactos de etiqueta, valor y procedencia que permiten leer una cifra y su composición sin abrir otra pantalla. Solo aparece donde una métrica tiene tres o más componentes.

Desktop usa tablas compactas y paneles progresivos. Mobile convierte tablas operativas en filas apiladas, usa navegación en cuadrícula o selector y evita overflow de página. Una sola acción primaria domina cada contexto.

## Errores y estados vacíos

- Los errores de validación indican el campo y la corrección necesaria.
- Los estados vacíos describen qué registro falta y ofrecen la acción válida cuando existe.
- Un fallo de un informe no bloquea los demás.
- Ningún error muestra detalles internos, nombres de columnas o trazas.

## Verificación

- Flujos reales en navegador: crear socio mensual y anual, registrar movimientos, pagar obligación, revisar detalle, Dashboard y cada reporte.
- Desktop 1440 px y mobile 390 px sin overflow de página.
- Consola sin errores o warnings de aplicación.
- Contratos HTTP para campos retirados, permisos, filtros y exportaciones.
- Pruebas funcionales backend/frontend, lint y build completos.
- Inspección visual y textual de Excel/PDF.
- Búsqueda final de términos y rutas legacy.

## Fuera de alcance

- Portal de autoservicio para socios.
- Asignación porcentual de socios a créditos.
- Compatibilidad con payloads o rutas retiradas.
- Nuevos proveedores externos o cambios de infraestructura.
