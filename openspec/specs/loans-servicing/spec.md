# Loans And Servicing Specification

## Purpose

Definir el ciclo de vida del prestamo, su visibilidad y las operaciones de servicing y recuperacion.

## Requirements

### Requirement: Simulacion y originacion de prestamos

The system MUST permitir simulaciones a usuarios autenticados y creacion de prestamos a `customer` y `admin`; un `customer` SHALL crear prestamos solo para su propio registro.

#### Scenario: Alta de prestamo propia

- GIVEN un cliente autenticado
- WHEN crea un prestamo con su propio `customerId`
- THEN la plataforma SHALL registrar la solicitud con su resumen financiero

#### Scenario: Alta fuera de ownership

- GIVEN un cliente autenticado
- WHEN intenta crear un prestamo para otro cliente
- THEN la plataforma MUST rechazar la solicitud

### Requirement: Estados de ciclo de vida

The system MUST manejar estados de prestamo `pending`, `approved`, `rejected`, `active`, `closed` y `defaulted`; prestamos `closed` o `rejected` SHALL NOT reabrirse mediante actualizacion de estado.

#### Scenario: Aprobacion de prestamo

- GIVEN un prestamo en revision
- WHEN un actor autorizado lo cambia a `approved`
- THEN la plataforma SHALL registrar fechas operativas de inicio y fin

### Requirement: Asignacion y recuperacion

The system MUST permitir a `admin` asignar agentes solo sobre prestamos `approved` o `defaulted`; `admin` y `agent` MUST poder actualizar `recoveryStatus` dentro del flujo permitido.

#### Scenario: Asignacion valida

- GIVEN un prestamo recuperable y un agente existente
- WHEN un admin realiza la asignacion
- THEN el prestamo SHALL quedar vinculado al agente y puede emitir notificacion operativa

#### Scenario: Cambio invalido de recuperacion

- GIVEN un actor sin permiso o una transicion invalida
- WHEN intenta actualizar `recoveryStatus`
- THEN la plataforma MUST rechazar el cambio

### Requirement: Eliminacion acotada

The system MUST permitir eliminar solo prestamos `rejected`; usuarios `socio` SHALL NOT poder borrarlos.

#### Scenario: Eliminacion permitida

- GIVEN un prestamo rechazado visible para un actor autorizado
- WHEN solicita su eliminacion
- THEN la plataforma SHALL removerlo
