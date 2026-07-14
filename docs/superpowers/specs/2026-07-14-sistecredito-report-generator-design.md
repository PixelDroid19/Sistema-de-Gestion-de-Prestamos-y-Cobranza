# Generador de reportes inspirado en Sistecrédito

## Objetivo

Reemplazar la navegación horizontal de seis pestañas por un flujo de consulta único, eficiente en escritorio y coherente con el funcionamiento mostrado por el cliente en Credinet/Sistecrédito.

## Referencia funcional observada

Las capturas aportadas por el cliente muestran este orden:

1. Elegir una categoría: comercial, estadística o contable.
2. Elegir un tipo de informe dentro de esa categoría.
3. Elegir el período aplicable.
4. Consultar el resultado en la misma pantalla.
5. Exportar el resultado.

El rediseño toma esa arquitectura de información, no la identidad visual, los textos ni las acciones ajenas al dominio de CrediCobranza.

## Diseño aprobado

- Tres categorías mediante controles de radio nativos y accesibles.
- Un selector `Tipo de reporte` que solo muestra los informes de la categoría activa.
- `Informe contable` activo por defecto con `Cierre contable` seleccionado.
- Filtros de período y de contexto siempre visibles dentro del informe seleccionado.
- Vista previa inmediata usando las tablas y resúmenes operativos existentes.
- Acciones directas `Excel` y `PDF`, sin modal intermedio.
- Informes visibles según permisos del usuario.

## Clasificación en CrediCobranza

- Comercial: créditos del período, pago de cuotas y cartera por cobrar.
- Estadístico: movimientos de socios, con capital y rentabilidad.
- Contable: cierre contable y gastos operativos.

## Restricciones

- No duplicar endpoints ni lógica financiera.
- No cambiar cálculos, filtros, contratos de exportación ni permisos.
- No añadir tarjetas promocionales ni copiar la marca de Sistecrédito.
- Preservar teclado, foco visible, etiquetas accesibles, estados de carga y errores existentes.

## Base de datos de producción

El reinicio autorizado elimina todos los datos operativos, vuelve a crear el esquema y conserva únicamente configuración estructural necesaria y dos usuarios administrativos QA. No crea clientes, socios, créditos, pagos ni gastos.
