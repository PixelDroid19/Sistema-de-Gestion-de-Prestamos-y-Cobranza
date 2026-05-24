const PERMISSION_MODULES = ['CREDITOS', 'CLIENTES', 'PAGOS', 'SOCIOS', 'REPORTES', 'DASHBOARD', 'USUARIOS', 'PERMISOS', 'AUDITORÍA'];

const permissionsCatalog = [
  {
    name: 'CREDITS_VIEW_ALL',
    module: 'CREDITOS',
    description: 'Consultar créditos y sus detalles',
  },
  {
    name: 'CREDITS_CREATE',
    module: 'CREDITOS',
    description: 'Crear solicitudes de crédito',
  },
  {
    name: 'CREDITS_UPDATE',
    module: 'CREDITOS',
    description: 'Actualizar créditos existentes',
  },
  {
    name: 'CREDITS_DELETE',
    module: 'CREDITOS',
    description: 'Eliminar créditos permitidos',
  },
  {
    name: 'CREDITS_APPROVE',
    module: 'CREDITOS',
    description: 'Aprobar solicitudes de crédito',
  },
  {
    name: 'CREDITS_REJECT',
    module: 'CREDITOS',
    description: 'Rechazar solicitudes de crédito',
  },
  {
    name: 'CLIENTS_VIEW_ALL',
    module: 'CLIENTES',
    description: 'Consultar información de clientes',
  },
  {
    name: 'CLIENTS_CREATE',
    module: 'CLIENTES',
    description: 'Crear registros de clientes',
  },
  {
    name: 'CLIENTS_UPDATE',
    module: 'CLIENTES',
    description: 'Actualizar información de clientes',
  },
  {
    name: 'CLIENTS_DELETE',
    module: 'CLIENTES',
    description: 'Eliminar registros de clientes',
  },
  {
    name: 'PAYMENTS_VIEW_ALL',
    module: 'PAGOS',
    description: 'Consultar registros de pagos',
  },
  {
    name: 'PAYMENTS_CREATE',
    module: 'PAGOS',
    description: 'Registrar pagos',
  },
  {
    name: 'PAYMENTS_UPDATE',
    module: 'PAGOS',
    description: 'Actualizar registros de pagos',
  },
  {
    name: 'PAYMENTS_DELETE',
    module: 'PAGOS',
    description: 'Eliminar pagos permitidos',
  },
  {
    name: 'PAYMENTS_REVERSE',
    module: 'PAGOS',
    description: 'Reversar transacciones de pago',
  },
  {
    name: 'SOCIOS_VIEW_ALL',
    module: 'SOCIOS',
    description: 'Consultar información de socios inversionistas',
  },
  {
    name: 'SOCIOS_CREATE',
    module: 'SOCIOS',
    description: 'Crear registros de socios inversionistas',
  },
  {
    name: 'SOCIOS_UPDATE',
    module: 'SOCIOS',
    description: 'Actualizar información de socios inversionistas',
  },
  {
    name: 'SOCIOS_DELETE',
    module: 'SOCIOS',
    description: 'Eliminar registros de socios inversionistas',
  },
  {
    name: 'REPORTS_VIEW_ALL',
    module: 'REPORTES',
    description: 'Consultar reportes',
  },
  {
    name: 'REPORTS_EXPORT',
    module: 'REPORTES',
    description: 'Exportar reportes',
  },
  {
    name: 'REPORTS_GENERATE',
    module: 'REPORTES',
    description: 'Generar reportes',
  },
  {
    name: 'DASHBOARD_VIEW_ALL',
    module: 'DASHBOARD',
    description: 'Consultar métricas y gráficos del dashboard',
  },
  {
    name: 'DASHBOARD_EXPORT',
    module: 'DASHBOARD',
    description: 'Exportar datos del dashboard',
  },
  {
    name: 'USERS_VIEW_ALL',
    module: 'USUARIOS',
    description: 'Consultar cuentas de usuarios',
  },
  {
    name: 'USERS_CREATE',
    module: 'USUARIOS',
    description: 'Crear cuentas de usuarios',
  },
  {
    name: 'USERS_UPDATE',
    module: 'USUARIOS',
    description: 'Actualizar información de usuarios',
  },
  {
    name: 'USERS_DELETE',
    module: 'USUARIOS',
    description: 'Eliminar cuentas de usuarios',
  },
  {
    name: 'USERS_DEACTIVATE',
    module: 'USUARIOS',
    description: 'Desactivar cuentas de usuarios',
  },
  {
    name: 'PERMISSIONS_VIEW_ALL',
    module: 'PERMISOS',
    description: 'Consultar configuración de permisos',
  },
  {
    name: 'PERMISSIONS_GRANT',
    module: 'PERMISOS',
    description: 'Conceder permisos a empleados',
  },
  {
    name: 'PERMISSIONS_ASSIGN',
    module: 'PERMISOS',
    description: 'Asignar permisos explícitos al crear usuarios',
  },
  {
    name: 'PERMISSIONS_REVOKE',
    module: 'PERMISOS',
    description: 'Revocar permisos a empleados',
  },
  {
    name: 'AUDIT_VIEW_ALL',
    module: 'AUDITORÍA',
    description: 'Consultar registros de auditoría',
  },
  {
    name: 'AUDIT_EXPORT',
    module: 'AUDITORÍA',
    description: 'Exportar registros de auditoría',
  },
];

module.exports = { permissionsCatalog, PERMISSION_MODULES };
