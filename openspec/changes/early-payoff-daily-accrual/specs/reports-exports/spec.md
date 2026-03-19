# Delta for Reports And Exports

## ADDED Requirements

### Requirement: Historial auditable de payoff

The system MUST reflect a successful payoff in authorized loan and payment history. The persisted history SHALL identify the transaction as payoff, store its effective date, rounded component breakdown, total collected, and resulting loan closure state. Quote-only activity MAY remain ephemeral and SHALL NOT appear as a collected payment.

#### Scenario: Historial posterior al payoff

- GIVEN un actor autorizado sobre un prestamo liquidado
- WHEN consulta el historial crediticio o de pagos
- THEN la plataforma SHALL mostrar el payoff con su desglose y el prestamo cerrado

#### Scenario: Quote sin cobro

- GIVEN una cotizacion de payoff no ejecutada
- WHEN se consultan reportes e historiales
- THEN la plataforma MUST NOT registrar la cotizacion como pago realizado
