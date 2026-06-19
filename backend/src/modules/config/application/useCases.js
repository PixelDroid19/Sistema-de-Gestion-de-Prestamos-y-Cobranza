const { ConflictError, NotFoundError, ValidationError } = require('@/utils/errorHandler');
const {
  PAYMENT_METHOD_CATEGORY,
  BUSINESS_SETTING_CATEGORY,
  RATE_POLICY_CATEGORY,
  LATE_FEE_POLICY_CATEGORY,
} = require('@/modules/config/infrastructure/repositories');
const { BASE_CURRENCY_CODE, validateCurrencyPrecision } = require('@/modules/shared/money');
const { validateInterestRate } = require('@/modules/shared/validators');
const { ROLES } = require('@/modules/shared/roles');

const PAYMENT_METHOD_TYPES = new Set(['bank_transfer', 'cash', 'card', 'other']);
const POLICY_PRIORITIES = new Set(['low', 'medium', 'high']);
const OPERATIONAL_LATE_FEE_MODES = new Set(['NONE', 'SIMPLE', 'COMPOUND']);
const POLICY_PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

const CONFIG_CONFLICT_MESSAGES = {
  paymentMethodKeyExists: 'Ya existe un método de pago con ese identificador operativo.',
  paymentMethodLabelExists: 'Ya existe un método de pago con ese nombre.',
  ratePolicyKeyExists: 'Ya existe una política de tasa con ese identificador operativo.',
  ratePolicyLabelExists: 'Ya existe una política de tasa con ese nombre.',
  ratePolicyOverlap: 'Las políticas de tasa activas no pueden solaparse.',
  ratePolicyUsedByLoans: 'No se puede eliminar la política de tasa porque ya está asociada a créditos existentes.',
  lateFeePolicyKeyExists: 'Ya existe una política de mora con ese identificador operativo.',
  lateFeePolicyLabelExists: 'Ya existe una política de mora con ese nombre.',
  lateFeePolicyPriorityConflict: 'Las políticas de mora activas no pueden compartir la misma prioridad.',
  lateFeePolicyUsedByLoans: 'No se puede eliminar la política de mora porque ya está asociada a créditos existentes.',
};

const DUPLICATE_LABEL_MESSAGES = {
  'Payment method': CONFIG_CONFLICT_MESSAGES.paymentMethodLabelExists,
  'Rate policy': CONFIG_CONFLICT_MESSAGES.ratePolicyLabelExists,
  'Late fee policy': CONFIG_CONFLICT_MESSAGES.lateFeePolicyLabelExists,
};

const CONFIG_FIELD_LABELS = {
  amount: 'El monto',
  annualEffectiveRate: 'La tasa efectiva anual',
  key: 'El identificador operativo',
  label: 'El nombre',
  maxAmount: 'El monto máximo',
  minAmount: 'El monto mínimo',
  ratePolicyAnnualRate: 'La TNA 30/360',
  lateFeeAnnualEffectiveRate: 'La tasa de mora efectiva anual',
  settingKey: 'El identificador de la configuración',
};

const getConfigFieldLabel = (field) => CONFIG_FIELD_LABELS[field] || 'El dato';

const ADMIN_CATALOGS = {
  roles: ['admin', 'employee'],
  customerStatuses: ['active', 'inactive'],
  associateStatuses: ['active', 'inactive'],
  paymentVisibilities: ['customer', 'internal'],
  paymentDocumentCategories: ['voucher', 'receipt', 'transfer', 'note'],
};

const BASE_CURRENCY_SETTING = Object.freeze({
  id: null,
  key: 'base-currency',
  label: 'Moneda base',
  value: BASE_CURRENCY_CODE,
  description: 'Moneda operativa fija del sistema.',
  updatedAt: null,
});

