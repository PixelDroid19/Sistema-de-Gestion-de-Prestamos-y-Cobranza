# Auth + Shell

## Objetivo

Validar acceso, restauración de sesión, navegación principal y salida segura.

## Flujo de demo

1. Iniciar sesión como `admin`.
2. Verificar home por rol.
3. Abrir sidebar en móvil y escritorio.
4. Navegar a Créditos, Notificaciones, Configuración y Perfil.
5. Cerrar sesión.

## Checklist QA

- Login correcto con mensaje seguro en error.
- Sidebar consistente por rol.
- Header con contador de notificaciones.
- Logout limpia sesión y redirige a `/login`.

## Storyboard

1. Pantalla de login.
2. Acceso exitoso.
3. Recorrido corto por módulos principales.
4. Apertura de Perfil.
5. Logout.
