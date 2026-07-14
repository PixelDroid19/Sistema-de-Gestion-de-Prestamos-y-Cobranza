# Creación simplificada de socios

## Objetivo

Reducir la carga de decisión y la cantidad de interacciones al crear un socio inversionista, sin perder las condiciones financieras necesarias para registrar el capital y programar su rentabilidad.

El alta debe resolverse en una sola superficie de escritorio. La persona operadora debe poder entender, antes de guardar, cuánto recibirá el socio, con qué frecuencia y en qué fecha se realizará el primer pago.

## Flujo aprobado

El formulario mostrará únicamente:

1. Nombre completo.
2. Correo electrónico.
3. Teléfono.
4. Capital inicial aportado.
5. Frecuencia de pago: `Anual` o `Mensual`, con `Anual` seleccionado inicialmente.
6. Tasa pactada, cuyo período se adapta a la frecuencia elegida.
7. Fecha del primer pago.

El socio se crea activo. El estado no se presenta como una decisión durante el alta. La edición conserva el control de estado porque desactivar un socio sí es una operación administrativa válida después de crearlo.

La pantalla mantiene el botón superior `Volver` y elimina el botón inferior `Cancelar`, que duplicaba la misma salida. La única acción al final del formulario será `Crear socio`.

## Diseño de la superficie

La pantalla conserva la navegación, tipografía, colores, controles y densidad actuales del producto. No introduce un asistente por pasos, tarjetas decorativas ni una identidad visual paralela.

```text
Nuevo socio                                                Volver

Nombre completo          Correo electrónico          Teléfono

Capital aportado
COP 2.000.000

Frecuencia de pago
[ Anual seleccionada ] [ Mensual ]

Tasa pactada             Primer pago
[ 12 % anual ]           [ 15/12/2026 ]

Recibirá COP 240.000 cada año
Primer pago: 15 de diciembre de 2026             [ Crear socio ]
```

`Anual` y `Mensual` se presentan como dos opciones visibles y mutuamente excluyentes. No se usa un menú desplegable porque ambas alternativas caben en la superficie y su visibilidad reduce interpretación y clics.

El resumen financiero se actualiza al escribir. No es un paso adicional ni una tarjeta de métricas: es una franja compacta junto a la acción final. Muestra únicamente el monto de rentabilidad por período y la primera fecha de pago.

## Comportamiento financiero

El monto mostrado se calcula como:

`capital inicial × tasa pactada / 100`

La etiqueta debe corresponder a la frecuencia:

- Anual: `Recibirá {monto} cada año`.
- Mensual: `Recibirá {monto} cada mes`.

La fecha elegida se traduce al contrato existente:

- Mensual: se persiste el día de la fecha y el backend programa la siguiente ocurrencia mensual.
- Anual: se persisten mes y día y el backend programa la siguiente ocurrencia anual.

Para que la fecha mostrada y la fecha programada sean idénticas, el selector solo acepta una fecha futura válida para la siguiente ocurrencia: días del 1 al 28, dentro del próximo mes para frecuencia mensual o dentro de los próximos doce meses para frecuencia anual. El frontend recalcula el rango permitido al cambiar la frecuencia.

No se reintroducen `interestStartDate`, `interestStartsAt` ni campos de compatibilidad. La fecha es estado de presentación derivado y se convierte a `interestPaymentDay` y `interestPaymentMonth` antes de llamar al servicio.

## Validación y errores

- Nombre, correo, teléfono, capital, tasa y primer pago son obligatorios durante la creación.
- El capital debe ser positivo y admitir máximo dos decimales.
- La tasa debe ser mayor que cero y no superar 100%.
- La fecha debe cumplir el rango de la frecuencia y usar un día entre 1 y 28.
- Los errores se muestran asociados al campo correspondiente; el toast queda reservado para errores de servidor o fallos globales.
- El formulario conserva los datos si la creación falla.
- `Crear socio` se bloquea durante el envío para evitar duplicados.

En edición no se vuelve a pedir capital inicial. Se muestran contacto, estado y condiciones pactadas. La fecha de pago se deriva de los campos guardados y se edita con el mismo control claro.

## Arquitectura

- `NewAssociate.tsx` mantiene la orquestación del formulario y el envío.
- Un módulo de presentación financiera puro encapsula el cálculo del monto por período y la conversión entre fecha visible y campos del contrato. Esto evita duplicar reglas entre renderizado, validación y payload.
- Se reutilizan `AppInput`, `CurrencyInput`, `PercentInput`, `FormField`, `ActionButton`, `PageHeader`, `PageShell` y `SectionSurface`.
- El selector binario reutiliza el patrón accesible de pestañas o grupo de radio existente; no se crea un control genérico si el proyecto ya dispone de uno adecuado.
- Todo texto nuevo se incorpora a i18n.
- El backend conserva su contrato actual; no se añaden campos legacy ni rutas alternativas.

## Accesibilidad

- La frecuencia será un grupo con nombre accesible y selección anunciada.
- Los dos valores serán operables con teclado y mostrarán foco visible.
- La fecha tendrá etiqueta explícita y mensaje de error asociado.
- El resumen no dependerá exclusivamente del color.
- El orden de tabulación seguirá el orden visual del formulario.

## Pruebas y aceptación

Pruebas unitarias y de comportamiento:

- Anual aparece seleccionado por defecto.
- Cambiar a mensual actualiza la etiqueta de tasa, el resumen y el rango de fecha.
- Estado no aparece durante creación y el payload usa `active`.
- El resumen calcula correctamente rentabilidad anual y mensual.
- La fecha visible produce los campos `interestPaymentDay` y `interestPaymentMonth` correctos.
- Fechas pasadas, días 29 a 31 y fechas fuera del siguiente período se rechazan.
- Capital, tasa y fecha vacíos impiden crear.
- El formulario de edición sigue permitiendo cambiar el estado.
- El payload no contiene campos retirados.

Validación de navegador en escritorio:

- Ruta `/associates-new` a 1280 y 1440 píxeles.
- Flujo completo anual y mensual.
- Cálculo del resumen mientras se escribe.
- Navegación únicamente con teclado.
- Errores de campo y error de servidor.
- Ausencia de desbordamiento, superposición, errores de consola y solicitudes duplicadas.

## Fuera de alcance

- Cambiar el modelo de rentabilidad pactada.
- Añadir vencimiento de capital o convertir el producto en un CDT completo.
- Rediseñar el listado o el detalle de socios.
- Añadir un asistente de varios pasos.
- Cambiar el contrato público del backend.
