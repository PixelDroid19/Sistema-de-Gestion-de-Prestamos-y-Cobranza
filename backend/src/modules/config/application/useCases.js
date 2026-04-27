const { ConflictError, NotFoundError, ValidationError } = require('@/utils/errorHandler');
const {
  PAYMENT_METHOD_CATEGORY,
  BUSINESS_SETTING_CATEGORY,
  RATE_POLICY_CATEGORY,
  LATE_FEE_POLICY_CATEGORY,
} = require('@/modules/config/infrastructure/repositories');
const { ROLES } = require('@/modules/shared/roles');

const PAYMENT_METHOD_TYPES = new Set(['bank_transfer', 'cash', 'card', 'other']);

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
  type: entry.value?.metadata?.type || 'other',
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

const toOptionalNumber = (value, field) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new ValidationError(`${field} must be numeric`);
  }

  return numericValue;
};

const assertPercent = (value, field) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    throw new ValidationError(`${field} must be between 0 and 100`);
  }

  return numericValue;
};

const normalizePolicyPriority = (value) => {
  if (value === undefined || value === null || value === '') return 100;
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw new ValidationError('priority must be a non-negative integer');
  }
  return numericValue;
};

const normalizePaymentMethodType = (value) => {
  const normalizedValue = String(value || 'other').trim().toLowerCase().replace(/\s+/g, '_');
  if (!PAYMENT_METHOD_TYPES.has(normalizedValue)) {
    throw new ValidationError(`payment method type must be one of: ${Array.from(PAYMENT_METHOD_TYPES).join(', ')}`);
  }
  return normalizedValue;
};

const inferReferenceRequirement = (type) => type === 'bank_transfer' || type === 'card';

const assertAmountRange = ({ minAmount, maxAmount }) => {
  if (minAmount !== null && minAmount < 0) {
    throw new ValidationError('minAmount must be greater than or equal to 0');
  }
  if (maxAmount !== null && maxAmount < 0) {
    throw new ValidationError('maxAmount must be greater than or equal to 0');
  }
  if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
    throw new ValidationError('minAmount cannot be greater than maxAmount');
  }
};

