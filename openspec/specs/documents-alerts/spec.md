# Documents Alerts And Follow Up Specification

## Purpose

Definir adjuntos de cliente y prestamo, alertas de mora, calendario de pagos, promesas de pago y notificaciones persistidas de seguimiento.

## Requirements

### Requirement: Adjuntos por prestamo con visibilidad acotada

The system MUST permitir a `admin` y `agent` cargar adjuntos de prestamo; actores con acceso al prestamo MAY listarlos o descargarlos, pero `customer` SHALL ver solo adjuntos marcados como `customerVisible`.

#### Scenario: Descarga autorizada para cliente

- GIVEN un cliente con acceso a un prestamo y un adjunto visible al cliente
- WHEN solicita la descarga
- THEN la plataforma SHALL entregarle el archivo

#### Scenario: Adjunto interno oculto

- GIVEN un cliente con acceso a un prestamo
- WHEN intenta leer un adjunto no visible al cliente
- THEN la plataforma MUST rechazar el acceso

### Requirement: Documentos centrados en cliente

The system MUST permitir a `admin` y `agent` gestionar documentos con ownership directo sobre `customer`; `customer` SHALL poder listar y descargar solo sus propios documentos marcados como visibles para cliente.

#### Scenario: Carga de documento de cliente

- GIVEN un admin o agente autenticado y un cliente existente
- WHEN carga un archivo sobre `/customers/:id/documents`
- THEN la plataforma SHALL persistir un adjunto asociado al cliente con metadata y visibilidad al cliente

#### Scenario: Cliente consulta solo sus documentos

- GIVEN un cliente autenticado
- WHEN consulta `/customers/:id/documents` para otro cliente o para un documento interno
- THEN la plataforma MUST rechazar el acceso o filtrar documentos no visibles segun corresponda

### Requirement: Alertas y calendario de cobranza

The system MUST exponer calendario de pagos a actores autorizados y alertas de mora a `admin` y `agent`; alertas activas SHALL persistirse y sincronizarse desde un proceso programado e idempotente, no desde consultas de lectura.

#### Scenario: Prestamo con mora

- GIVEN un prestamo con cuotas vencidas
- WHEN se consulta su calendario o alertas
- THEN la plataforma SHALL reflejar entradas vencidas y alertas activas correspondientes

#### Scenario: Sincronizacion programada de mora

- GIVEN el backend inicia con el esquema validado
- WHEN arranca el scheduler de alertas
- THEN la plataforma SHALL ejecutar una sincronizacion inmediata y repetirla por intervalo sin duplicar alertas activas equivalentes

### Requirement: Promesas de pago y notificaciones

The system MUST permitir a `admin` y `agent` registrar promesas de pago; la plataforma MUST mantener notificaciones persistidas por usuario para asignaciones y seguimiento operativo.

#### Scenario: Promesa de pago valida

- GIVEN un admin o agente con acceso de escritura al prestamo
- WHEN registra una promesa con fecha y monto validos
- THEN la plataforma SHALL crear el compromiso pendiente

#### Scenario: Notificaciones propias

- GIVEN un usuario autenticado
- WHEN consulta o marca notificaciones
- THEN la plataforma SHALL operar solo sobre su propia bandeja

#### Scenario: Notificaciones persistidas con deduplicacion

- GIVEN una asignacion o evento operativo que emite una notificacion con `dedupeKey`
- WHEN se intenta registrar otra notificacion no leida con la misma clave
- THEN la plataforma SHALL reutilizar la notificacion pendiente existente en lugar de duplicarla
