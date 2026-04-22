const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }

  return fallback;
};

const normalizeScopeList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
};

const createScopeMatcher = (scopes) => {
  const normalizedScopes = new Set(normalizeScopeList(scopes));
  return (scopeKey) => normalizedScopes.size === 0 || normalizedScopes.has(String(scopeKey || '').trim().toLowerCase());
};

const createCreditsDagConfig = ({ env = process.env, workbenchEnabled, workbenchScopes } = {}) => {
  const normalizedScopes = normalizeScopeList(workbenchScopes ?? env.CREDITS_DAG_WORKBENCH_SCOPES);

  return {
    workbenchEnabled: normalizeBoolean(workbenchEnabled ?? env.CREDITS_DAG_WORKBENCH_ENABLED, true),
    workbenchScopes: normalizedScopes,
    isScopeEnabled: createScopeMatcher(normalizedScopes),
  };
};

module.exports = {
  normalizeBoolean,
  normalizeScopeList,
  createCreditsDagConfig,
};
