# Credits Operations

## Objetivo

Demostrar la operación real del crédito: cuota, abono, payoff, compromisos, alertas e historial.

## Flujo de demo

1. Abrir un crédito activo.
2. Revisar calendario y próxima cuota operable.
3. Registrar pago de cuota.
4. Registrar abono a capital.
5. Crear compromiso de pago.
6. Crear seguimiento o alerta.
7. Revisar historial de pagos e historial operativo.
8. Ejecutar payoff cuando aplique.

## Checklist QA

- El quote previo coincide con el saldo vigente.
- Pagos invalidan calendario, historial, reportes y payoff quote.
- Acciones no permitidas quedan bloqueadas con razón visible.
- Un crédito liquidado deshabilita pagos, mora y cambio de estado operativo.

## Storyboard

1. Resumen del crédito.
2. Pago de cuota.
3. Abono a capital.
4. Compromiso y alerta.
5. Historial actualizado.
6. Liquidación final.
