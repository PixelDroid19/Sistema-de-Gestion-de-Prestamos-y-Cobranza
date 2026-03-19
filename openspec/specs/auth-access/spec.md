# Auth And Access Specification

## Purpose

Definir autenticacion, roles y reglas de acceso compartidas para las superficies de LendFlow.

## Requirements

### Requirement: Inicio de sesion y perfil autenticado

The system MUST autenticar usuarios con credenciales validas y devolver un token utilizable para consultar y actualizar su propio perfil.

#### Scenario: Login exitoso

- GIVEN un usuario registrado con password valida
- WHEN envia sus credenciales
- THEN la API SHALL devolver usuario saneado y token firmado

### Requirement: Registro publico restringido

The system MUST permitir registro publico solo para el rol `customer`; cuentas privilegiadas SHALL NOT exponerse por el endpoint publico de registro.

#### Scenario: Registro publico permitido

- GIVEN un visitante sin sesion
- WHEN intenta registrarse como `customer`
- THEN la API SHALL crear el usuario y su perfil asociado

#### Scenario: Registro publico bloqueado

- GIVEN un visitante sin sesion
- WHEN intenta registrarse como `admin`, `agent` o `socio`
- THEN la API MUST rechazar la solicitud de validacion

### Requirement: Control de acceso por ownership y rol

The system MUST filtrar prestamos y recursos relacionados segun ownership: `admin` ve toda la cartera, `customer` solo sus prestamos, `agent` solo los asignados, y `socio` solo los vinculados a su asociado.

#### Scenario: Consulta autorizada por rol

- GIVEN un usuario autenticado y un prestamo visible para su contexto
- WHEN consulta el recurso
- THEN la plataforma SHALL devolver solo datos autorizados

#### Scenario: Consulta fuera de alcance

- GIVEN un usuario autenticado
- WHEN intenta acceder a un prestamo ajeno a su alcance
- THEN la plataforma MUST rechazar el acceso
