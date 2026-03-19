# Platform Specification

## Purpose

Describir el contexto general de LendFlow como plataforma de prestamos, cobranza y seguimiento operativo.

## Requirements

### Requirement: Plataforma web integrada

The system MUST operar como una SPA de frontend que consume una API REST autenticada para gestionar prestamos, pagos, cobranza, reportes y operaciones de socios.

#### Scenario: Flujo principal autenticado

- GIVEN un usuario con sesion valida
- WHEN accede a la aplicacion
- THEN la plataforma SHALL exponer vistas y datos segun su rol

### Requirement: Backend modular con fronteras funcionales

The system MUST concentrar la logica en un backend monolitico modular con superficies separadas para `auth`, `customers`, `agents`, `associates`, `credits`, `payouts`, `reports` y `notifications`.

#### Scenario: Descubrimiento de capacidades

- GIVEN una integracion cliente
- WHEN consume la API de LendFlow
- THEN cada capacidad SHALL resolverse dentro de su modulo funcional correspondiente

### Requirement: Configuracion operativa explicita

The system MUST depender de configuracion por entorno para base de datos, JWT y puertos; runtime SHOULD usar variables `DB_*` como fuente principal de conexion.

#### Scenario: Arranque de entorno local

- GIVEN un entorno con `DB_*` y `JWT_SECRET`
- WHEN el backend inicia
- THEN la plataforma SHALL poder validar el entorno y conectar su base operativa

#### Scenario: Caveat de despliegue heredado

- GIVEN configuraciones externas basadas solo en `DATABASE_URL`
- WHEN no se proveen variables `DB_*`
- THEN el comportamiento MAY quedar desalineado con la documentacion y runtime actual