const normalizeKey = (value) => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const requireText = (value, field) => {
  if (!String(value || '').trim()) {
    throw new ValidationError(`${getConfigFieldLabel(field)} es obligatorio.`);
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

  if (!validateCurrencyPrecision(value)) {
    throw new ValidationError(`${getConfigFieldLabel(field)} debe ser un número válido.`);
  }

  const numericValue = Number(typeof value === 'string' ? value.trim() : value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new ValidationError(`${getConfigFieldLabel(field)} debe ser un número válido.`);
  }

  return numericValue;
};

const assertPercent = (value, field) => {
  if (!validateInterestRate(value)) {
    throw new ValidationError(`${getConfigFieldLabel(field)} debe estar entre 0 y 100.`);
  }

  return Number(typeof value === 'string' ? value.trim() : value);
};

const normalizePolicyPriority = (value) => {
  if (value === undefined || value === null || value === '') return 'medium';
  const normalizedValue = String(value).trim().toLowerCase();
  if (!POLICY_PRIORITIES.has(normalizedValue)) {
    throw new ValidationError('Selecciona una prioridad válida.');
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
    throw new ValidationError('Selecciona un tipo de método de pago válido.');
  }
  return normalizedValue;
};

const inferReferenceRequirement = (type) => type === 'bank_transfer' || type === 'card';

const assertAmountRange = ({ minAmount, maxAmount }) => {
  if (minAmount !== null && minAmount < 0) {
    throw new ValidationError('El monto mínimo no puede ser negativo.');
  }
  if (maxAmount !== null && maxAmount < 0) {
    throw new ValidationError('El monto máximo no puede ser negativo.');
  }
  if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
    throw new ValidationError('El monto mínimo no puede ser mayor que el monto máximo.');
  }
};

const listCategoryEntries = async (configRepository, category, options = {}) => {
  if (typeof configRepository.listByCategory !== 'function') {
    return [];
  }

  return configRepository.listByCategory(category, options);
};

const normalizeComparableLabel = (value) => normalizeKey(value);

