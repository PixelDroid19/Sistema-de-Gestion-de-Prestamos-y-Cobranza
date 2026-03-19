# Associates And Profitability Specification

## Purpose

Definir la gestion de asociados y la visibilidad del portal y reportes de rentabilidad para socios.

## Requirements

### Requirement: Administracion de asociados

The system MUST permitir a `admin` listar, crear, actualizar y eliminar asociados, preservando unicidad de contacto relevante.

#### Scenario: Alta administrativa

- GIVEN un admin autenticado
- WHEN registra un asociado con datos validos y no conflictivos
- THEN la plataforma SHALL crear el asociado

### Requirement: Portal del socio acotado a su asociado

The system MUST exponer un portal de asociado para `admin` y `socio`; un `socio` SHALL ver solo el asociado vinculado a su usuario.

#### Scenario: Portal propio del socio

- GIVEN un socio vinculado a un asociado
- WHEN consulta su portal
- THEN la plataforma SHALL devolver resumen, contribuciones, distribuciones y prestamos vinculados

#### Scenario: Portal ajeno bloqueado

- GIVEN un socio autenticado
- WHEN intenta consultar otro asociado
- THEN la plataforma MUST rechazar el acceso

### Requirement: Contribuciones y distribuciones

The system MUST permitir a `admin` registrar contribuciones y distribuciones de utilidad para asociados; la rentabilidad SHOULD reflejar lo efectivamente distribuido, no ganancias no realizadas.

#### Scenario: Rentabilidad registrada

- GIVEN un asociado con aportes y distribuciones
- WHEN se consulta su resumen
- THEN la plataforma SHALL informar totales aportados, distribuidos y prestamos vinculados

### Requirement: Exportacion de rentabilidad por asociado

The system MUST permitir a `admin` y `socio` exportar la rentabilidad de asociados; `admin` MAY indicar cualquier `associateId`, mientras `socio` SHALL limitarse a su asociado vinculado.

#### Scenario: Exportacion XLSX por defecto

- GIVEN un actor autorizado
- WHEN solicita exportar la rentabilidad sin formato explicito
- THEN la plataforma SHALL devolver un archivo `xlsx` con hojas de resumen, aportes, distribuciones y prestamos

#### Scenario: Socio fuera de su asociado

- GIVEN un socio autenticado
- WHEN intenta exportar datos de un asociado distinto al vinculado
- THEN la plataforma MUST rechazar el acceso
