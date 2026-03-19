# Delta for Associates And Profitability

## MODIFIED Requirements

### Requirement: Administracion de asociados

The system MUST permit only `admin` to create or update `participationPercentage` on associates. `participationPercentage` SHALL be a numeric percentage from `0` to `100` inclusive, with at most four decimal places; `socio` users MUST NOT mutate it.

#### Scenario: Admin registra porcentaje valido

- GIVEN un admin autenticado
- WHEN crea o actualiza un asociado con `participationPercentage` valido
- THEN la plataforma SHALL persistir el porcentaje en el asociado

#### Scenario: Porcentaje invalido rechazado

- GIVEN un admin autenticado
- WHEN envia un porcentaje negativo, mayor que `100` o con precision no permitida
- THEN la plataforma MUST rechazar la mutacion con error de validacion

### Requirement: Portal del socio acotado a su asociado

The system MUST exponer en el portal propio del asociado su `participationPercentage` vigente y las distribuciones registradas, incluyendo si una distribucion fue manual o proporcional y el monto finalmente asignado a ese asociado.

#### Scenario: Portal muestra asignacion proporcional propia

- GIVEN un socio vinculado a un asociado con distribuciones proporcionales registradas
- WHEN consulta su portal
- THEN la plataforma SHALL devolver su porcentaje y solo sus asignaciones con su base de distribucion

### Requirement: Contribuciones y distribuciones

The system MUST preserve the existing manual distribution flow unchanged and SHALL add a separate admin-only proportional distribution mutation that allocates one declared total amount across eligible active associates. Proportional execution MUST require at least one eligible associate, every eligible active associate to have `participationPercentage` greater than `0`, and the eligible set to total exactly `100%`; otherwise the system MUST reject the request and persist no distribution rows. The system SHALL compute allocations in currency minor units using the largest-remainder method: floor each raw share, then assign leftover cents one by one by largest fractional remainder, breaking ties by ascending associate identifier. The proportional mutation SHOULD accept a client-provided idempotency key, MUST replay the first successful response for exact retries with the same key, and MUST reject reuse of the same key when the normalized payload differs or another matching request is still pending.

#### Scenario: Distribucion proporcional exitosa

- GIVEN un admin autenticado y asociados elegibles activos con porcentajes que suman `100%`
- WHEN registra una distribucion proporcional con un monto total valido
- THEN la plataforma SHALL crear una asignacion por asociado en una sola operacion auditable

#### Scenario: Porcentajes elegibles inconsistentes

- GIVEN asociados elegibles activos con porcentaje faltante o suma distinta de `100%`
- WHEN un admin intenta ejecutar la distribucion proporcional
- THEN la plataforma MUST rechazar la operacion sin crear distribuciones parciales

#### Scenario: Remainder deterministico

- GIVEN un monto total cuya division proporcional genera centavos remanentes
- WHEN la plataforma calcula las asignaciones
- THEN la plataforma SHALL repartir el remanente con el criterio deterministico definido y conservar evidencia del total base y criterio usado

#### Scenario: Reintento exacto con misma clave de idempotencia

- GIVEN un admin autenticado y una distribucion proporcional ya creada con una `idempotencyKey`
- WHEN reintenta exactamente la misma solicitud con la misma `idempotencyKey`
- THEN la plataforma SHALL devolver una respuesta segura e idempotente sin crear una segunda tanda de distribuciones

#### Scenario: Clave de idempotencia reutilizada con payload distinto

- GIVEN un admin autenticado y una `idempotencyKey` ya usada para una distribucion proporcional
- WHEN intenta reutilizar esa clave con un monto, fecha, notas o `basis` distinto
- THEN la plataforma MUST rechazar la solicitud por conflicto y no crear nuevas distribuciones
