# Payments And Collections Specification

## Purpose

Definir como se registran pagos y como se consulta el estado de cobranza por prestamo.

## Requirements

### Requirement: Registro de pagos por clientes

The system MUST permitir crear pagos solo al rol `customer`; otros roles SHALL poder inspeccionar historia y saldos, pero no crear pagos mediante la API actual.

#### Scenario: Pago valido

- GIVEN un cliente autenticado con acceso a su prestamo
- WHEN registra un pago valido
- THEN la plataforma SHALL devolver el pago, su asignacion y el prestamo actualizado

#### Scenario: Pago por rol no autorizado

- GIVEN un `admin`, `agent` o `socio`
- WHEN intenta crear un pago
- THEN la API MUST rechazar la solicitud

### Requirement: Historial de pagos por prestamo

The system MUST permitir consultar pagos por prestamo a cualquier actor con acceso autorizado sobre ese prestamo.

#### Scenario: Consulta de historial

- GIVEN un prestamo visible para el actor
- WHEN solicita sus pagos
- THEN la plataforma SHALL devolver el historial correspondiente

### Requirement: Vista global administrativa

The system MUST reservar el listado global de pagos al rol `admin`.

#### Scenario: Consulta global restringida

- GIVEN un usuario no administrador
- WHEN solicita el listado completo de pagos
- THEN la plataforma MUST denegar el acceso
