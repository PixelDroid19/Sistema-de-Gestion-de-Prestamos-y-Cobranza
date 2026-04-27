const PERMISSION_MODULES = ['CREDITOS', 'CLIENTES', 'PAGOS', 'SOCIOS', 'REPORTES', 'DASHBOARD', 'USUARIOS', 'PERMISOS', 'AUDITORÍA'];

const permissionsCatalog = [
  {
    name: 'CREDITS_VIEW_ALL',
    module: 'CREDITOS',
    description: 'View all credit applications and details',
  },
  {
    name: 'CREDITS_CREATE',
    module: 'CREDITOS',
    description: 'Create new credit applications',
  },
  {
    name: 'CREDITS_UPDATE',
    module: 'CREDITOS',
    description: 'Update existing credit applications',
  },
  {
    name: 'CREDITS_DELETE',
    module: 'CREDITOS',
    description: 'Delete credit applications',
  },
  {
    name: 'CREDITS_APPROVE',
    module: 'CREDITOS',
    description: 'Approve credit applications',
  },
  {
    name: 'CREDITS_REJECT',
    module: 'CREDITOS',
    description: 'Reject credit applications',
  },
  {
    name: 'CLIENTS_VIEW_ALL',
    module: 'CLIENTES',
    description: 'View all client information',
  },
  {
    name: 'CLIENTS_CREATE',
    module: 'CLIENTES',
    description: 'Create new client records',
  },
  {
    name: 'CLIENTS_UPDATE',
    module: 'CLIENTES',
    description: 'Update existing client information',
  },
  {
    name: 'CLIENTS_DELETE',
    module: 'CLIENTES',
    description: 'Delete client records',
  },
  {
    name: 'PAYMENTS_VIEW_ALL',
    module: 'PAGOS',
    description: 'View all payment records',
  },
  {
    name: 'PAYMENTS_CREATE',
    module: 'PAGOS',
    description: 'Record new payments',
  },
  {
    name: 'PAYMENTS_UPDATE',
    module: 'PAGOS',
    description: 'Update payment records',
  },
  {
    name: 'PAYMENTS_DELETE',
    module: 'PAGOS',
    description: 'Delete payment records',
  },
  {
    name: 'PAYMENTS_REVERSE',
    module: 'PAGOS',
    description: 'Reverse payment transactions',
  },
  {
    name: 'SOCIOS_VIEW_ALL',
    module: 'SOCIOS',
    description: 'View all associate/socio information',
  },
  {
    name: 'SOCIOS_CREATE',
    module: 'SOCIOS',
    description: 'Create new associate/socio records',
  },
  {
    name: 'SOCIOS_UPDATE',
    module: 'SOCIOS',
    description: 'Update associate/socio information',
  },
  {
    name: 'SOCIOS_DELETE',
    module: 'SOCIOS',
    description: 'Delete associate/socio records',
  },
  {
    name: 'REPORTS_VIEW_ALL',
    module: 'REPORTES',
    description: 'View all reports',
  },
  {
    name: 'REPORTS_EXPORT',
    module: 'REPORTES',
    description: 'Export reports to external formats',
  },
  {
    name: 'REPORTS_GENERATE',
    module: 'REPORTES',
    description: 'Generate new reports',
  },
  {
    name: 'DASHBOARD_VIEW_ALL',
    module: 'DASHBOARD',
    description: 'View all dashboard metrics and charts',
  },
  {
    name: 'DASHBOARD_EXPORT',
    module: 'DASHBOARD',
    description: 'Export dashboard data',
  },
  {
    name: 'USERS_VIEW_ALL',
    module: 'USUARIOS',
    description: 'View all user accounts',
  },
  {
    name: 'USERS_CREATE',
    module: 'USUARIOS',
    description: 'Create new user accounts',
  },
  {
    name: 'USERS_UPDATE',
    module: 'USUARIOS',
    description: 'Update user account information',
  },
  {
    name: 'USERS_DELETE',
    module: 'USUARIOS',
    description: 'Delete user accounts',
  },
  {
    name: 'USERS_DEACTIVATE',
    module: 'USUARIOS',
    description: 'Deactivate user accounts',
  },
  {
    name: 'PERMISSIONS_VIEW_ALL',
    module: 'PERMISOS',
    description: 'View all permission configurations',
  },
  {
    name: 'PERMISSIONS_GRANT',
    module: 'PERMISOS',
    description: 'Grant permissions to users',
  },
  {
    name: 'PERMISSIONS_ASSIGN',
    module: 'PERMISOS',
    description: 'Assign explicit permissions during user provisioning',
  },
  {
    name: 'PERMISSIONS_REVOKE',
    module: 'PERMISOS',
    description: 'Revoke permissions from users',
  },
  {
    name: 'AUDIT_VIEW_ALL',
    module: 'AUDITORÍA',
    description: 'View all audit logs',
  },
  {
    name: 'AUDIT_EXPORT',
    module: 'AUDITORÍA',
    description: 'Export audit logs',
  },
];

module.exports = { permissionsCatalog, PERMISSION_MODULES };
