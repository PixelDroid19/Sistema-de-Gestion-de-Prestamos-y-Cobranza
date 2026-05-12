const APPLICATION_ROLES = ['admin', 'employee', 'customer', 'socio'];
const ADMINISTRATIVE_LOGIN_ROLES = ['admin', 'employee'];

// Operator-facing access catalog. Customer and socio records can still exist as
// domain data, but they are not administrative login roles.
const ROLES = [
  {
    id: 'admin',
    name: 'Administrador',
    description: 'Acceso completo a la plataforma administrativa y a la configuración sensible.',
    defaultPermissions: [],
  },
  {
    id: 'employee',
    name: 'Empleado',
    description: 'Usuario interno con acceso limitado a los módulos autorizados por un administrador.',
    defaultPermissions: [],
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
