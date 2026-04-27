# Training Walkthroughs

Este directorio concentra el material operativo para grabar y revisar los módulos cerrados del sistema.

## Estructura

- `auth-shell.md`
- `customers-config.md`
- `credits-origination.md`
- `credits-operations.md`
- `notifications-profile-associates.md`

Cada archivo incluye:

1. objetivo operativo del módulo,
2. flujo recomendado para demo,
3. checklist de QA antes de grabar,
4. storyboard corto para video.

## Convención de artefactos

Los videos no se versionan en Git. Se generan localmente en:

- `artifacts/training-videos/`

Formato recomendado:

- `module-<slug>-admin.webm`
- `module-<slug>-customer.webm`
- `module-<slug>-socio.webm`

## Regla de grabación

No grabar un flujo si:

- algún CTA visible no hace nada,
- el módulo no pasó `lint`, pruebas o build,
- el flujo depende de datos inconsistentes o de una sesión contaminada.
