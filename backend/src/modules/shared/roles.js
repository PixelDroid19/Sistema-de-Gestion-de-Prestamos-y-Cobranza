const APPLICATION_ROLES = ['admin', 'customer', 'socio'];

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
    id: 'PARTNER',
    name: 'Socio',
    description: 'Usuario asociado con participación en ganancias',
    defaultPermissions: ['READ_CREDITOS', 'READ_REPORTES'],
  },
  {
    id: 'CUSTOMER',
    name: 'Cliente',
    description: 'Usuario final con acceso a sus propios datos y créditos',
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

module.exports = {
  APPLICATION_ROLES,
  ROLES,
  normalizeApplicationRole,
  isApplicationRole,
  isCanonicalApplicationRole,
};
