# Delta for Reports And Exports

## MODIFIED Requirements

### Requirement: Exportes de rentabilidad para asociados

The system MUST include `participationPercentage`, distribution type, declared proportional total, and each associate allocation amount in associate profitability responses and exports. `admin` MAY request any associate dataset; `socio` SHALL remain limited to the linked associate and MUST NOT see allocations belonging to other associates.

#### Scenario: Exportacion administrativa con trazabilidad proporcional

- GIVEN un administrador autenticado y una distribucion proporcional registrada
- WHEN solicita la rentabilidad o su exportacion
- THEN la plataforma SHALL incluir porcentaje, tipo de distribucion y monto asignado para cada fila aplicable

#### Scenario: Socio sin visibilidad cruzada

- GIVEN un socio autenticado
- WHEN consulta reportes o exporta su rentabilidad
- THEN la plataforma MUST limitar la salida a su asociado vinculado aun cuando la distribucion original haya sido grupal

## ADDED Requirements

### Requirement: Errores y autorizacion de distribucion proporcional

The system MUST reserve proportional distribution mutations to `admin` and SHALL return explicit failure responses for unauthorized actors, missing eligible associates, invalid declared totals, percentage configurations that prevent deterministic execution, and idempotency-key conflicts. When a proportional request is replayed safely with the same idempotency key, the system SHOULD return the original batch summary instead of duplicating persistence.

#### Scenario: Actor no autorizado

- GIVEN un usuario `socio` autenticado
- WHEN intenta ejecutar la mutacion de distribucion proporcional
- THEN la plataforma MUST rechazar el acceso

#### Scenario: Monto declarado invalido

- GIVEN un admin autenticado
- WHEN intenta distribuir un monto nulo, negativo o sin precision monetaria valida
- THEN la plataforma MUST rechazar la solicitud con error de validacion

#### Scenario: Reintento idempotente seguro

- GIVEN un admin autenticado y una solicitud proporcional exitosa con `Idempotency-Key`
- WHEN reenvia la misma solicitud con la misma clave
- THEN la plataforma SHALL responder con el resumen original y sin nuevas filas persistidas

#### Scenario: Conflicto por clave idempotente reutilizada

- GIVEN un admin autenticado y una `Idempotency-Key` ya asociada a otra carga proporcional
- WHEN envia la misma clave con una carga normalizada distinta o mientras la primera sigue pendiente
- THEN la plataforma MUST rechazar la solicitud con error de conflicto explicito
