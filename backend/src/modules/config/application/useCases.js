const { ConflictError, NotFoundError, ValidationError } = require('@/utils/errorHandler');
const {
  PAYMENT_METHOD_CATEGORY,
  BUSINESS_SETTING_CATEGORY,
  RATE_POLICY_CATEGORY,
  LATE_FEE_POLICY_CATEGORY,
} = require('@/modules/config/infrastructure/repositories');
const { ROLES } = require('@/modules/shared/roles');

const PAYMENT_METHOD_TYPES = new Set(['bank_transfer', 'cash', 'card', 'other']);
const POLICY_PRIORITIES = new Set(['low', 'medium', 'high']);
const OPERATIONAL_LATE_FEE_MODES = new Set(['NONE', 'SIMPLE', 'COMPOUND']);
const POLICY_PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

const ADMIN_CATALOGS = {
  roles: ['admin', 'employee'],
  customerStatuses: ['active', 'inactive'],
  associateStatuses: ['active', 'inactive'],
  paymentVisibilities: ['customer', 'internal'],
  paymentDocumentCategories: ['voucher', 'receipt', 'transfer', 'note'],
};

const normalizeKey = (value) => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
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
  if (value === undefined || value === null || value === '') return 'medium';
  const normalizedValue = String(value).trim().toLowerCase();
  if (!POLICY_PRIORITIES.has(normalizedValue)) {
    throw new ValidationError('priority must be one of: low, medium, high');
  }
  return normalizedValue;
};

const normalizeStoredPolicyPriority = (value) => {
  if (value === undefined || value === null || value === '') return 'medium';
  const normalizedValue = String(value).trim().toLowerCase();
  if (POLICY_PRIORITIES.has(normalizedValue)) return normalizedValue;

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 'medium';
  if (numericValue >= 67) return 'high';
  if (numericValue <= 33) return 'low';
  return 'medium';
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

const listCategoryEntries = async (configRepository, category) => {
  if (typeof configRepository.listByCategory !== 'function') {
    return [];
  }

  return configRepository.listByCategory(category);
};

const normalizeComparableLabel = (value) => normalizeKey(value);

const assertUniqueLabel = async ({ configRepository, category, label, currentId = null, ignoreIds = [], entityName }) => {
  const normalizedLabel = normalizeComparableLabel(label);
  const entries = await listCategoryEntries(configRepository, category);
  const ignoredIds = new Set(ignoreIds.map((id) => Number(id)));
  const duplicate = entries.find((entry) => (
    Number(entry.id) !== Number(currentId)
    && !ignoredIds.has(Number(entry.id))
    && normalizeComparableLabel(entry.label) === normalizedLabel
  ));

  if (duplicate) {
    throw new ConflictError(`${entityName} label already exists`);
  }
};

const normalizeRangeBoundary = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return Number(value);
};

const rangesOverlap = (left, right) => {
  const leftMin = normalizeRangeBoundary(left.minAmount, 0);
  const leftMax = normalizeRangeBoundary(left.maxAmount, Number.POSITIVE_INFINITY);
  const rightMin = normalizeRangeBoundary(right.minAmount, 0);
  const rightMax = normalizeRangeBoundary(right.maxAmount, Number.POSITIVE_INFINITY);

  return leftMin <= rightMax && rightMin <= leftMax;
};

const isFullRateRange = ({ minAmount, maxAmount }) => (
  normalizeRangeBoundary(minAmount, 0) === 0
  && normalizeRangeBoundary(maxAmount, Number.POSITIVE_INFINITY) === Number.POSITIVE_INFINITY
);

const isSeededCatchAllRateEntry = (entry) => (
  entry?.value?.metadata?.seeded === true
  && entry?.isActive !== false
  && isFullRateRange({
    minAmount: entry?.value?.minAmount,
    maxAmount: entry?.value?.maxAmount,
  })
);

