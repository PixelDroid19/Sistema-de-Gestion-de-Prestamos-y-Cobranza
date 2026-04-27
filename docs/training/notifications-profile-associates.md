# Notifications + Profile + Socios

## Objetivo

Validar acciones auxiliares por rol sin pantallas fantasma.

## Flujo de demo

1. Abrir Notificaciones.
2. Marcar una notificación como leída y navegar al crédito origen.
3. Marcar todas como leídas.
4. Limpiar notificaciones.
5. Abrir Perfil.
6. Validar edición de datos persistibles por rol.
7. Abrir portal del socio.
8. Revisar resumen, cuotas y calendario.

## Checklist QA

- Cada notificación con `loanId` abre el detalle correcto.
- El contador de no leídas baja correctamente.
- Perfil admin no ofrece teléfono no persistible.
- Portal socio no muestra estados crudos ni acciones operativas indebidas.

## Storyboard

1. Bandeja de notificaciones.
2. Navegación al crédito desde la notificación.
3. Estado vacío tras limpiar.
4. Perfil por rol.
5. Portal del socio con resumen y cuotas.
