# Espacio compacto de consulta de informes

## Problema

El generador de informes actual reparte la categoría, el tipo de informe, la descripción, las exportaciones, cuatro filtros y las métricas en franjas independientes. En pantallas de escritorio esto produce demasiado espacio vacío, dificulta entender qué controles pertenecen a la consulta activa y expone opciones que no siempre son necesarias.

La corrección debe conservar el generador guiado y todas las capacidades existentes, pero presentar el flujo como una sola herramienta de consulta: elegir informe, refinarlo cuando sea necesario, revisar el resultado y exportarlo.

## Resultado esperado

- La categoría, el tipo de informe y las acciones de exportación se perciben como una única cabecera de consulta.
- Los filtros no ocupan espacio mientras no se necesiten.
- Un único botón `Filtros` abre y cierra un panel accesible con los campos del informe activo.
- El botón comunica cuántos filtros están aplicados y mantiene estados normal, hover, foco, abierto y deshabilitado claramente diferenciados.
- Al cerrar el panel, los filtros aplicados permanecen visibles como etiquetas removibles y pueden limpiarse individualmente o en conjunto.
- El título, la descripción y el resumen del informe forman una jerarquía compacta antes de la tabla.
- La tabla sigue siendo el contenido principal y aparece inmediatamente después de la herramienta de consulta, sin franjas decorativas ni espacios arbitrarios.
- La experiencia se optimiza para PC, sin eliminar el comportamiento adaptable ya existente.

## Arquitectura de interfaz

### 1. Cabecera del informe

`ReportsNavigation` seguirá siendo responsable de cambiar la categoría y el tipo de informe. Su estructura visual se compactará en una fila de escritorio:

1. Selector de categoría con tres estados seleccionables claros.
2. Selector del informe dentro de la categoría activa.
3. Acciones contextuales del informe alineadas al extremo derecho cuando estén disponibles.

La descripción flotante de la categoría se elimina de esta franja porque duplica el contexto que ya expresa el título del informe seleccionado.

### 2. Controles contextuales

`ReportTabPanel` seguirá siendo el límite reutilizable para título, exportación y filtros. El panel tendrá:

- una cabecera compacta con el nombre del informe, una descripción breve y las exportaciones;
- un botón `Filtros` cuando el informe tenga campos de consulta;
- un panel desplegable en el flujo del documento, no un modal, para evitar perder contexto;
- una zona de filtros activos que solo exista cuando haya valores aplicados.

El panel se inicia cerrado. Abrirlo no modifica la consulta y cerrarlo no borra valores. El contenido utiliza los controles compartidos existentes (`AppInput`, `OperationalSelect`, `FormField`) y conserva sus validaciones.

### 3. Resumen y resultados

`ReportSummaryGrid` se presentará como una banda compacta de lectura, con divisores verticales internos en escritorio y sin bordes superior e inferior duplicados. No se crearán tarjetas individuales. La tabla conservará su superficie y sus estados de carga, error, vacío y paginación.

## Comportamiento

- El cambio de categoría selecciona el primer informe válido de esa categoría, como ocurre actualmente.
- El cambio de informe reemplaza filtros, métricas y tabla por el contenido correspondiente sin navegación adicional.
- `Filtros` usa un botón nativo con `aria-expanded` y `aria-controls`.
- El panel puede recorrerse con teclado y no captura el foco de forma artificial.
- Los filtros activos se derivan del estado real de cada informe; no se mantiene una segunda fuente de verdad.
- Los rangos inválidos siguen mostrando su mensaje en el campo correspondiente y continúan bloqueando la exportación cuando aplica.
- La exportación siempre usa los filtros activos, aunque el panel esté cerrado.
- Los estados de carga o error no ocultan la cabecera ni impiden corregir filtros.

## Alcance técnico

Se modificarán exclusivamente los componentes y estilos compartidos del módulo de informes y sus pruebas:

- `Reports.tsx` para cohesionar navegación y contenido cuando sea necesario.
- `ReportsNavigation.tsx` para la cabecera compacta.
- `ReportTabPanel.tsx` para la divulgación accesible de filtros.
- `ReportSummaryGrid.tsx` solo si necesita metadatos semánticos adicionales.
- Las pestañas de informe para describir filtros activos y acciones de limpieza sin duplicar lógica de negocio.
- `index.css` usando los tokens existentes del producto.

No se cambiarán endpoints, cálculos financieros, formatos de exportación, permisos ni contratos de datos.

## Validación

### Automatizada

- Pruebas de comportamiento para panel cerrado inicialmente, apertura/cierre, `aria-expanded`, persistencia de valores y conteo de filtros activos.
- Pruebas de navegación entre categorías e informes.
- Pruebas existentes de exportación, rangos inválidos, estados vacíos y tablas.
- TypeScript, lint, suite frontend y compilación de producción.

### Navegador

En Chrome y con la aplicación real se verificará:

- vista de escritorio estándar y ancha;
- selección de las tres categorías y sus informes;
- apertura, cierre y navegación por teclado del panel de filtros;
- aplicación, persistencia y limpieza de filtros;
- exportaciones con el panel abierto y cerrado;
- estados vacío, carga y error disponibles;
- consola sin errores o advertencias nuevas;
- ausencia de desbordamientos, espacios muertos y separadores duplicados.

## Criterios de aceptación

1. Ningún informe muestra todos sus filtros de manera permanente al cargar.
2. La selección del informe y sus acciones se entienden como una sola cabecera operativa.
3. Un usuario puede filtrar, identificar los filtros activos, retirarlos y exportar sin perder contexto.
4. El resumen y la tabla mantienen todos sus datos y estados previos.
5. No cambia la semántica financiera ni el contenido de Excel o PDF.
6. La implementación pasa las pruebas relevantes, el build y la validación visual en la aplicación desplegada.