const getRatePolicyOverlaps = async ({ configRepository, normalized, currentId = null }) => {
  if (normalized.isActive === false) return [];

  const entries = await listCategoryEntries(configRepository, RATE_POLICY_CATEGORY);
  const nextPolicy = {
    minAmount: normalized.value.minAmount,
    maxAmount: normalized.value.maxAmount,
  };

  return entries.filter((entry) => (
    Number(entry.id) !== Number(currentId)
    && entry.isActive !== false
    && rangesOverlap(nextPolicy, {
      minAmount: entry.value?.minAmount,
      maxAmount: entry.value?.maxAmount,
    })
  ));
};

const getReplaceableSeededRateEntries = async ({ configRepository, normalized, currentId = null }) => {
  if (currentId || normalized.isActive === false || isFullRateRange({
    minAmount: normalized.value.minAmount,
    maxAmount: normalized.value.maxAmount,
  })) {
    return [];
  }

  const overlaps = await getRatePolicyOverlaps({ configRepository, normalized, currentId });
  if (overlaps.length === 0 || overlaps.some((entry) => !isSeededCatchAllRateEntry(entry))) {
    return [];
  }

  return overlaps;
};

const deactivateSeededRateEntry = async ({ configRepository, entry, normalized }) => {
  return configRepository.update(entry.id, {
    key: entry.key || normalizeKey(entry.label),
    label: `${entry.label} (reemplazada por rangos)`,
    isActive: false,
    value: {
      ...(entry.value || {}),
      metadata: {
        ...(entry.value?.metadata || {}),
        replacedByExplicitRateRange: true,
        replacedByRatePolicyKey: normalized.key,
      },
    },
  });
};

