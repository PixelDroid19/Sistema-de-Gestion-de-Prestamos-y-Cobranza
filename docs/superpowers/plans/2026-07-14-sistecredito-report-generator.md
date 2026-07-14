# Plan de implementación del generador de reportes

1. Cubrir con pruebas el selector por categorías, los filtros visibles y las descargas directas.
2. Reemplazar las pestañas por controles nativos de categoría y tipo de reporte.
3. Mantener las vistas previas y servicios existentes; cambiar únicamente la composición y la interacción.
4. Añadir un reinicio destructivo explícito que recree el esquema y siembre solo los dos usuarios QA.
5. Ejecutar pruebas frontend/backend, lint y build.
6. Validar el flujo completo en navegador de escritorio, incluyendo permisos, teclado, consola y red.
7. Publicar en `master`, desplegar ambos servicios, ejecutar el reinicio autorizado y verificar conteos y accesos.
