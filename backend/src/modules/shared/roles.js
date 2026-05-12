const APPLICATION_ROLES = ['admin', 'employee', 'customer', 'socio'];
const ADMINISTRATIVE_LOGIN_ROLES = ['admin', 'employee'];

// Extended roles catalog with descriptions and default permissions
const ROLES = [
  {
    id: 'SUPER_ADMIN',
    name: 'Super Administrador',
    description: 'Acceso completo al sistema sin restricciones',
    defaultPermissions: [],
  },
  {
    id: 'ADMINISTRATOR',
    name: 'Administrador',
    description: 'Acceso administrativo completo excepto configuración de sistema',
    defaultPermissions: [],
  },
  {
    id: 'EMPLOYEE',
    name: 'Empleado',
    description: 'Usuario interno con acceso limitado por permisos asignados',
    defaultPermissions: [],
  },
  {
    id: 'PARTNER',
    name: 'Socio',
    description: 'Perfil de negocio sin acceso al sistema administrativo',
    defaultPermissions: ['READ_CREDITOS', 'READ_REPORTES'],
  },
  {
    id: 'CUSTOMER',
    name: 'Cliente',
    description: 'Cliente de crédito sin acceso al sistema administrativo',
    defaultPermissions: ['READ_MIS_CREDITOS', 'READ_MIS_PAGOS'],
  },
];

const normalizeApplicationRole = (role) => {
  if (typeof role !== 'string') {
    return null;
  }

  const normalizedRole = role.trim().toLowerCase();
  if (!normalizedRole) {
    return null;
  }

  if (APPLICATION_ROLES.includes(normalizedRole)) {
    return normalizedRole;
  }

  return null;
};

const isApplicationRole = (role) => Boolean(normalizeApplicationRole(role));
const isCanonicalApplicationRole = (role) => Boolean(normalizeApplicationRole(role));
const isAdministrativeLoginRole = (role) => ADMINISTRATIVE_LOGIN_ROLES.includes(normalizeApplicationRole(role));

module.exports = {
  APPLICATION_ROLES,
  ADMINISTRATIVE_LOGIN_ROLES,
  ROLES,
  normalizeApplicationRole,
  isApplicationRole,
  isCanonicalApplicationRole,
  isAdministrativeLoginRole,
};