const buildRatePolicy = (entry) => ({
  id: entry.id,
  key: entry.key,
  label: entry.label,
  isActive: entry.isActive !== false,
  minAmount: entry.value?.minAmount ?? null,
  maxAmount: entry.value?.maxAmount ?? null,
  annualEffectiveRate: entry.value?.annualEffectiveRate ?? 0,
  priority: normalizeStoredPolicyPriority(entry.value?.priority),
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
  priority: normalizeStoredPolicyPriority(entry.value?.priority),
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
  if (!OPERATIONAL_LATE_FEE_MODES.has(mode)) {
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

const assertNoAmbiguousRatePolicy = async ({ configRepository, normalized, currentId = null }) => {
  const duplicate = (await getRatePolicyOverlaps({ configRepository, normalized, currentId }))[0];

  if (duplicate) {
    throw new ConflictError('Active rate policies cannot overlap');
  }
};

const assertNoAmbiguousLateFeePolicy = async ({ configRepository, normalized, currentId = null }) => {
  if (normalized.isActive === false) return;

  const entries = await listCategoryEntries(configRepository, LATE_FEE_POLICY_CATEGORY);
  const duplicate = entries
    .map(buildLateFeePolicy)
    .find((policy) => (
      Number(policy.id) !== Number(currentId)
      && policy.isActive !== false
      && normalizePolicyPriority(policy.priority) === normalizePolicyPriority(normalized.value.priority)
    ));

  if (duplicate) {
    throw new ConflictError('Active late fee policies cannot share the same priority');
  }
};

const pickHighestPriorityPolicy = (policies) => policies
  .filter((policy) => policy.isActive)
  .sort((left, right) => {
    const priorityDelta = (POLICY_PRIORITY_ORDER[left.priority] ?? POLICY_PRIORITY_ORDER.medium)
      - (POLICY_PRIORITY_ORDER[right.priority] ?? POLICY_PRIORITY_ORDER.medium);
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
  })[0] || null;

/**
 * Resolves the single operational rate policy for a loan amount.
 *
 * @param {Array<object>} policies Active policies that already cover the amount.
 * @returns {object|null} The unique policy, or null.
 * @throws {ConflictError} When multiple active policies cover the amount.
 */
const pickUniqueRatePolicyForAmount = (policies) => {
  const orderedPolicies = policies
    .filter((policy) => policy.isActive)
    .sort((left, right) => {
      const minDelta = normalizeRangeBoundary(left.minAmount, 0) - normalizeRangeBoundary(right.minAmount, 0);
      if (minDelta !== 0) return minDelta;
      return normalizeRangeBoundary(left.maxAmount, Number.POSITIVE_INFINITY)
        - normalizeRangeBoundary(right.maxAmount, Number.POSITIVE_INFINITY);
    });

  const topPolicy = orderedPolicies[0] || null;
  if (!topPolicy) return null;

  if (orderedPolicies.length > 1) {
    const labels = orderedPolicies.map((policy) => policy.label).filter(Boolean).join(', ');
    throw new ConflictError(`Hay políticas de tasa activas ambiguas para este monto: ${labels}`);
  }

  return topPolicy;
};

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
  await assertUniqueLabel({
    configRepository,
    category: PAYMENT_METHOD_CATEGORY,
    label: normalizedLabel,
    entityName: 'Payment method',
  });

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
  await assertUniqueLabel({
    configRepository,
    category: PAYMENT_METHOD_CATEGORY,
    label: nextLabel,
    currentId: existing.id,
    entityName: 'Payment method',
  });

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

  const replaceableSeededEntries = await getReplaceableSeededRateEntries({ configRepository, normalized });
  const replaceableSeededIds = new Set(replaceableSeededEntries.map((entry) => Number(entry.id)));
  const existing = await configRepository.findByCategoryAndKey(RATE_POLICY_CATEGORY, normalized.key);
  if (existing && !replaceableSeededIds.has(Number(existing.id))) {
    throw new ConflictError('Rate policy key already exists');
  }
  await assertUniqueLabel({
    configRepository,
    category: RATE_POLICY_CATEGORY,
    label: normalized.label,
    ignoreIds: replaceableSeededEntries.map((entry) => entry.id),
    entityName: 'Rate policy',
  });
  if (replaceableSeededEntries.length === 0) {
    await assertNoAmbiguousRatePolicy({ configRepository, normalized });
  }

  await Promise.all(replaceableSeededEntries.map((entry) => deactivateSeededRateEntry({
    configRepository,
    entry,
    normalized,
  })));

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
  await assertUniqueLabel({
    configRepository,
    category: RATE_POLICY_CATEGORY,
    label: normalized.label,
    currentId: existing.id,
    entityName: 'Rate policy',
  });
  await assertNoAmbiguousRatePolicy({ configRepository, normalized, currentId: existing.id });

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

  return pickUniqueRatePolicyForAmount(matchingPolicies);
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
  await assertUniqueLabel({
    configRepository,
    category: LATE_FEE_POLICY_CATEGORY,
    label: normalized.label,
    entityName: 'Late fee policy',
  });
  await assertNoAmbiguousLateFeePolicy({ configRepository, normalized });

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
  await assertUniqueLabel({
    configRepository,
    category: LATE_FEE_POLICY_CATEGORY,
    label: normalized.label,
    currentId: existing.id,
    entityName: 'Late fee policy',
  });
  await assertNoAmbiguousLateFeePolicy({ configRepository, normalized, currentId: existing.id });

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

const createUpsertSetting = ({ configRepository }) => async (settingKey, { label, value, description } = {}) => {
  const normalizedKey = normalizeKey(settingKey);
  if (!normalizedKey) {
    throw new ValidationError('setting key is required');
  }

  const existing = await configRepository.findByCategoryAndKey(BUSINESS_SETTING_CATEGORY, normalizedKey);

  if (existing) {
    const normalizedLabel = label !== undefined
      ? requireText(label, 'label')
      : requireText(existing.label || normalizedKey, 'label');
    const updated = await configRepository.update(existing.id, {
      label: normalizedLabel,
      value: {
        value: value !== undefined ? value : existing.value?.value ?? '',
        description: description !== undefined
          ? String(description || '').trim()
          : existing.value?.description || '',
      },
      isActive: true,
    });

    return buildSetting(updated);
  }

  const normalizedLabel = requireText(label || normalizedKey, 'label');
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