const buildRatePolicy = (entry) => ({
  id: entry.id,
  key: entry.key,
  label: entry.label,
  isActive: entry.isActive !== false,
  minAmount: entry.value?.minAmount ?? null,
  maxAmount: entry.value?.maxAmount ?? null,
  annualEffectiveRate: entry.value?.annualEffectiveRate ?? 0,
  priority: entry.value?.priority ?? 100,
  description: entry.value?.description || '',
  metadata: entry.value?.metadata || {},
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

const buildLateFeePolicy = (entry) => ({
  id: entry.id,
  key: entry.key,
  label: entry.label,
  isActive: entry.isActive !== false,
  annualEffectiveRate: entry.value?.annualEffectiveRate ?? 0,
  lateFeeMode: entry.value?.lateFeeMode || 'SIMPLE',
  priority: entry.value?.priority ?? 100,
  description: entry.value?.description || '',
  metadata: entry.value?.metadata || {},
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

const normalizeRatePolicyPayload = (payload = {}, existing = null) => {
  const label = payload.label !== undefined ? requireText(payload.label, 'label') : existing?.label;
  const key = payload.key !== undefined ? normalizeKey(payload.key) : existing?.key || normalizeKey(label);
  if (!label) {
    throw new ValidationError('label is required');
  }
  const minAmount = payload.minAmount !== undefined ? toOptionalNumber(payload.minAmount, 'minAmount') : existing?.value?.minAmount ?? null;
  const maxAmount = payload.maxAmount !== undefined ? toOptionalNumber(payload.maxAmount, 'maxAmount') : existing?.value?.maxAmount ?? null;
  assertAmountRange({ minAmount, maxAmount });

  return {
    key,
    label,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing?.isActive !== false,
    value: {
      minAmount,
      maxAmount,
      annualEffectiveRate: payload.annualEffectiveRate !== undefined
        ? assertPercent(payload.annualEffectiveRate, 'annualEffectiveRate')
        : Number(existing?.value?.annualEffectiveRate || 0),
      priority: normalizePolicyPriority(payload.priority ?? existing?.value?.priority),
      description: payload.description !== undefined
        ? String(payload.description || '').trim()
        : existing?.value?.description || '',
      metadata: existing?.value?.metadata || {},
    },
  };
};

const normalizeLateFeePolicyPayload = (payload = {}, existing = null) => {
  const label = payload.label !== undefined ? requireText(payload.label, 'label') : existing?.label;
  const key = payload.key !== undefined ? normalizeKey(payload.key) : existing?.key || normalizeKey(label);
  if (!label) {
    throw new ValidationError('label is required');
  }
  const mode = String(payload.lateFeeMode ?? existing?.value?.lateFeeMode ?? 'SIMPLE').trim().toUpperCase();
  if (!['NONE', 'SIMPLE', 'COMPOUND', 'FLAT', 'TIERED'].includes(mode)) {
    throw new ValidationError('lateFeeMode is invalid');
  }

  return {
    key,
    label,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing?.isActive !== false,
    value: {
      annualEffectiveRate: payload.annualEffectiveRate !== undefined
        ? assertPercent(payload.annualEffectiveRate, 'annualEffectiveRate')
        : Number(existing?.value?.annualEffectiveRate || 0),
      lateFeeMode: mode,
      priority: normalizePolicyPriority(payload.priority ?? existing?.value?.priority),
      description: payload.description !== undefined
        ? String(payload.description || '').trim()
        : existing?.value?.description || '',
      metadata: existing?.value?.metadata || {},
    },
  };
};

const pickHighestPriorityPolicy = (policies) => policies
  .filter((policy) => policy.isActive)
  .sort((left, right) => {
    const priorityDelta = Number(left.priority || 100) - Number(right.priority || 100);
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
  })[0] || null;

const createListPaymentMethods = ({ configRepository }) => async () => {
  const entries = await configRepository.listByCategory(PAYMENT_METHOD_CATEGORY);
  return entries.map(buildPaymentMethod);
};

const createCreatePaymentMethod = ({ configRepository }) => async ({ label, key, description, requiresReference, isActive, type, metadata }) => {
  const normalizedLabel = requireText(label, 'label');
  const normalizedKey = normalizeKey(key || normalizedLabel);
  const normalizedType = normalizePaymentMethodType(type);

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
      requiresReference: requiresReference !== undefined
        ? Boolean(requiresReference)
        : inferReferenceRequirement(normalizedType),
      metadata: {
        ...(metadata && typeof metadata === 'object' ? metadata : {}),
        type: normalizedType,
      },
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
  const nextType = payload.type !== undefined
    ? normalizePaymentMethodType(payload.type)
    : String(existing.value?.metadata?.type || 'other');
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
        : existing.value?.requiresReference !== undefined
          ? Boolean(existing.value?.requiresReference)
          : inferReferenceRequirement(nextType),
      metadata: {
        ...(existing.value?.metadata || {}),
        ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
        type: nextType,
      },
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

const createListRatePolicies = ({ configRepository }) => async () => {
  const entries = await configRepository.listByCategory(RATE_POLICY_CATEGORY);
  return entries.map(buildRatePolicy);
};

const createCreateRatePolicy = ({ configRepository }) => async (payload = {}) => {
  const normalized = normalizeRatePolicyPayload(payload);
  if (!normalized.key) throw new ValidationError('key is required');

  const existing = await configRepository.findByCategoryAndKey(RATE_POLICY_CATEGORY, normalized.key);
  if (existing) throw new ConflictError('Rate policy key already exists');

  const entry = await configRepository.create({
    category: RATE_POLICY_CATEGORY,
    ...normalized,
  });

  return buildRatePolicy(entry);
};

const createUpdateRatePolicy = ({ configRepository }) => async (policyId, payload = {}) => {
  const existing = await configRepository.findByIdAndCategory(policyId, RATE_POLICY_CATEGORY);
  if (!existing) throw new NotFoundError('Rate policy');

  const normalized = normalizeRatePolicyPayload(payload, existing);
  const duplicate = await configRepository.findByCategoryAndKey(RATE_POLICY_CATEGORY, normalized.key);
  if (duplicate && Number(duplicate.id) !== Number(existing.id)) {
    throw new ConflictError('Rate policy key already exists');
  }

  const updated = await configRepository.update(existing.id, normalized);
  return buildRatePolicy(updated);
};

const createDeleteRatePolicy = ({ configRepository }) => async (policyId) => {
  const existing = await configRepository.findByIdAndCategory(policyId, RATE_POLICY_CATEGORY);
  if (!existing) throw new NotFoundError('Rate policy');
  await configRepository.destroy(existing.id);
  return { id: Number(policyId) };
};

const createResolveRatePolicy = ({ configRepository }) => async ({ amount } = {}) => {
  const numericAmount = toOptionalNumber(amount, 'amount');
  const policies = (await configRepository.listActiveByCategory(RATE_POLICY_CATEGORY)).map(buildRatePolicy);
  const matchingPolicies = policies.filter((policy) => {
    if (numericAmount === null) return true;
    if (policy.minAmount !== null && numericAmount < Number(policy.minAmount)) return false;
    if (policy.maxAmount !== null && numericAmount > Number(policy.maxAmount)) return false;
    return true;
  });

  return pickHighestPriorityPolicy(matchingPolicies);
};

const createListLateFeePolicies = ({ configRepository }) => async () => {
  const entries = await configRepository.listByCategory(LATE_FEE_POLICY_CATEGORY);
  return entries.map(buildLateFeePolicy);
};

const createCreateLateFeePolicy = ({ configRepository }) => async (payload = {}) => {
  const normalized = normalizeLateFeePolicyPayload(payload);
  if (!normalized.key) throw new ValidationError('key is required');

  const existing = await configRepository.findByCategoryAndKey(LATE_FEE_POLICY_CATEGORY, normalized.key);
  if (existing) throw new ConflictError('Late fee policy key already exists');

  const entry = await configRepository.create({
    category: LATE_FEE_POLICY_CATEGORY,
    ...normalized,
  });

  return buildLateFeePolicy(entry);
};

const createUpdateLateFeePolicy = ({ configRepository }) => async (policyId, payload = {}) => {
  const existing = await configRepository.findByIdAndCategory(policyId, LATE_FEE_POLICY_CATEGORY);
  if (!existing) throw new NotFoundError('Late fee policy');

  const normalized = normalizeLateFeePolicyPayload(payload, existing);
  const duplicate = await configRepository.findByCategoryAndKey(LATE_FEE_POLICY_CATEGORY, normalized.key);
  if (duplicate && Number(duplicate.id) !== Number(existing.id)) {
    throw new ConflictError('Late fee policy key already exists');
  }

  const updated = await configRepository.update(existing.id, normalized);
  return buildLateFeePolicy(updated);
};

const createDeleteLateFeePolicy = ({ configRepository }) => async (policyId) => {
  const existing = await configRepository.findByIdAndCategory(policyId, LATE_FEE_POLICY_CATEGORY);
  if (!existing) throw new NotFoundError('Late fee policy');
  await configRepository.destroy(existing.id);
  return { id: Number(policyId) };
};

const createResolveLateFeePolicy = ({ configRepository }) => async () => {
  const policies = (await configRepository.listActiveByCategory(LATE_FEE_POLICY_CATEGORY)).map(buildLateFeePolicy);
  return pickHighestPriorityPolicy(policies);
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

module.exports = {
  ADMIN_CATALOGS,
  createListPaymentMethods,
  createCreatePaymentMethod,
  createUpdatePaymentMethod,
  createDeletePaymentMethod,
  createListSettings,
  createUpsertSetting,
  createListRatePolicies,
  createCreateRatePolicy,
  createUpdateRatePolicy,
  createDeleteRatePolicy,
  createResolveRatePolicy,
  createListLateFeePolicies,
  createCreateLateFeePolicy,
  createUpdateLateFeePolicy,
  createDeleteLateFeePolicy,
  createResolveLateFeePolicy,
  createListAdminCatalogs,
  createListRoles,
};
