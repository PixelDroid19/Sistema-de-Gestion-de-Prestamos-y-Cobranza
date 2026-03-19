# Notifications Delivery Specification

## Purpose

Definir el registro de suscripciones push y la entrega incremental de notificaciones web y mobile sobre la persistencia existente.

## Requirements

### Requirement: Registro de suscripciones push

The system MUST persistir suscripciones push por usuario y canal, y SHALL exponer endpoints autenticados para registrar o eliminar suscripciones idempotentemente.

#### Scenario: Registro de suscripcion web

- GIVEN un usuario autenticado con datos validos de una suscripcion web push
- WHEN invoca el endpoint de registro
- THEN la plataforma SHALL guardar la suscripcion activa para ese usuario y canal

#### Scenario: Proveedor y canal incompatibles

- GIVEN un usuario autenticado con un proveedor push valido pero un canal que no corresponde a ese proveedor
- WHEN invoca el endpoint de registro
- THEN la plataforma SHALL rechazar la solicitud con error de validacion sin persistir la suscripcion

#### Scenario: Eliminacion idempotente

- GIVEN un usuario autenticado con una suscripcion existente o ya eliminada
- WHEN invoca el endpoint de borrado
- THEN la plataforma SHALL completar la operacion sin crear errores por estado previo inexistente

#### Scenario: Identificador de borrado incorrecto para el proveedor

- GIVEN un usuario autenticado que intenta borrar una suscripcion `webpush` sin endpoint o una suscripcion mobile sin device token
- WHEN invoca el endpoint de borrado
- THEN la plataforma SHALL rechazar la solicitud con error de validacion antes de consultar persistencia

### Requirement: Fanout por abstraccion de canal

The system MUST permitir que `NotificationService` publique intentos push mediante abstracciones de proveedor/canal para web push y mobile push; implementaciones mobile MAY quedar pendientes mientras el contrato del canal permanezca estable, including a future provider such as Expo.

#### Scenario: Fanout web disponible

- GIVEN una notificacion persistida y una suscripcion web activa
- WHEN `NotificationService` procesa el evento
- THEN la plataforma SHALL generar un intento de entrega para el proveedor web push configurado

#### Scenario: Canal mobile no implementado aun

- GIVEN una notificacion dirigida a un canal mobile sin proveedor operativo
- WHEN `NotificationService` evalua el fanout
- THEN la plataforma SHOULD omitir la entrega mobile sin bloquear la persistencia ni el resto de canales

### Requirement: Depuracion de suscripciones invalidas

The system MUST detectar respuestas de proveedor que indiquen suscripciones expiradas o invalidas y SHALL desactivarlas para entregas futuras.

#### Scenario: Suscripcion expirada

- GIVEN una entrega push que falla con estado de expiracion o invalidez permanente
- WHEN el proveedor devuelve ese resultado
- THEN la plataforma SHALL marcar la suscripcion como inactiva y evitar reintentos futuros con ella
