const { ConflictError, NotFoundError, ValidationError } = require('../../../utils/errorHandler');
const {
  PAYMENT_METHOD_CATEGORY,
  BUSINESS_SETTING_CATEGORY,
} = require('../infrastructure/repositories');

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

module.exports = {
  ADMIN_CATALOGS,
  createListPaymentMethods,
  createCreatePaymentMethod,
  createUpdatePaymentMethod,
  createDeletePaymentMethod,
  createListSettings,
  createUpsertSetting,
  createListAdminCatalogs,
};
