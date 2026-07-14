# Reportes operativos limpios

## Problema

El módulo actual obliga a interpretar demasiada interfaz antes de leer un reporte: seis pestañas dentro de una superficie con borde, un segundo encabezado que repite el reporte activo, filtros siempre visibles y dos botones de exportación. En el cierre contable, cada celda apila el total y varios renglones de desglose; el pie repite toda esa información.

El cliente necesita consultar y descargar informes, no configurar una herramienta analítica. La primera vista debe responder qué reporte está abierto y cuáles son sus datos, dejando filtros y formato de descarga como acciones secundarias.

## Decisión de diseño

Se conserva una sola página de reportes y los seis informes existentes. La solución reduce peso visual sin introducir un asistente, menús profundos ni rutas nuevas.

1. La navegación pasa de seis bloques del mismo peso a una barra de pestañas textual, compacta y sin tarjeta. El informe activo se distingue por contraste y una línea inferior.
2. Cada informe tiene un solo encabezado operativo: nombre, descripción breve y, a la derecha, `Filtros` y `Descargar` cuando correspondan.
3. Los filtros permanecen cerrados al entrar. El reporte carga con valores útiles por defecto. El botón indica cuántos filtros opcionales están activos y el panel se abre automáticamente cuando ya existe alguno.
4. La descarga usa una sola acción. Al abrirla se elige Excel o PDF en el modal existente; los dos formatos dejan de competir permanentemente con el contenido.
5. La tabla empieza inmediatamente después del encabezado. No se repite el nombre del informe en otra tarjeta.
6. En el cierre contable, los totales de entradas y salidas siguen visibles. El desglose aparece en una línea secundaria compacta y el total final no repite el desglose completo.

## Alternativas descartadas

- **Selector desplegable de reporte:** libera más espacio, pero oculta los informes y añade una interacción a cada cambio frecuente.
- **Panel lateral interno:** ordena bien muchos informes, pero duplica la navegación principal y consume ancho de la tabla.
- **Mantener la estructura y reducir solo espacios:** mejora la captura, pero no elimina las decisiones y acciones que causan la sobrecarga.

La barra textual mantiene todos los informes descubribles con un solo clic y reduce la presencia de la navegación.

## Arquitectura

- `Reports.tsx` conserva el estado y las consultas. Elimina el encabezado duplicado y pasa un único control de descarga a cada informe.
- `ReportTabPanel` se convierte en el encabezado común del informe y controla la apertura accesible de filtros.
- `ReportDownloadModal` expone un control reutilizable que combina el disparador y el modal sin duplicar estado en cada pestaña.
- Las pestañas de créditos, pagos, socios, cartera, cierre y gastos continúan siendo responsables de sus filtros y tablas.
- El contrato del backend, los parámetros de exportación, permisos, paginación y cálculos financieros no cambian.

## Comportamiento

### Navegación

- Las seis pestañas permanecen visibles en escritorio.
- Teclado, foco y atributos `tab`/`aria-selected` se conservan.
- La barra puede desplazarse horizontalmente en anchos estrechos, aunque escritorio es la superficie prioritaria.

### Filtros

- `Filtros` abre y cierra el panel con `aria-expanded` y `aria-controls`.
- El panel usa los mismos controles y validaciones existentes.
- Cambiar un filtro sigue actualizando la consulta y la exportación correspondiente.
- Si hay filtros opcionales activos, el botón muestra la cantidad y el panel permanece abierto al cambiar de reporte o de datos.
- El año del cierre es contexto base, no se cuenta como filtro; el rango de fechas sí.

### Descarga

- Solo aparece `Descargar` en la superficie principal.
- El modal muestra Excel y PDF y se cierra tras una exportación confirmada.
- Permisos, rangos inválidos y estados de carga siguen bloqueando la descarga.

### Datos

- No se eliminan columnas ni cifras financieras.
- El cierre muestra entradas, salidas, flujo neto y caja disponible con jerarquía clara.
- El desglose de entradas y salidas usa una sola línea secundaria separada por puntos medios.
- El pie muestra únicamente los totales del período.

## Accesibilidad

- Navegación semántica de pestañas y foco visible.
- Botón de filtros con estado expandido anunciado.
- Panel de filtros asociado mediante `aria-controls`.
- Modal de descarga conserva gestión de foco, cierre y nombres accesibles del sistema.
- Las cifras no dependen solo del color; positivo y negativo mantienen texto y formato numérico.

## Errores y estados

- Carga, vacío, error parcial y permisos se mantienen dentro del reporte activo.
- Un error en un informe no bloquea la barra de navegación ni los demás informes.
- Los filtros inválidos no ejecutan consultas o exportaciones incorrectas.
- Los datos del formulario de gasto y los filtros activos se conservan al abrir o cerrar modales.

## Aceptación

- La primera vista de `/reports` muestra una barra compacta, un solo encabezado del informe, la tabla y como máximo dos acciones: `Filtros` y `Descargar`.
- Los campos de filtro no aparecen hasta pulsar `Filtros`.
- No aparecen botones separados `Excel` y `PDF` fuera del modal de descarga.
- Cambiar de reporte sigue requiriendo un solo clic.
- Los seis informes, permisos y exportaciones conservan su funcionamiento.
- El cierre contable reduce altura y repetición sin perder cifras.
- La pantalla se valida a 1280x900 y 1440x1000, con teclado, consola y red sin errores nuevos.

## Fuera de alcance

- Cambiar datasets, fórmulas, permisos o contratos de exportación.
- Crear nuevos indicadores o gráficos.
- Rediseñar Dashboard u otros módulos.
- Optimizar la experiencia móvil, salvo evitar regresiones estructurales básicas.
