const { ConflictError, NotFoundError, ValidationError } = require('@/utils/errorHandler');
const {
  PAYMENT_METHOD_CATEGORY,
  BUSINESS_SETTING_CATEGORY,
  TNA_RATE_CATEGORY,
  LATE_FEE_POLICY_CATEGORY,
  INTEREST_NODE_CATEGORY,
} = require('@/modules/config/infrastructure/repositories');
const { ROLES } = require('@/modules/shared/roles');

const ADMIN_CATALOGS = {
  roles: ['admin', 'customer', 'socio'],
  customerStatuses: ['active', 'inactive'],
  associateStatuses: ['active', 'inactive'],
  paymentVisibilities: ['customer', 'internal'],
  paymentDocumentCategories: ['voucher', 'receipt', 'transfer', 'note'],
};

const normalizeKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const requireText = (value, field) => {
  if (!String(value || '').trim()) {
    throw new ValidationError(`${field} is required`);
  }

  return String(value).trim();
};

const buildPaymentMethod = (entry) => ({
  id: entry.id,
  key: entry.key,
  label: entry.label,
  isActive: entry.isActive !== false,
  description: entry.value?.description || '',
  requiresReference: Boolean(entry.value?.requiresReference),
  metadata: entry.value?.metadata || {},
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

const buildSetting = (entry) => ({
  id: entry.id,
  key: entry.key,
  label: entry.label,
  value: entry.value?.value ?? '',
  description: entry.value?.description || '',
  updatedAt: entry.updatedAt,
});

const createListPaymentMethods = ({ configRepository }) => async () => {
  const entries = await configRepository.listByCategory(PAYMENT_METHOD_CATEGORY);
  return entries.map(buildPaymentMethod);
};

const createListPaymentMethodsLegacy = ({ configRepository }) => async () => {
  const entries = await configRepository.listByCategory(PAYMENT_METHOD_CATEGORY);
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.label,
    key: entry.key,
    active: entry.isActive !== false,
    requiresReference: Boolean(entry.value?.requiresReference),
    description: entry.value?.description || '',
  }));
};

const createCreatePaymentMethod = ({ configRepository }) => async ({ label, key, description, requiresReference, isActive }) => {
  const normalizedLabel = requireText(label, 'label');
  const normalizedKey = normalizeKey(key || normalizedLabel);

  if (!normalizedKey) {
    throw new ValidationError('key is required');
  }

  const existing = await configRepository.findByCategoryAndKey(PAYMENT_METHOD_CATEGORY, normalizedKey);
  if (existing) {
    throw new ConflictError('Payment method key already exists');
  }

  const entry = await configRepository.create({
    category: PAYMENT_METHOD_CATEGORY,
    key: normalizedKey,
    label: normalizedLabel,
    isActive: isActive !== false,
    value: {
      description: String(description || '').trim(),
      requiresReference: Boolean(requiresReference),
    },
  });

  return buildPaymentMethod(entry);
};

const createUpdatePaymentMethod = ({ configRepository }) => async (paymentMethodId, payload = {}) => {
  const existing = await configRepository.findPaymentMethodById(paymentMethodId);
  if (!existing) {
    throw new NotFoundError('Payment method');
  }

  const nextLabel = payload.label !== undefined ? requireText(payload.label, 'label') : existing.label;
  const nextKey = payload.key !== undefined ? normalizeKey(payload.key) : existing.key;
  if (!nextKey) {
    throw new ValidationError('key is required');
  }

  const duplicate = await configRepository.findByCategoryAndKey(PAYMENT_METHOD_CATEGORY, nextKey);
  if (duplicate && Number(duplicate.id) !== Number(existing.id)) {
    throw new ConflictError('Payment method key already exists');
  }

  const updated = await configRepository.update(existing.id, {
    key: nextKey,
    label: nextLabel,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive !== false,
    value: {
      description: payload.description !== undefined
        ? String(payload.description || '').trim()
        : existing.value?.description || '',
      requiresReference: payload.requiresReference !== undefined
        ? Boolean(payload.requiresReference)
        : Boolean(existing.value?.requiresReference),
      metadata: existing.value?.metadata || {},
    },
  });

  return buildPaymentMethod(updated);
};

const createDeletePaymentMethod = ({ configRepository }) => async (paymentMethodId) => {
  const existing = await configRepository.findPaymentMethodById(paymentMethodId);
  if (!existing) {
    throw new NotFoundError('Payment method');
  }

  await configRepository.destroy(existing.id);
  return { id: Number(paymentMethodId) };
};

const createListSettings = ({ configRepository }) => async () => {
  const entries = await configRepository.listByCategory(BUSINESS_SETTING_CATEGORY);
  return entries.map(buildSetting);
};

