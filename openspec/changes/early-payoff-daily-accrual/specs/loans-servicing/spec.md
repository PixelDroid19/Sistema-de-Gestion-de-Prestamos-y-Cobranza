# Delta for Loans And Servicing

## MODIFIED Requirements

### Requirement: Estados de ciclo de vida

The system MUST manejar estados de prestamo `pending`, `approved`, `rejected`, `active`, `closed` y `defaulted`; prestamos `active` o `defaulted` SHALL poder transicionar a `closed` por liquidacion total exitosa, y los flujos regulares de cuota SHALL continuar usando el servicing mensual actual para casos no payoff. (Previously: prestamos `closed` o `rejected` no reabribles y sin regla explicita de cierre por payoff.)

#### Scenario: Cierre por payoff total

- GIVEN un prestamo `active` o `defaulted` con quote de payoff valido
- WHEN se ejecuta la liquidacion total por el monto cotizado
- THEN la plataforma SHALL dejar el saldo en cero y marcar el prestamo como `closed`

#### Scenario: Pago regular no cambia

- GIVEN un prestamo activo sin intencion de liquidacion
- WHEN se registra un pago mensual normal
- THEN la plataforma MUST conservar el calendario y la asignacion regular existente
