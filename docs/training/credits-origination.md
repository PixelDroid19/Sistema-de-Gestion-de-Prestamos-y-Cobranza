# Credits Origination

## Objetivo

Mostrar la simulación y creación de crédito con el perfil de cálculo activo y snapshot financiero congelado.

## Flujo de demo

1. Abrir `Cálculo de crédito`.
2. Ajustar monto, tasa, plazo y mora.
3. Enviar a `Nuevo crédito`.
4. Verificar resumen y cronograma.
5. Crear crédito.
6. Confirmar que el detalle muestra el método aplicado y el snapshot financiero.

## Checklist QA

- Simulación responde con calendario y resumen.
- Si no existe política compatible, el flujo cae a fuente manual sin romper creación.
- El crédito creado persiste `calculationProfileVersionId`, método aplicado y snapshot de políticas.

## Storyboard

1. Simulación inicial.
2. Traspaso a originación.
3. Confirmación del resumen.
4. Crédito creado.
5. Apertura del detalle.