const createUpsertSetting = ({ configRepository }) => async (settingKey, { label, value, description }) => {
  const normalizedKey = normalizeKey(settingKey);
  if (!normalizedKey) {
    throw new ValidationError('setting key is required');
  }

  const normalizedLabel = requireText(label || normalizedKey, 'label');
  const existing = await configRepository.findByCategoryAndKey(BUSINESS_SETTING_CATEGORY, normalizedKey);

  if (existing) {
    const updated = await configRepository.update(existing.id, {
      label: normalizedLabel,
      value: {
        value: value ?? '',
        description: String(description || '').trim(),
      },
      isActive: true,
    });

    return buildSetting(updated);
  }

  const created = await configRepository.create({
    category: BUSINESS_SETTING_CATEGORY,
    key: normalizedKey,
    label: normalizedLabel,
    isActive: true,
    value: {
      value: value ?? '',
      description: String(description || '').trim(),
    },
  });

  return buildSetting(created);
};

const createListAdminCatalogs = () => async () => ADMIN_CATALOGS;

/**
 * Create the use case that returns the catalog of available roles.
 * This is a public endpoint (no auth required).
 * @returns {Function}
 */
const createListRoles = () => async () => {
  return ROLES;
};

// TNA Rate Use Cases
const buildTnaRate = (entry) => ({
  id: entry.id,
  key: entry.key,
  label: entry.label,
  value: entry.value?.value ?? '',
  minValue: entry.value?.minValue ?? null,
  maxValue: entry.value?.maxValue ?? null,
  effectiveDate: entry.value?.effectiveDate ?? null,
  description: entry.value?.description || '',
  metadata: entry.value?.metadata || {},
  isActive: entry.isActive !== false,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

const createListTnaRates = ({ configRepository }) => async () => {
  const entries = await configRepository.listByCategory(TNA_RATE_CATEGORY);
  return entries.map(buildTnaRate);
};

const createCreateTnaRate = ({ configRepository }) => async ({ key, label, value, minValue, maxValue, effectiveDate, description }) => {
  const normalizedLabel = requireText(label, 'label');
  const normalizedKey = normalizeKey(key || normalizedLabel);
  if (!normalizedKey) {
    throw new ValidationError('key is required');
  }

  const existing = await configRepository.findByCategoryAndKey(TNA_RATE_CATEGORY, normalizedKey);
  if (existing) {
    throw new ConflictError('TNA rate key already exists');
  }

  const entry = await configRepository.create({
    category: TNA_RATE_CATEGORY,
    key: normalizedKey,
    label: normalizedLabel,
    isActive: true,
    value: {
      value: String(value || ''),
      minValue: minValue !== undefined ? Number(minValue) : null,
      maxValue: maxValue !== undefined ? Number(maxValue) : null,
      effectiveDate: effectiveDate || null,
      description: String(description || '').trim(),
    },
  });

  return buildTnaRate(entry);
};

const createUpdateTnaRate = ({ configRepository }) => async (id, payload = {}) => {
  const existing = await configRepository.findById(id);
  if (!existing || existing.category !== TNA_RATE_CATEGORY) {
    throw new NotFoundError('TNA rate');
  }

  const updated = await configRepository.update(existing.id, {
    label: payload.label !== undefined ? requireText(payload.label, 'label') : existing.label,
    value: {
      value: payload.value !== undefined ? String(payload.value) : existing.value?.value ?? '',
      minValue: payload.minValue !== undefined ? (payload.minValue === null ? null : Number(payload.minValue)) : existing.value?.minValue ?? null,
      maxValue: payload.maxValue !== undefined ? (payload.maxValue === null ? null : Number(payload.maxValue)) : existing.value?.maxValue ?? null,
      effectiveDate: payload.effectiveDate !== undefined ? payload.effectiveDate : existing.value?.effectiveDate ?? null,
      description: payload.description !== undefined ? String(payload.description || '').trim() : existing.value?.description || '',
    },
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive !== false,
  });

  return buildTnaRate(updated);
};

const createDeleteTnaRate = ({ configRepository }) => async (id) => {
  const existing = await configRepository.findById(id);
  if (!existing || existing.category !== TNA_RATE_CATEGORY) {
    throw new NotFoundError('TNA rate');
  }

  await configRepository.destroy(existing.id);
  return { id: Number(id) };
};

// Late Fee Policy Use Cases
const buildLateFeePolicy = (entry) => ({
  id: entry.id,
  key: entry.key,
  label: entry.label,
  gracePeriodDays: entry.value?.gracePeriodDays ?? 0,
  penaltyRate: entry.value?.penaltyRate ?? 0,
  penaltyType: entry.value?.penaltyType ?? 'percentage',
  maxPenaltyAmount: entry.value?.maxPenaltyAmount ?? null,
  description: entry.value?.description || '',
  isActive: entry.isActive !== false,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

const createListLateFeePolicies = ({ configRepository }) => async () => {
  const entries = await configRepository.listByCategory(LATE_FEE_POLICY_CATEGORY);
  return entries.map(buildLateFeePolicy);
};

const resolveLateFeePolicyForUser = ({ configRepository }) => async ({ userId }) => {
  const userSpecific = await configRepository.findActiveByCategoryAndKey(LATE_FEE_POLICY_CATEGORY, `user-${userId}`);
  if (userSpecific) {
    return {
      source: 'user',
      policy: buildLateFeePolicy(userSpecific),
    };
  }

  const entries = await configRepository.listActiveByCategory(LATE_FEE_POLICY_CATEGORY);
  const fallback = entries[0] || null;

  return {
    source: fallback ? 'default' : null,
    policy: fallback ? buildLateFeePolicy(fallback) : null,
  };
};

const createGetTnaRateStats = ({ configRepository }) => async () => {
  const entries = await configRepository.listByCategory(TNA_RATE_CATEGORY);
  const rates = entries.map(buildTnaRate);
  const numericRates = rates
    .map((rate) => Number(rate.value))
    .filter((value) => Number.isFinite(value));

  const stats = {
    total: rates.length,
    active: rates.filter((rate) => rate.isActive).length,
    min: numericRates.length > 0 ? Math.min(...numericRates) : null,
    max: numericRates.length > 0 ? Math.max(...numericRates) : null,
    average: numericRates.length > 0
      ? Number((numericRates.reduce((sum, value) => sum + value, 0) / numericRates.length).toFixed(4))
      : null,
  };

  return {
    stats,
    rates,
  };
};

const createFindTnaRatesByUser = ({ configRepository }) => async ({ userId }) => {
  const entries = await configRepository.listByCategory(TNA_RATE_CATEGORY);
  const normalizedUserId = Number(userId);

  const rates = entries
    .map(buildTnaRate)
    .filter((rate) => {
      const audience = rate?.metadata?.userIds;
      if (!Array.isArray(audience) || audience.length === 0) {
        return true;
      }

      return audience.some((value) => Number(value) === normalizedUserId);
    });

  return {
    userId: normalizedUserId,
    rates,
    count: rates.length,
  };
};

const createCreateLateFeePolicy = ({ configRepository }) => async ({ key, label, gracePeriodDays, penaltyRate, penaltyType, maxPenaltyAmount, description }) => {
  const normalizedLabel = requireText(label, 'label');
  const normalizedKey = normalizeKey(key || normalizedLabel);
  if (!normalizedKey) {
    throw new ValidationError('key is required');
  }

  const existing = await configRepository.findByCategoryAndKey(LATE_FEE_POLICY_CATEGORY, normalizedKey);
  if (existing) {
    throw new ConflictError('Late fee policy key already exists');
  }

  const entry = await configRepository.create({
    category: LATE_FEE_POLICY_CATEGORY,
    key: normalizedKey,
    label: normalizedLabel,
    isActive: true,
    value: {
      gracePeriodDays: Number(gracePeriodDays || 0),
      penaltyRate: Number(penaltyRate || 0),
      penaltyType: ['percentage', 'fixed'].includes(penaltyType) ? penaltyType : 'percentage',
      maxPenaltyAmount: maxPenaltyAmount !== undefined && maxPenaltyAmount !== null && maxPenaltyAmount !== '' ? Number(maxPenaltyAmount) : null,
      description: String(description || '').trim(),
    },
  });

  return buildLateFeePolicy(entry);
};

const createUpdateLateFeePolicy = ({ configRepository }) => async (id, payload = {}) => {
  const existing = await configRepository.findById(id);
  if (!existing || existing.category !== LATE_FEE_POLICY_CATEGORY) {
    throw new NotFoundError('Late fee policy');
  }

  const updated = await configRepository.update(existing.id, {
    label: payload.label !== undefined ? requireText(payload.label, 'label') : existing.label,
    value: {
      gracePeriodDays: payload.gracePeriodDays !== undefined ? Number(payload.gracePeriodDays) : existing.value?.gracePeriodDays ?? 0,
      penaltyRate: payload.penaltyRate !== undefined ? Number(payload.penaltyRate) : existing.value?.penaltyRate ?? 0,
      penaltyType: payload.penaltyType !== undefined ? (['percentage', 'fixed'].includes(payload.penaltyType) ? payload.penaltyType : existing.value?.penaltyType ?? 'percentage') : existing.value?.penaltyType ?? 'percentage',
      maxPenaltyAmount: payload.maxPenaltyAmount !== undefined ? (payload.maxPenaltyAmount === null || payload.maxPenaltyAmount === '' ? null : Number(payload.maxPenaltyAmount)) : existing.value?.maxPenaltyAmount ?? null,
      description: payload.description !== undefined ? String(payload.description || '').trim() : existing.value?.description || '',
    },
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive !== false,
  });

  return buildLateFeePolicy(updated);
};

const createDeleteLateFeePolicy = ({ configRepository }) => async (id) => {
  const existing = await configRepository.findById(id);
  if (!existing || existing.category !== LATE_FEE_POLICY_CATEGORY) {
    throw new NotFoundError('Late fee policy');
  }

  await configRepository.destroy(existing.id);
  return { id: Number(id) };
};

// Interest Node Use Cases
const buildInterestNode = (entry) => ({
  id: entry.id,
  key: entry.key,
  label: entry.label,
  nodeType: entry.value?.nodeType ?? 'workspace',
  config: entry.value?.config ?? {},
  parentNodeId: entry.value?.parentNodeId ?? null,
  description: entry.value?.description || '',
  isActive: entry.isActive !== false,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

const createListInterestNodes = ({ configRepository }) => async () => {
  const entries = await configRepository.listByCategory(INTEREST_NODE_CATEGORY);
  return entries.map(buildInterestNode);
};

const createCreateInterestNode = ({ configRepository }) => async ({ key, label, nodeType, config, parentNodeId, description }) => {
  const normalizedLabel = requireText(label, 'label');
  const normalizedKey = normalizeKey(key || normalizedLabel);
  if (!normalizedKey) {
    throw new ValidationError('key is required');
  }

  const existing = await configRepository.findByCategoryAndKey(INTEREST_NODE_CATEGORY, normalizedKey);
  if (existing) {
    throw new ConflictError('Interest node key already exists');
  }

  const entry = await configRepository.create({
    category: INTEREST_NODE_CATEGORY,
    key: normalizedKey,
    label: normalizedLabel,
    isActive: true,
    value: {
      nodeType: ['workspace', 'rate_group', 'fee_group'].includes(nodeType) ? nodeType : 'workspace',
      config: typeof config === 'object' && config !== null ? config : {},
      parentNodeId: parentNodeId !== undefined && parentNodeId !== null ? Number(parentNodeId) : null,
      description: String(description || '').trim(),
    },
  });

  return buildInterestNode(entry);
};

const createUpdateInterestNode = ({ configRepository }) => async (id, payload = {}) => {
  const existing = await configRepository.findById(id);
  if (!existing || existing.category !== INTEREST_NODE_CATEGORY) {
    throw new NotFoundError('Interest node');
  }

  const updated = await configRepository.update(existing.id, {
    label: payload.label !== undefined ? requireText(payload.label, 'label') : existing.label,
    value: {
      nodeType: payload.nodeType !== undefined ? (['workspace', 'rate_group', 'fee_group'].includes(payload.nodeType) ? payload.nodeType : existing.value?.nodeType ?? 'workspace') : existing.value?.nodeType ?? 'workspace',
      config: payload.config !== undefined ? (typeof payload.config === 'object' && payload.config !== null ? payload.config : existing.value?.config ?? {}) : existing.value?.config ?? {},
      parentNodeId: payload.parentNodeId !== undefined ? (payload.parentNodeId === null ? null : Number(payload.parentNodeId)) : existing.value?.parentNodeId ?? null,
      description: payload.description !== undefined ? String(payload.description || '').trim() : existing.value?.description || '',
    },
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive !== false,
  });

  return buildInterestNode(updated);
};

const createDeleteInterestNode = ({ configRepository }) => async (id) => {
  const existing = await configRepository.findById(id);
  if (!existing || existing.category !== INTEREST_NODE_CATEGORY) {
    throw new NotFoundError('Interest node');
  }

  await configRepository.destroy(existing.id);
  return { id: Number(id) };
};

module.exports = {
  ADMIN_CATALOGS,
  createListPaymentMethods,
  createListPaymentMethodsLegacy,
  createCreatePaymentMethod,
  createUpdatePaymentMethod,
  createDeletePaymentMethod,
  createListSettings,
  createUpsertSetting,
  createListAdminCatalogs,
  createListRoles,
  createListTnaRates,
  createCreateTnaRate,
  createUpdateTnaRate,
  createDeleteTnaRate,
  createListLateFeePolicies,
  resolveLateFeePolicyForUser,
  createCreateLateFeePolicy,
  createUpdateLateFeePolicy,
  createDeleteLateFeePolicy,
  createListInterestNodes,
  createCreateInterestNode,
  createUpdateInterestNode,
  createDeleteInterestNode,
  createGetTnaRateStats,
  createFindTnaRatesByUser,
};
