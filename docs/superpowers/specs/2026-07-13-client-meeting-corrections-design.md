# Correcciones de la reunión con el cliente

## Objetivo

Auditar y completar CrediCobranza contra los acuerdos de la reunión transcrita en `transcripcion_completa.txt`. La entrega debe preservar las correcciones financieras ya presentes, reparar cualquier divergencia comprobada y dejar una experiencia de escritorio directa para créditos, reportes, analítica y socios.

## Interpretación de la reunión

Damien es el desarrollador que explica el comportamiento actual y acepta los ajustes. Las intervenciones del cliente definen estas necesidades:

1. Después de un abono a capital, la simulación, el calendario persistido y el cobro de la siguiente cuota deben coincidir.
2. `Reducir plazo` conserva aproximadamente el valor de la cuota y disminuye la cantidad de cuotas pendientes.
3. `Reducir cuota` distribuye el capital vivo en el plazo elegido y cobra el valor mostrado en la simulación; nunca puede degradarse a una cuota compuesta solo por interés.
4. Reportes debe permitir consultar en pantalla y exportar información por períodos elegidos sin recorrer subdivisiones analíticas difíciles de entender.
5. Los informes canónicos son Cierre contable, Créditos del período, Pago de cuotas, Cartera por cobrar, Movimientos de socios y Gastos operativos.
6. Cierre contable es una consulta histórica por rango con cartera, recaudo, caja y egresos. No bloquea ni vuelve inmutables los movimientos del período.
7. Los indicadores deben distinguir capital, ingreso, interés, mora y ganancia. Capital recaudado o desembolsado no puede presentarse como ganancia.
8. Socios representa inversionistas con capital aportado y rentabilidad pactada. No usa participación sobre utilidades ni detiene intereses al alcanzar un porcentaje acumulado.
9. La experiencia prioritaria es PC. No se requiere rediseño ni verificación específica para móvil en este alcance.

## Estado existente que debe preservarse

El repositorio ya contiene correcciones posteriores a la reunión:

- El backend reconstruye calendarios después de abonos a capital y expone una simulación canónica.
- Existe una prueba basada en el caso de la reunión: capital vivo de COP 824.349, abono de COP 324.349, nuevo capital de COP 500.000 y cinco cuotas cercanas a COP 115.487.
- Reportes ya incluye los informes operativos solicitados, con exportaciones Excel/PDF.
- Socios ya fue migrado a aportes, rentabilidad pactada, reinversión y devolución de capital.
- Dashboard ya separa posición, operación, riesgo y tendencia.

Estos puntos son candidatos a estar terminados, no supuestos de corrección. Deben demostrarse con pruebas actuales y con el producto ejecutándose.

## Arquitectura y responsabilidades

### Créditos y abonos

`backend/src/modules/credits/application/paymentApplicationService.js` conserva la única lógica de simulación y aplicación del abono. Ambos caminos deben reconstruir el calendario con la misma función y la fecha operativa seleccionada. La cotización de cobro debe leer el calendario canónico persistido, sin recalcular una cuota alternativa en frontend.

El frontend únicamente captura monto, estrategia, fecha y plazo nuevo; presenta la simulación del backend y envía exactamente esos datos al registrar el abono.

### Reportes

`backend/src/modules/reports` mantiene cálculos, filtros y exportaciones. `frontend/src/components/Reports.tsx` compone seis destinos operativos explícitos y cada panel presenta filtros, tabla y descargas en el mismo contexto.

El cierre contable es un read-model. Sus entradas y salidas deben conciliar con movimientos registrados. Excel y PDF deben respetar el mismo período, etiquetas, filas y totales visibles.

### Dashboard y analítica

El backend entrega métricas con significado financiero único. La interfaz agrupa:

- Posición actual: caja, cartera, capital colocado y obligaciones con socios.
- Operación acumulada o del período: recaudo, aportes, desembolsos, gastos, pagos a socios y devoluciones.
- Riesgo: mora y obligaciones vencidas.
- Tendencia: entradas y salidas mensuales.

No se mostrará una métrica de `Ganancia total` si incluye capital. Cuando una cifra combine componentes, la interfaz mostrará su composición.

### Socios

