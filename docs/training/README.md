# Guías Operativas De Módulos

Este directorio concentra material de apoyo para pruebas operativas y
entrenamiento del sistema.

## Estructura

- `auth-shell.md`
- `customers-config.md`
- `credits-origination.md`
- `credits-operations.md`
- `notifications-profile-associates.md`

Cada documento incluye:

1. objetivo operativo del módulo,
2. flujo recomendado para entrenamiento,
3. checklist de QA para validación funcional.

## Criterio de activación

No ejecutar un flujo de entrenamiento si:

- algún CTA visible no hace nada,
- el módulo no pasó `lint`, pruebas o `build`,
- el flujo depende de datos inconsistentes o sesión contaminada.

## Soporte de onboarding

La asistencia dentro de la aplicación se hace por `Driver.js` desde la acción
**Guía rápida** en los módulos finales del flujo.
