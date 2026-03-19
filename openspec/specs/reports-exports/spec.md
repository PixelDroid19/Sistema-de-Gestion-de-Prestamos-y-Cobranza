# Reports And Exports Specification

## Purpose

Definir las salidas analiticas y exportables hoy disponibles en la plataforma.

## Requirements

### Requirement: Reportes de recuperacion administrativos

The system MUST reservar a `admin` los reportes de cartera recuperada, cartera pendiente y resumen global de recuperacion.

#### Scenario: Resumen de recuperacion

- GIVEN un administrador autenticado
- WHEN solicita el reporte global
- THEN la plataforma SHALL devolver prestamos recuperados, pendientes y sus metricas agregadas

### Requirement: Dashboard operativo agregado

The system MUST exponer a `admin` un resumen agregado de dashboard con metricas de cartera, contadores de cobranza y actividad reciente consolidada desde prestamos, pagos, alertas, promesas y notificaciones.

#### Scenario: Dashboard administrativo disponible

- GIVEN un administrador autenticado
- WHEN consulta el dashboard de reportes
- THEN la plataforma SHALL devolver `summary`, `collections` y `recentActivity` en una sola respuesta

#### Scenario: Degradacion segura del dashboard

- GIVEN una falla del repositorio de reportes
- WHEN se solicita el dashboard
- THEN la plataforma SHALL responder exitosamente con secciones vacias y metricas en cero

### Requirement: Exportacion de reportes

The system MUST permitir a `admin` exportar el reporte de recuperacion en `csv`, `pdf` y `xlsx`.

#### Scenario: Exportacion CSV

- GIVEN un administrador autenticado
- WHEN solicita exportar en `csv`
- THEN la plataforma SHALL devolver un archivo descargable con filas de recuperados y pendientes

#### Scenario: Exportacion PDF

- GIVEN un administrador autenticado
- WHEN solicita exportar en `pdf`
- THEN la plataforma SHALL devolver un resumen descargable del estado de recuperacion

#### Scenario: Exportacion XLSX

- GIVEN un administrador autenticado
- WHEN solicita exportar en `xlsx`
- THEN la plataforma SHALL devolver un workbook descargable del reporte de recuperacion

### Requirement: Historial unificado por cliente

The system MUST permitir a `admin` consultar un historial cronologico por cliente que consolide prestamos, pagos, documentos, alertas, promesas y notificaciones persistidas.

#### Scenario: Historial administrativo unificado

- GIVEN un administrador autenticado y un cliente existente
- WHEN consulta el historial del cliente
- THEN la plataforma SHALL devolver `customer`, `timeline` y `segments` normalizados en una sola respuesta

#### Scenario: Historial con segmentos vacios

- GIVEN un cliente existente sin actividad en algunos segmentos
- WHEN se consulta su historial
- THEN la plataforma SHALL responder exitosamente conservando arreglos vacios en los segmentos faltantes

### Requirement: Historial crediticio por prestamo

The system MUST permitir a actores con acceso al prestamo consultar su historial crediticio canonico con snapshot y pagos.

#### Scenario: Historial por ownership

- GIVEN un actor con acceso al prestamo
- WHEN consulta su historial crediticio
- THEN la plataforma SHALL devolver datos del prestamo, snapshot y pagos relacionados

### Requirement: Exportes de rentabilidad para asociados

The system MUST permitir a `admin` y `socio` exportar datasets de rentabilidad por asociado; el formato por defecto SHALL ser `xlsx` y tambien MAY solicitarse `csv`.

#### Scenario: Exportacion administrativa de asociado

- GIVEN un administrador autenticado
- WHEN solicita exportar un asociado especifico
- THEN la plataforma SHALL devolver el dataset de resumen, aportes, distribuciones y prestamos vinculados

#### Scenario: Exportacion propia del socio

- GIVEN un socio autenticado
- WHEN solicita exportar su rentabilidad
- THEN la plataforma SHALL limitar la salida al asociado vinculado a ese usuario