const assertUniqueLabel = async ({
  configRepository,
  category,
  label,
  currentId = null,
  ignoreIds = [],
  entityName,
  options = {},
}) => {
  const normalizedLabel = normalizeComparableLabel(label);
  const entries = await listCategoryEntries(configRepository, category, options);
  const ignoredIds = new Set(ignoreIds.map((id) => Number(id)));
  const duplicate = entries.find((entry) => (
    Number(entry.id) !== Number(currentId)
    && !ignoredIds.has(Number(entry.id))
    && normalizeComparableLabel(entry.label) === normalizedLabel
  ));

  if (duplicate) {
    throw new ConflictError(DUPLICATE_LABEL_MESSAGES[entityName] || 'Ya existe una configuración con ese nombre.');
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

const isFullRangeRatePolicyValue = (value = {}) => (
  normalizeRangeBoundary(value.minAmount, 0) === 0
  && normalizeRangeBoundary(value.maxAmount, Number.POSITIVE_INFINITY) === Number.POSITIVE_INFINITY
);

const isSeededCatchAllRatePolicyEntry = (entry) => (
  entry?.isActive !== false
  && entry?.value?.metadata?.seeded === true
  && isFullRangeRatePolicyValue(entry.value)
);

const canArchiveSeededCatchAllForExplicitRateRange = (normalized, entry) => (
  normalized.isActive !== false
  && !isFullRangeRatePolicyValue(normalized.value)
  && isSeededCatchAllRatePolicyEntry(entry)
);

const getRatePolicyOverlaps = async ({
  configRepository,
  normalized,
  currentId = null,
  ignoreIds = [],
  options = {},
}) => {
  if (normalized.isActive === false) return [];

  const entries = await listCategoryEntries(configRepository, RATE_POLICY_CATEGORY, options);
  const ignoredIds = new Set(ignoreIds.map((id) => Number(id)));
  const nextPolicy = {
    minAmount: normalized.value.minAmount,
    maxAmount: normalized.value.maxAmount,
  };

  return entries.filter((entry) => (
    Number(entry.id) !== Number(currentId)
    && !ignoredIds.has(Number(entry.id))
    && entry.isActive !== false
    && rangesOverlap(nextPolicy, {
      minAmount: entry.value?.minAmount,
      maxAmount: entry.value?.maxAmount,
    })
  ));
};

const getReplaceableSeededCatchAllRatePolicies = async ({ configRepository, normalized, options = {} }) => {
  if (normalized.isActive === false || isFullRangeRatePolicyValue(normalized.value)) {
    return [];
  }

  const overlaps = await getRatePolicyOverlaps({ configRepository, normalized, options });
  return overlaps.filter((entry) => canArchiveSeededCatchAllForExplicitRateRange(normalized, entry));
};

const archiveSeededCatchAllRatePolicies = async ({ configRepository, entries, options = {} }) => {
  await Promise.all(entries.map((entry) => configRepository.update(entry.id, {
    isActive: false,
    value: {
      ...(entry.value || {}),
      metadata: {
        ...(entry.value?.metadata || {}),
        seeded: true,
        replacedByExplicitRateRange: true,
      },
    },
  }, options)));
};

const runConfigMutation = async (configRepository, work) => {
  if (typeof configRepository.runInTransaction === 'function') {
    return configRepository.runInTransaction((transaction) => work({ transaction }));
  }

  return work({});
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
    throw new ValidationError(`${getConfigFieldLabel('label')} es obligatorio.`);
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
        ? assertPercent(payload.annualEffectiveRate, 'ratePolicyAnnualRate')
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
    throw new ValidationError(`${getConfigFieldLabel('label')} es obligatorio.`);
  }
  const mode = String(payload.lateFeeMode ?? existing?.value?.lateFeeMode ?? 'SIMPLE').trim().toUpperCase();
  if (!OPERATIONAL_LATE_FEE_MODES.has(mode)) {
    throw new ValidationError('Selecciona un método de mora válido.');
  }

  return {
    key,
    label,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing?.isActive !== false,
    value: {
      annualEffectiveRate: payload.annualEffectiveRate !== undefined
        ? assertPercent(payload.annualEffectiveRate, 'lateFeeAnnualEffectiveRate')
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

const assertNoAmbiguousRatePolicy = async ({
  configRepository,
  normalized,
  currentId = null,
  ignoreIds = [],
  options = {},
}) => {
  const duplicate = (await getRatePolicyOverlaps({
    configRepository,
    normalized,
    currentId,
    ignoreIds,
    options,
  }))[0];

  if (duplicate) {
    throw new ConflictError(CONFIG_CONFLICT_MESSAGES.ratePolicyOverlap);
  }
};

const assertNoAmbiguousLateFeePolicy = async ({
  configRepository,
  normalized,
  currentId = null,
  options = {},
}) => {
  if (normalized.isActive === false) return;

  const entries = await listCategoryEntries(configRepository, LATE_FEE_POLICY_CATEGORY, options);
  const duplicate = entries
    .map(buildLateFeePolicy)
    .find((policy) => (
      Number(policy.id) !== Number(currentId)
      && policy.isActive !== false
      && normalizePolicyPriority(policy.priority) === normalizePolicyPriority(normalized.value.priority)
    ));

  if (duplicate) {
    throw new ConflictError(CONFIG_CONFLICT_MESSAGES.lateFeePolicyPriorityConflict);
  }
};

const pickUniqueLateFeePolicy = (policies) => {
  const activePolicies = policies.filter((policy) => policy.isActive);
  if (activePolicies.length === 0) return null;

  const orderedPolicies = activePolicies.sort((left, right) => {
    const priorityDelta = (POLICY_PRIORITY_ORDER[left.priority] ?? POLICY_PRIORITY_ORDER.medium)
      - (POLICY_PRIORITY_ORDER[right.priority] ?? POLICY_PRIORITY_ORDER.medium);
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
  });
  const selected = orderedPolicies[0];
  const selectedPriority = normalizePolicyPriority(selected.priority);
  const samePriorityPolicies = orderedPolicies.filter((policy) => normalizePolicyPriority(policy.priority) === selectedPriority);

  if (samePriorityPolicies.length > 1) {
    throw new ConflictError(CONFIG_CONFLICT_MESSAGES.lateFeePolicyPriorityConflict);
  }

  return selected;
};

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

/**
 * List only the ACTIVE payment methods. Read-only and exposed to backoffice
 * operators (admin + employee) so they can select admin-configured methods when
 * registering payments, without granting access to the admin configuration surface.
 */
const createListActivePaymentMethods = ({ configRepository }) => async () => {
  const entries = await configRepository.listActiveByCategory(PAYMENT_METHOD_CATEGORY);
  return entries.map(buildPaymentMethod);
};

const createCreatePaymentMethod = ({ configRepository }) => async ({ label, key, description, requiresReference, isActive, type, metadata }) => {
  const normalizedLabel = requireText(label, 'label');
  const normalizedKey = normalizeKey(key || normalizedLabel);
  const normalizedType = normalizePaymentMethodType(type);

  if (!normalizedKey) {
    throw new ValidationError(`${getConfigFieldLabel('key')} es obligatorio.`);
  }

  const existing = await configRepository.findByCategoryAndKey(PAYMENT_METHOD_CATEGORY, normalizedKey);
  if (existing) {
    throw new ConflictError(CONFIG_CONFLICT_MESSAGES.paymentMethodKeyExists);
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
    throw new ValidationError(`${getConfigFieldLabel('key')} es obligatorio.`);
  }

  const duplicate = await configRepository.findByCategoryAndKey(PAYMENT_METHOD_CATEGORY, nextKey);
  if (duplicate && Number(duplicate.id) !== Number(existing.id)) {
    throw new ConflictError(CONFIG_CONFLICT_MESSAGES.paymentMethodKeyExists);
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
  const settings = entries.map(buildSetting);
  const hasBaseCurrency = settings.some((setting) => ['base-currency', 'base_currency'].includes(setting.key));
  return hasBaseCurrency ? settings : [BASE_CURRENCY_SETTING, ...settings];
};

const createListRatePolicies = ({ configRepository }) => async () => {
  const entries = await configRepository.listByCategory(RATE_POLICY_CATEGORY);
  return entries.map(buildRatePolicy);
};

const createCreateRatePolicy = ({ configRepository }) => async (payload = {}) => {
  const normalized = normalizeRatePolicyPayload(payload);
  if (!normalized.key) throw new ValidationError(`${getConfigFieldLabel('key')} es obligatorio.`);

  return runConfigMutation(configRepository, async (options) => {
    const replaceableSeededCatchAllPolicies = await getReplaceableSeededCatchAllRatePolicies({
      configRepository,
      normalized,
      options,
    });
    const replaceableSeededCatchAllIds = replaceableSeededCatchAllPolicies.map((entry) => entry.id);

    const existing = await configRepository.findByCategoryAndKey(RATE_POLICY_CATEGORY, normalized.key, options);
    if (existing) {
      throw new ConflictError(CONFIG_CONFLICT_MESSAGES.ratePolicyKeyExists);
    }
    await assertUniqueLabel({
      configRepository,
      category: RATE_POLICY_CATEGORY,
      label: normalized.label,
      ignoreIds: replaceableSeededCatchAllIds,
      entityName: 'Rate policy',
      options,
    });
    await assertNoAmbiguousRatePolicy({
      configRepository,
      normalized,
      ignoreIds: replaceableSeededCatchAllIds,
      options,
    });

    const entry = await configRepository.create({
      category: RATE_POLICY_CATEGORY,
      ...normalized,
    }, options);
    await archiveSeededCatchAllRatePolicies({
      configRepository,
      entries: replaceableSeededCatchAllPolicies,
      options,
    });

    return buildRatePolicy(entry);
  });
};

const createUpdateRatePolicy = ({ configRepository }) => async (policyId, payload = {}) => {
  return runConfigMutation(configRepository, async (options) => {
    const existing = await configRepository.findByIdAndCategory(policyId, RATE_POLICY_CATEGORY, options);
    if (!existing) throw new NotFoundError('Rate policy');

    const normalized = normalizeRatePolicyPayload(payload, existing);
    const duplicate = await configRepository.findByCategoryAndKey(RATE_POLICY_CATEGORY, normalized.key, options);
    if (duplicate && Number(duplicate.id) !== Number(existing.id)) {
      throw new ConflictError(CONFIG_CONFLICT_MESSAGES.ratePolicyKeyExists);
    }
    await assertUniqueLabel({
      configRepository,
      category: RATE_POLICY_CATEGORY,
      label: normalized.label,
      currentId: existing.id,
      entityName: 'Rate policy',
      options,
    });
    await assertNoAmbiguousRatePolicy({ configRepository, normalized, currentId: existing.id, options });

    const updated = await configRepository.update(existing.id, normalized, options);
    return buildRatePolicy(updated);
  });
};

const createDeleteRatePolicy = ({ configRepository }) => async (policyId) => {
  const existing = await configRepository.findByIdAndCategory(policyId, RATE_POLICY_CATEGORY);
  if (!existing) throw new NotFoundError('Rate policy');
  const usedLoans = typeof configRepository.countLoansUsingRatePolicy === 'function'
    ? await configRepository.countLoansUsingRatePolicy(existing.id)
    : 0;
  if (usedLoans > 0) {
    throw new ConflictError(CONFIG_CONFLICT_MESSAGES.ratePolicyUsedByLoans);
  }
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
  if (!normalized.key) throw new ValidationError(`${getConfigFieldLabel('key')} es obligatorio.`);

  return runConfigMutation(configRepository, async (options) => {
    const existing = await configRepository.findByCategoryAndKey(LATE_FEE_POLICY_CATEGORY, normalized.key, options);
    if (existing) throw new ConflictError(CONFIG_CONFLICT_MESSAGES.lateFeePolicyKeyExists);
    await assertUniqueLabel({
      configRepository,
      category: LATE_FEE_POLICY_CATEGORY,
      label: normalized.label,
      entityName: 'Late fee policy',
      options,
    });
    await assertNoAmbiguousLateFeePolicy({ configRepository, normalized, options });

    const entry = await configRepository.create({
      category: LATE_FEE_POLICY_CATEGORY,
      ...normalized,
    }, options);

    return buildLateFeePolicy(entry);
  });
};

const createUpdateLateFeePolicy = ({ configRepository }) => async (policyId, payload = {}) => {
  return runConfigMutation(configRepository, async (options) => {
    const existing = await configRepository.findByIdAndCategory(policyId, LATE_FEE_POLICY_CATEGORY, options);
    if (!existing) throw new NotFoundError('Late fee policy');

    const normalized = normalizeLateFeePolicyPayload(payload, existing);
    const duplicate = await configRepository.findByCategoryAndKey(LATE_FEE_POLICY_CATEGORY, normalized.key, options);
    if (duplicate && Number(duplicate.id) !== Number(existing.id)) {
      throw new ConflictError(CONFIG_CONFLICT_MESSAGES.lateFeePolicyKeyExists);
    }
    await assertUniqueLabel({
      configRepository,
      category: LATE_FEE_POLICY_CATEGORY,
      label: normalized.label,
      currentId: existing.id,
      entityName: 'Late fee policy',
      options,
    });
    await assertNoAmbiguousLateFeePolicy({ configRepository, normalized, currentId: existing.id, options });

    const updated = await configRepository.update(existing.id, normalized, options);
    return buildLateFeePolicy(updated);
  });
};

const createDeleteLateFeePolicy = ({ configRepository }) => async (policyId) => {
  const existing = await configRepository.findByIdAndCategory(policyId, LATE_FEE_POLICY_CATEGORY);
  if (!existing) throw new NotFoundError('Late fee policy');
  const usedLoans = typeof configRepository.countLoansUsingLateFeePolicy === 'function'
    ? await configRepository.countLoansUsingLateFeePolicy(existing.id)
    : 0;
  if (usedLoans > 0) {
    throw new ConflictError(CONFIG_CONFLICT_MESSAGES.lateFeePolicyUsedByLoans);
  }
  await configRepository.destroy(existing.id);
  return { id: Number(policyId) };
};

const createResolveLateFeePolicy = ({ configRepository }) => async () => {
  const policies = (await configRepository.listActiveByCategory(LATE_FEE_POLICY_CATEGORY)).map(buildLateFeePolicy);
  return pickUniqueLateFeePolicy(policies);
};

const createUpsertSetting = ({ configRepository }) => async (settingKey, { label, value, description } = {}) => {
  const normalizedKey = normalizeKey(settingKey);
  if (!normalizedKey) {
    throw new ValidationError(`${getConfigFieldLabel('settingKey')} es obligatorio.`);
  }
  if (['base-currency', 'base-currency-code', 'base-currency-label'].includes(normalizedKey)) {
    throw new ValidationError('La moneda base es fija en COP en esta versión.');
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
  createListActivePaymentMethods,
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
