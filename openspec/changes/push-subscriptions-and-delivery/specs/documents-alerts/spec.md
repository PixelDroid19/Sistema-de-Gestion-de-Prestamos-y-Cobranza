# Delta for Documents Alerts And Follow Up

## MODIFIED Requirements

### Requirement: Promesas de pago y notificaciones

The system MUST permitir a `admin` y `agent` registrar promesas de pago; la plataforma MUST mantener notificaciones persistidas por usuario para asignaciones y seguimiento operativo, y push delivery SHALL ampliar ese flujo sin cambiar el contrato existente de persistencia o lectura.
(Previously: The system MUST permitir a `admin` y `agent` registrar promesas de pago; la plataforma MUST mantener notificaciones persistidas por usuario para asignaciones y seguimiento operativo.)

#### Scenario: Notificacion persistida sin push disponible

- GIVEN un evento operativo que genera una notificacion para un usuario sin suscripciones push activas
- WHEN la notificacion se registra
- THEN la plataforma SHALL persistirla y exponerla por los endpoints existentes sin cambios contractuales

#### Scenario: Notificacion persistida con push complementario

- GIVEN un evento operativo que genera una notificacion para un usuario con canales push activos
- WHEN la notificacion se registra
- THEN la plataforma SHALL conservar la bandeja persistida y MAY despachar intentos push adicionales por canales configurados
