const APPLICATION_ROLES = ['admin', 'customer', 'socio'];
const LEGACY_APPLICATION_ROLE_ALIASES = {
  agent: 'admin',
};

const normalizeApplicationRole = (role, { allowLegacyAliases = true } = {}) => {
  if (typeof role !== 'string') {
    return null;
  }

  const normalizedRole = role.trim().toLowerCase();
  if (!normalizedRole) {
    return null;
  }

  if (allowLegacyAliases && LEGACY_APPLICATION_ROLE_ALIASES[normalizedRole]) {
    return LEGACY_APPLICATION_ROLE_ALIASES[normalizedRole];
  }

  if (APPLICATION_ROLES.includes(normalizedRole)) {
    return normalizedRole;
  }

  return null;
};

const isApplicationRole = (role, options) => Boolean(normalizeApplicationRole(role, options));
const isCanonicalApplicationRole = (role) => Boolean(normalizeApplicationRole(role, { allowLegacyAliases: false }));

module.exports = {
  APPLICATION_ROLES,
  LEGACY_APPLICATION_ROLE_ALIASES,
  normalizeApplicationRole,
  isApplicationRole,
  isCanonicalApplicationRole,
};
