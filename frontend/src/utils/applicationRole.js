export const FINAL_APPLICATION_ROLES = ['admin', 'customer', 'socio']
const LEGACY_ROLE_ALIASES = {
  agent: 'admin',
}

const FINAL_ROLE_SET = new Set(FINAL_APPLICATION_ROLES)

export const normalizeApplicationRole = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase()

  if (!normalizedRole) {
    return null
  }

  if (LEGACY_ROLE_ALIASES[normalizedRole]) {
    return LEGACY_ROLE_ALIASES[normalizedRole]
  }

  return FINAL_ROLE_SET.has(normalizedRole) ? normalizedRole : null
}

export const normalizeSessionUser = (user) => {
  if (!user || typeof user !== 'object') {
    return null
  }

  const role = normalizeApplicationRole(user.role)
  if (!role) {
    return null
  }

  return {
    ...user,
    role,
  }
}

export const isFinalApplicationRole = (role) => Boolean(normalizeApplicationRole(role))