`backend/src/modules/associates` conserva aportes, obligaciones de interés, pagos reales, reinversiones y devoluciones como movimientos separados. Las pantallas de gestión y seguimiento no reintroducen participación porcentual ni topes de rentabilidad.

## Diseño de escritorio

La aplicación mantendrá su lenguaje actual de libro mayor operativo: fondo neutro, superficies claras, divisores finos, tipografía legible y color reservado para acción o estado.

- El contenido aprovecha el ancho disponible en pantallas de 1280 a 1920 px.
- La navegación de reportes presenta los seis informes sin ocultarlos en `Más indicadores`.
- Filtros frecuentes se disponen horizontalmente y permanecen junto a la tabla que controlan.
- Tablas usan densidad suficiente para comparar registros sin desplazamiento vertical excesivo.
- Solo se usan contenedores cuando expresan una agrupación funcional.
- Las acciones primarias tienen texto; los iconos sin texto conservan nombre accesible y tooltip.
- Estados de foco, error, carga, vacío y deshabilitado deben ser visibles.
- A 200 % de zoom, el flujo sigue siendo operable mediante desplazamiento normal, sin controles cortados.

No se incorporarán gradientes, glassmorphism, tarjetas decorativas, métricas inventadas, animaciones ornamentales ni una segunda arquitectura de estilos.

## Errores, consistencia y seguridad

- Un abono inválido falla antes de persistir y explica la condición corregible.
- La misma clave de idempotencia no registra dos movimientos financieros.
- Un rango de fechas inválido no ejecuta consultas ni exportaciones.
- Los errores de un informe no falsifican datos ni bloquean el acceso a otros informes.
- Permisos de lectura, creación, anulación y exportación se mantienen en backend y frontend.
- Las anulaciones conservan trazabilidad; no eliminan registros financieros.

## Estrategia de prueba

### Automatizada

- Ejecutar primero la prueba exacta de simulación, aplicación y siguiente cotización de `reduce_payment`.
- Añadir una prueba de regresión antes de cualquier corrección nueva que cambie comportamiento.
- Ejecutar pruebas de `reduce_term`, fechas operativas, idempotencia y validación del plazo.
- Validar contratos, filtros y exportaciones de cada informe.
- Validar que Dashboard no etiquete capital como ganancia.
- Validar contratos de Socios y ausencia de términos retirados en superficies de usuario.
- Ejecutar lint, suites completas backend/frontend y build de producción.

### Navegador de escritorio

En una base de datos de QA controlada:

1. Iniciar sesión como administrador.
2. Crear un crédito de COP 2.000.000 a doce meses con la tasa usada en el caso de la reunión.
3. Pagar la primera cuota.
4. Abonar capital y reducir plazo; comparar simulación, calendario y cobro.
5. Pagar otra cuota y abonar capital hasta dejar COP 500.000; reducir cuota a cinco cuotas y comprobar el valor cercano a COP 115.487 en simulación, calendario y cobro.
6. Consultar cada informe con un rango que contiene datos y otro vacío.
7. Exportar Excel y PDF e inspeccionar período, encabezados, filas y totales.
8. Revisar Dashboard y Socios con los movimientos creados.
9. Probar teclado, foco, 100 % y 200 % de zoom en 1280x800, 1440x900 y 1920x1080.
10. Inspeccionar consola y solicitudes de red para errores, warnings, duplicados y respuestas fallidas.

## Criterios de aceptación

- El caso financiero de la reunión produce el mismo importe en simulación, calendario persistido y cobro siguiente.
- Los seis informes son visibles directamente, consultables por período y exportables.
- Cierre contable concilia cuotas, desembolsos, socios, devoluciones, gastos, resultado, caja y cartera.
- Ningún indicador presenta capital como ganancia o utilidad.
- Socios se comporta como capital con rentabilidad pactada, sin participación sobre utilidades.
- Los recorridos de escritorio son claros, densos y operables con teclado y zoom.
- No hay regresiones en suites, lint, build, consola o red.

## Fuera de alcance

- Cierre irreversible o bloqueo contable de períodos.
- Portal externo para clientes o socios.
- Certificados CDT, vencimiento contractual o renovación automática.
- Rediseño móvil.
- Nuevas dependencias o infraestructura.
